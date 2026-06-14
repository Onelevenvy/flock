use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;
use sqlx::Row;
use tauri::{AppHandle, State, Emitter};
use serde_json::Value as JsonValue;
use tokio_stream::StreamExt;

use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use langgraph::checkpoint::BaseCheckpointSaver;
use langgraph::checkpoint::InMemorySaver;
use langgraph::sqlite::SqliteSaver;
use langgraph::prebuilt::BaseChatModel;

use flock_workflow::{build_workflow_graph, WorkflowNodeContext, WorkflowSink};
use flock_core::model_factory::{CachedModelFactory, ModelFactory};
use flock_tools::all_tools;
use crate::SharedDbManager;
use crate::commands::SharedAgentState;
use crate::commands::ExecutionManager;
use crate::commands::common::resolve_workspace_env;

pub(crate) struct TauriWorkflowSink {
    pub(crate) app: AppHandle,
    pub(crate) workflow_id: String,
    pub(crate) thread_id: String,
    pub(crate) accumulated_text: Arc<Mutex<String>>,
    pub(crate) accumulated_thinking: Arc<Mutex<String>>,
    pub(crate) events_log: Arc<Mutex<Vec<JsonValue>>>,
    /// Throttle state: tracks the last time a text_delta/thinking event was emitted.
    /// On macOS, app.emit() must dispatch to the main thread via mach port; emitting
    /// every single LLM token floods the run loop and causes IMKCFRunLoopWakeUpReliable
    /// errors, freezing the entire UI. We batch tokens into at most one emit per 50ms.
    pub(crate) last_text_emit: Arc<Mutex<std::time::Instant>>,
    pub(crate) pending_text: Arc<Mutex<(String, String)>>,    // (node_id, accumulated)
    pub(crate) pending_thinking: Arc<Mutex<(String, String)>>, // (node_id, accumulated)
}

impl TauriWorkflowSink {
    pub(crate) fn push_event(&self, event: JsonValue) {
        if let Ok(mut log) = self.events_log.lock() {
            log.push(event);
        }
    }
}

impl WorkflowSink for TauriWorkflowSink {
    fn emit_node_start(&self, node_id: &str) {
        let ts = chrono::Utc::now().timestamp_millis();
        self.push_event(serde_json::json!({
            "type": "info",
            "content": format!("▶️ Running node: [{}]", node_id),
            "nodeId": node_id,
            "timestamp": ts
        }));
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "node_start",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
        }));
    }
    fn emit_node_done(&self, node_id: &str, output: &JsonValue) {
        let ts = chrono::Utc::now().timestamp_millis();
        if let Some(obj) = output.as_object() {
            let response_text = obj.get("response").or_else(|| obj.get("answer")).and_then(|v| v.as_str());
            if let Some(txt) = response_text {
                if let Ok(mut lock) = self.accumulated_text.lock() {
                    if lock.is_empty() {
                        lock.push_str(txt);
                    }
                }
            }
        } else if let Some(txt) = output.as_str() {
            if let Ok(mut lock) = self.accumulated_text.lock() {
                if lock.is_empty() {
                    lock.push_str(txt);
                }
            }
        }

        // Flush any pending text_delta buffer before node_done so throttled tokens aren't lost
        if let Ok(mut pending) = self.pending_text.lock() {
            if !pending.1.is_empty() {
                let batch_text = pending.1.clone();
                let batch_node = pending.0.clone();
                pending.1.clear();
                self.push_event(serde_json::json!({
                    "type": "text_delta", "content": batch_text,
                    "nodeId": batch_node, "timestamp": ts
                }));
                let _ = self.app.emit("workflow-event", serde_json::json!({
                    "type": "text_delta",
                    "workflow_id": &self.workflow_id,
                    "thread_id": &self.thread_id,
                    "node_id": batch_node,
                    "text": batch_text,
                }));
            }
        }
        if let Ok(mut pending) = self.pending_thinking.lock() {
            if !pending.1.is_empty() {
                let batch_text = pending.1.clone();
                let batch_node = pending.0.clone();
                pending.1.clear();
                self.push_event(serde_json::json!({
                    "type": "thinking", "content": batch_text,
                    "nodeId": batch_node, "timestamp": ts
                }));
                let _ = self.app.emit("workflow-event", serde_json::json!({
                    "type": "thinking",
                    "workflow_id": &self.workflow_id,
                    "thread_id": &self.thread_id,
                    "node_id": batch_node,
                    "text": batch_text,
                }));
            }
        }

        self.push_event(serde_json::json!({
            "type": "info",
            "content": format!("✅ Node [{}] finished.", node_id),
            "nodeId": node_id,
            "timestamp": ts
        }));

        // 补偿非流式返回：只在该节点还没有 text_delta 时才补偿
        let has_deltas = {
            let log = self.events_log.lock().unwrap();
            log.iter().any(|m| {
                m.get("nodeId").and_then(|id| id.as_str()) == Some(node_id)
                    && m.get("type").and_then(|t| t.as_str()) == Some("text_delta")
            })
        };
        if !has_deltas {
            if let Some(obj) = output.as_object() {
                let response_text = obj.get("response").or_else(|| obj.get("answer")).and_then(|v| v.as_str());
                if let Some(txt) = response_text {
                    self.push_event(serde_json::json!({
                        "type": "text_delta",
                        "content": txt,
                        "nodeId": node_id,
                        "timestamp": ts + 1
                    }));
                }
            } else if let Some(txt) = output.as_str() {
                self.push_event(serde_json::json!({
                    "type": "text_delta",
                    "content": txt,
                    "nodeId": node_id,
                    "timestamp": ts + 1
                }));
            }
        }

        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "node_done",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
            "output": output,
        }));
    }
    fn emit_text_delta(&self, node_id: &str, text: &str) {
        if let Ok(mut lock) = self.accumulated_text.lock() {
            lock.push_str(text);
        }
        // Accumulate into pending buffer
        if let Ok(mut pending) = self.pending_text.lock() {
            if pending.0 != node_id {
                // Node changed — flush old pending immediately before switching
                if !pending.1.is_empty() {
                    let old_node = pending.0.clone();
                    let old_text = pending.1.clone();
                    let ts = chrono::Utc::now().timestamp_millis();
                    self.push_event(serde_json::json!({
                        "type": "text_delta", "content": old_text,
                        "nodeId": old_node, "timestamp": ts
                    }));
                    let _ = self.app.emit("workflow-event", serde_json::json!({
                        "type": "text_delta",
                        "workflow_id": &self.workflow_id,
                        "thread_id": &self.thread_id,
                        "node_id": old_node,
                        "text": old_text,
                    }));
                    pending.1.clear();
                }
                pending.0 = node_id.to_string();
            }
            pending.1.push_str(text);
        }
        // Throttle: emit at most once every 50ms
        let should_emit = if let Ok(mut last) = self.last_text_emit.lock() {
            let elapsed = last.elapsed();
            if elapsed >= std::time::Duration::from_millis(50) {
                *last = std::time::Instant::now();
                true
            } else {
                false
            }
        } else { true };

        if should_emit {
            if let Ok(mut pending) = self.pending_text.lock() {
                if !pending.1.is_empty() {
                    let batch_text = pending.1.clone();
                    let batch_node = pending.0.clone();
                    pending.1.clear();
                    let ts = chrono::Utc::now().timestamp_millis();
                    self.push_event(serde_json::json!({
                        "type": "text_delta", "content": batch_text,
                        "nodeId": batch_node, "timestamp": ts
                    }));
                    let _ = self.app.emit("workflow-event", serde_json::json!({
                        "type": "text_delta",
                        "workflow_id": &self.workflow_id,
                        "thread_id": &self.thread_id,
                        "node_id": batch_node,
                        "text": batch_text,
                    }));
                }
            }
        }
    }
    fn emit_thinking(&self, node_id: &str, text: &str) {
        if let Ok(mut lock) = self.accumulated_thinking.lock() {
            lock.push_str(text);
        }
        // Same 50ms throttle for thinking tokens
        if let Ok(mut pending) = self.pending_thinking.lock() {
            pending.0 = node_id.to_string();
            pending.1.push_str(text);
        }
        let should_emit = if let Ok(mut last) = self.last_text_emit.lock() {
            let elapsed = last.elapsed();
            if elapsed >= std::time::Duration::from_millis(50) {
                *last = std::time::Instant::now();
                true
            } else {
                false
            }
        } else { true };

        if should_emit {
            if let Ok(mut pending) = self.pending_thinking.lock() {
                if !pending.1.is_empty() {
                    let batch_text = pending.1.clone();
                    let batch_node = pending.0.clone();
                    pending.1.clear();
                    let ts = chrono::Utc::now().timestamp_millis();
                    self.push_event(serde_json::json!({
                        "type": "thinking", "content": batch_text,
                        "nodeId": batch_node, "timestamp": ts
                    }));
                    let _ = self.app.emit("workflow-event", serde_json::json!({
                        "type": "thinking",
                        "workflow_id": &self.workflow_id,
                        "thread_id": &self.thread_id,
                        "node_id": batch_node,
                        "text": batch_text,
                    }));
                }
            }
        }
    }
    fn emit_error(&self, msg: &str) {
        let ts = chrono::Utc::now().timestamp_millis();
        self.push_event(serde_json::json!({
            "type": "error",
            "content": format!("❌ Execution error: {}", msg),
            "timestamp": ts
        }));
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "error",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "message": msg,
        }));
    }
    fn emit_node_error(&self, node_id: &str, msg: &str) {
        let ts = chrono::Utc::now().timestamp_millis();
        self.push_event(serde_json::json!({
            "type": "error",
            "content": format!("❌ Execution error: {}", msg),
            "nodeId": node_id,
            "timestamp": ts
        }));
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "error",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
            "message": msg,
        }));
    }
    fn emit_tool_request(&self, call_id: &str, tool_name: &str, category: &flock_core::ipc_interface::events::ToolCategory, tool_args: &JsonValue) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "tool_request",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "call_id": call_id,
            "tool_name": tool_name,
            "category": category,
            "tool_args": tool_args,
        }));
    }
    fn emit_tool_running(&self, call_id: &str, tool_name: &str, tool_args: &JsonValue) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "tool_running",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "call_id": call_id,
            "tool_name": tool_name,
            "tool_args": tool_args,
        }));
    }
    fn emit_tool_result(&self, call_id: &str, tool_name: &str, status: &str, output: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "tool_result",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "call_id": call_id,
            "tool_name": tool_name,
            "status": status,
            "output": output,
        }));
    }
    fn emit_tool_cancelled(&self, call_id: &str, tool_name: &str, reason: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "tool_cancelled",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "call_id": call_id,
            "tool_name": tool_name,
            "reason": reason,
        }));
    }
}

/// 运行工作流（支持新运行或 resume 被打断的 review 节点）
#[tauri::command]
pub async fn run_workflow(
    app: AppHandle,
    db: State<'_, SharedDbManager>,
    execution_manager: State<'_, Arc<ExecutionManager>>,
    agent_state: State<'_, SharedAgentState>,
    workflow_id: String,
    input: Option<serde_json::Value>,
    resume_value: Option<JsonValue>,
    thread_id: Option<String>,
    use_draft: Option<bool>,
) -> Result<(), String> {
    // 1. 获取工作流配置
    let wf_record = db.get_workflow(&workflow_id).await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow {} not found", workflow_id))?;

    let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();
    let is_running = Arc::new(std::sync::atomic::AtomicBool::new(true));

    // 2. 如果之前已经在运行，先取消之前的实例
    execution_manager.cancel_task(&workflow_id).await;

    // 3. 构建 model provider 和配置
    let cli_args = flock_core::config::settings::CliArgs {
        provider: None,
        api_key: None,
        base_url: None,
        model: None,
        max_tokens: None,
        max_turns: None,
        system_prompt: None,
        auto_approve: false,
        project_dir: None,
    };
    let config = flock_core::config::settings::Config::resolve_from_db(&cli_args, db.inner().clone())
        .await
        .map_err(|e| e.to_string())?;

    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) { return Ok(()); }

    let provider: Arc<dyn BaseChatModel> = Arc::from(flock_core::model_factory::create_model(flock_core::model_factory::ModelProviderParams {
        provider_type: config.provider.to_string(),
        model: config.model.clone(),
        api_key: config.api_key.clone(),
        base_url: if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
        max_tokens: None,
        temperature: None,
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        response_format: None,
    }).map_err(|e| e.to_string())?);

    // 4. 构建 ModelFactory（支持每节点独立模型选择）
    let mut model_registry: HashMap<String, (String, String, Option<String>)> = HashMap::new();
    match db.list_providers().await {
        Ok(providers) => {
            for p in &providers {
                if !p.is_available { continue; }
                let api_key = p.api_key.clone().unwrap_or_default();
                if api_key.is_empty() { continue; }
                match db.list_models(&p.id).await {
                    Ok(models) => {
                        for m in &models {
                            if m.is_online && m.categories.contains(&"chat".to_string()) {
                                model_registry.insert(
                                    m.model_name.clone(),
                                    (p.provider_type.clone(), api_key.clone(), p.base_url.clone()),
                                );
                            }
                        }
                    }
                    Err(e) => log::warn!("[workflow] Failed to list models for provider {}: {}", p.id, e),
                }
            }
        }
        Err(e) => log::warn!("[workflow] Failed to list providers: {}", e),
    }
    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) { return Ok(()); }
    let model_factory: Arc<dyn ModelFactory> = Arc::new(CachedModelFactory::new(
        model_registry,
        config.provider.to_string(),
        config.api_key.clone(),
        if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
    ));

    // 5. 初始化 Checkpointer
    let checkpointer: Arc<dyn BaseCheckpointSaver> = {
        let db_path_str = config.db_path.to_string_lossy().to_string();
        let conn_str = format!("sqlite:{}", db_path_str);
        match SqliteSaver::from_conn_string(&conn_str).await {
            Ok(saver) => {
                if saver.setup().await.is_ok() {
                    Arc::new(saver)
                } else {
                    Arc::new(InMemorySaver::new())
                }
            }
            Err(_) => Arc::new(InMemorySaver::new()),
        }
    };

    let thread_id_val = thread_id.unwrap_or_else(|| workflow_id.clone());

    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) { return Ok(()); }

    // 重点：如果是全新启动工作流运行（不是 resume 打断），彻底清空 sqlite checkpointer 里旧状态 records
    if resume_value.is_none() {
        let _ = sqlx::query("DELETE FROM checkpoints WHERE thread_id = ?1")
            .bind(&thread_id_val)
            .execute(db.pool())
            .await;
        let _ = sqlx::query("DELETE FROM writes WHERE thread_id = ?1")
            .bind(&thread_id_val)
            .execute(db.pool())
            .await;
    }

    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) { return Ok(()); }

    let input_str_for_env = input.as_ref().map(|val| {
        if let Some(s) = val.as_str() {
            s.to_string()
        } else {
            val.to_string()
        }
    });

    let workdir = resolve_workspace_env(&*db, &thread_id_val, input_str_for_env.as_deref(), Some(&app))
        .await
        .map_err(|e| e.to_string())?;

    // 保存附件文件到工作空间
    if let Some(ref inp_val) = input {
        if let Some(attachments) = inp_val.get("attachments").and_then(|v| v.as_array()) {
            for att in attachments {
                let kind = att.get("kind").and_then(|v| v.as_str()).unwrap_or("");
                let name = att.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let data_base64 = att.get("data_base64").and_then(|v| v.as_str());

                if kind == "file" || kind == "image" {
                    if !name.is_empty() {
                        if let Some(data_b64) = data_base64 {
                            let clean = if let Some(pos) = data_b64.find(',') {
                                &data_b64[pos + 1..]
                            } else {
                                data_b64
                            };
                            use base64::{Engine as _, engine::general_purpose};
                            if let Ok(bytes) = general_purpose::STANDARD.decode(clean.trim()) {
                                let target_file = workdir.join(name);
                                if let Err(e) = std::fs::write(&target_file, &bytes) {
                                    log::error!("[workflow] Failed to write attachment file {}: {}", name, e);
                                } else {
                                    log::info!("[workflow] Saved attachment {} to workspace root: {:?}", name, target_file);
                                }

                                let attachments_dir = workdir.join(".flock").join("attachments").join(&thread_id_val);
                                if let Err(e) = std::fs::create_dir_all(&attachments_dir) {
                                    log::error!("[workflow] Failed to create attachments dir: {}", e);
                                }
                                let target_in_attachments = attachments_dir.join(name);
                                if let Err(e) = std::fs::write(&target_in_attachments, &bytes) {
                                    log::error!("[workflow] Failed to write file to attachments dir: {}", e);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let attachments_list = input.as_ref()
        .and_then(|inp| inp.get("attachments").and_then(|v| v.as_array()))
        .cloned()
        .unwrap_or_default();

    // 6. 实例化 Sink & Context
    let accumulated_text = Arc::new(Mutex::new(String::new()));
    let accumulated_thinking = Arc::new(Mutex::new(String::new()));

    let sink = Arc::new(TauriWorkflowSink {
        app: app.clone(),
        workflow_id: workflow_id.clone(),
        thread_id: thread_id_val.clone(),
        accumulated_text: accumulated_text.clone(),
        accumulated_thinking: accumulated_thinking.clone(),
        events_log: Arc::new(Mutex::new(Vec::new())),
        last_text_emit: Arc::new(Mutex::new(std::time::Instant::now())),
        pending_text: Arc::new(Mutex::new((String::new(), String::new()))),
        pending_thinking: Arc::new(Mutex::new((String::new(), String::new()))),
    });

    // 动态加载所有 skills 并注册 SkillTool 供工作流使用
    let mut raw_paths: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(rows) = sqlx::query("SELECT path FROM imported_skill")
        .fetch_all(db.pool())
        .await
    {
        for row in rows {
            if let Ok(path_str) = row.try_get::<String, _>("path") {
                raw_paths.push(std::path::PathBuf::from(path_str));
            }
        }
    }

    let extra_dirs: Vec<String> = db
        .get_config("extra_skill_dirs")
        .await
        .unwrap_or_default();
    for d in extra_dirs {
        raw_paths.push(std::path::PathBuf::from(d));
    }

    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) { return Ok(()); }
    let skills = flock_skills::loader::load_all_skills(&workdir, &[], false, None, &raw_paths).await;
    let mut tools_reg = all_tools().registry;
    if !skills.is_empty() {
        let checker = flock_skills::permissions::SkillPermissionChecker::new(
            config.tools.skills.deny.clone(),
            config.tools.skills.allow.clone(),
            config.tools.auto_approve,
        );
        let skill_tool = flock_agent::tools::skill::SkillTool::new(
            std::sync::Arc::new(skills),
            workdir.to_string_lossy().to_string(),
            checker,
        );
        tools_reg.register(Box::new(skill_tool));
    }
    let tools = Arc::new(tools_reg);

    let use_draft_val = use_draft.unwrap_or(false);
    let config_to_run = if use_draft_val {
        &wf_record.config
    } else if wf_record.published_config.get("nodes").and_then(|n| n.as_array()).map(|a| !a.is_empty()).unwrap_or(false) {
        &wf_record.published_config
    } else {
        &wf_record.config
    };

    // Extract env_vars from workflow config metadata
    let env_vars: HashMap<String, JsonValue> = config_to_run
        .get("metadata")
        .and_then(|m| m.get("env_vars"))
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let approval_manager = agent_state.lock().await.approval_manager.clone();

    let ctx = Arc::new(WorkflowNodeContext {
        provider: provider.clone(),
        model_factory,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
        env_vars,
        workflow_id: workflow_id.clone(),
        approval_manager: approval_manager.clone(),
        cancel_flag: cancel_flag.clone(),
        has_error: Arc::new(std::sync::Mutex::new(None)),
    });

    let workflow_emitter = Arc::new(crate::ipc::emitter::TauriProtocolEmitter::new(app.clone(), thread_id_val.clone()));
    flock_tools::init_global_emitter(&thread_id_val, workflow_emitter.clone());
    flock_tools::init_global_approval_manager(&thread_id_val, ctx.approval_manager.clone());

    // 6. 构建 Graph
    let graph = build_workflow_graph(config_to_run, ctx.clone(), checkpointer)
        .map_err(|e| e.to_string())?;

    // 7. 配置 thread_id
    let mut config = RunnableConfig::default();
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": thread_id_val }),
    );

    // 8. 决定初始输入（是全新启动还是 resume）
    let mut input_msg = String::new();
    let initial_input = if let Some(res_val) = resume_value.clone() {
        if let Some(choice) = res_val.get("choice").and_then(|v| v.as_str()) {
            if let Some(feedback) = res_val.get("feedback").and_then(|v| v.as_str()) {
                input_msg = format!("Choice: {}\nFeedback: {}", choice, feedback);
            } else {
                input_msg = format!("Choice: {}", choice);
            }
        } else {
            input_msg = res_val.to_string();
        }
        let cmd = langgraph::types::Command::resume(res_val);
        serde_json::to_value(cmd).map_err(|e| e.to_string())?
    } else {
        let mut start_outputs = serde_json::json!({});

        if let Some(ref inp_val) = input {
            if inp_val.is_object() {
                start_outputs = inp_val.clone();
                if let Some(q) = inp_val.get("query").and_then(|v| v.as_str()) {
                    input_msg = q.to_string();
                } else if let Some(q) = inp_val.get("text").and_then(|v| v.as_str()) {
                    input_msg = q.to_string();
                }
            } else if let Some(inp_str) = inp_val.as_str() {
                if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(inp_str) {
                    if parsed_json.is_object() {
                        start_outputs = parsed_json.clone();
                        if let Some(q) = parsed_json.get("query").and_then(|v| v.as_str()) {
                            input_msg = q.to_string();
                        }
                    } else {
                        input_msg = inp_str.to_string();
                        start_outputs["query"] = serde_json::Value::String(inp_str.to_string());
                    }
                } else {
                    input_msg = inp_str.to_string();
                    start_outputs["query"] = serde_json::Value::String(inp_str.to_string());
                }
            } else {
                input_msg = inp_val.to_string();
                start_outputs["query"] = inp_val.clone();
            }
        }

        let start_node_id = wf_record.config
            .get("nodes")
            .and_then(|v| v.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|n| n.get("type").and_then(|t| t.as_str()) == Some("start"))
                    .and_then(|n| n.get("id").and_then(|i| i.as_str()))
            })
            .unwrap_or("start")
            .to_string();

        let mut node_outputs = serde_json::json!({});
        node_outputs[&start_node_id] = start_outputs.clone();
        if start_node_id != "start" {
            node_outputs["start"] = start_outputs;
        }

        serde_json::json!({
            "input_msg": input_msg.clone(),
            "messages": [],
            "node_outputs": node_outputs,
            "current_node": "",
            "quit_requested": false,
            "env_vars": {},
        })
    };

    // 9. 启动后台 Tokio 任务
    let app_clone = app.clone();
    let workflow_id_clone = workflow_id.clone();
    let execution_manager_clone = execution_manager.inner().clone();
    let db_for_task = db.inner().clone();
    let thread_id_val_clone = thread_id_val.clone();

    let cancel_flag_for_run = cancel_flag.clone();
    let join_handle = tokio::spawn(async move {
        if cancel_flag_for_run.load(std::sync::atomic::Ordering::SeqCst) {
            return;
        }
        let start_ts = chrono::Utc::now().timestamp_millis();
        sink.push_event(serde_json::json!({
            "type": "info",
            "content": "🚀 Workflow started...",
            "timestamp": start_ts
        }));
        if !input_msg.is_empty() {
            sink.push_event(serde_json::json!({
                "type": "user",
                "content": input_msg.clone(),
                "timestamp": start_ts + 1
            }));
        }

        let _ = app_clone.emit("workflow-event", serde_json::json!({
            "type": "workflow_start",
            "workflow_id": workflow_id_clone,
            "thread_id": thread_id_val_clone.clone(),
        }));

        let thread_id_val_for_scope = thread_id_val_clone.clone();
        let _ = flock_core::CURRENT_SESSION_ID.scope(thread_id_val_for_scope, async {
            let mut astream = graph.astream(&initial_input, &config, vec![StreamMode::Updates]);
            // Drive the stream to completion. We intentionally do NOT emit a workflow_progress
            // event for every update — on macOS, each app.emit() must dispatch to the main thread
            // via mach port, and emitting every single graph step floods the run loop, causing
            // IMKCFRunLoopWakeUpReliable errors that freeze the entire UI.
            // Fine-grained events (node_start, node_done, text_delta, etc.) are emitted by the
            // WorkflowSink callbacks, which are already throttled.
            while let Some(_part) = astream.next().await {
                // intentionally empty — sink callbacks handle all UI events
            }
        }).await;

        // astream 结束，查看当前的最新的 snapshot 以确定状态
        match graph.get_state(&config) {
            Ok(snapshot) => {
                if !snapshot.interrupts.is_empty() {
                    // 有打断事件（例如 Human 节点）
                    let first_interrupt = snapshot.interrupts.into_iter().next().unwrap();
                    let _ = app_clone.emit("workflow-event", serde_json::json!({
                        "type": "workflow_interrupted",
                        "workflow_id": workflow_id_clone,
                        "thread_id": thread_id_val_clone.clone(),
                        "interrupt": first_interrupt,
                    }));
                } else if let Some(err_msg) = ctx.has_error.lock().ok().and_then(|guard| guard.clone()) {
                    let _ = app_clone.emit("workflow-event", serde_json::json!({
                        "type": "workflow_error",
                        "workflow_id": workflow_id_clone,
                        "thread_id": thread_id_val_clone.clone(),
                        "error": err_msg,
                    }));
                } else {
                    let end_ts = chrono::Utc::now().timestamp_millis();
                    sink.push_event(serde_json::json!({
                        "type": "info",
                        "content": "🎉 Workflow execution completed successfully.",
                        "timestamp": end_ts
                    }));
                    // 顺利执行结束
                    let _ = app_clone.emit("workflow-event", serde_json::json!({
                        "type": "workflow_done",
                        "workflow_id": workflow_id_clone,
                        "thread_id": thread_id_val_clone.clone(),
                        "node_outputs": snapshot.values.get("node_outputs"),
                    }));
                }
            }
            Err(e) => {
                let _ = app_clone.emit("workflow-event", serde_json::json!({
                    "type": "workflow_error",
                    "workflow_id": workflow_id_clone,
                    "thread_id": thread_id_val_clone.clone(),
                    "error": format!("Failed to retrieve graph snapshot: {}", e),
                }));
            }
        }

        // 保存消息到数据库，以供下次加载历史对话
        let mut final_text = accumulated_text.lock().unwrap().clone();
        let final_thinking = accumulated_thinking.lock().unwrap().clone();

        if final_text.is_empty() {
            if let Ok(snapshot) = graph.get_state(&config) {
                if let Some(outputs) = snapshot.values.get("node_outputs").and_then(|o| o.as_object()) {
                    for (node_id, output) in outputs {
                        if node_id.starts_with("answer") {
                            if let Some(txt) = output.as_str() {
                                final_text = txt.to_string();
                            } else if let Some(txt) = output.get("response").and_then(|v| v.as_str()) {
                                final_text = txt.to_string();
                            } else if let Some(txt) = output.get("answer").and_then(|v| v.as_str()) {
                                final_text = txt.to_string();
                            }
                        }
                    }
                    if final_text.is_empty() {
                        for (_node_id, output) in outputs {
                            if let Some(txt) = output.get("response").and_then(|v| v.as_str()) {
                                final_text = txt.to_string();
                                break;
                            } else if let Some(txt) = output.get("answer").and_then(|v| v.as_str()) {
                                final_text = txt.to_string();
                                break;
                            }
                        }
                    }
                }
            }
        }

        if !input_msg.is_empty() || !final_text.is_empty() {
            let thread_id_val_clone_inner = thread_id_val_clone.clone();
            let input_msg_clone = input_msg.clone();
            let final_text_clone = final_text.clone();
            let final_thinking_clone = final_thinking.clone();
            let provider_for_summary = provider.clone();
            let attachments_clone = attachments_list.clone();

            tokio::spawn(async move {
                let existing_row: Option<(String, String)> = sqlx::query_as(
                    "SELECT summary, messages FROM session_metadata WHERE thread_id = ?1"
                )
                .bind(&thread_id_val_clone_inner)
                .fetch_optional(db_for_task.pool())
                .await
                .unwrap_or(None);

                let (existing_summary, _existing_messages_str) = match existing_row {
                    Some((sum, msgs)) => (sum, Some(msgs)),
                    None => (String::new(), None),
                };

                let mut db_messages: Vec<serde_json::Value> = Vec::new();

                if !input_msg_clone.is_empty() || !attachments_clone.is_empty() {
                    let mut content_blocks = Vec::new();
                    if !input_msg_clone.is_empty() {
                        content_blocks.push(serde_json::json!({
                            "type": "text",
                            "text": input_msg_clone
                        }));
                    }
                    for att in &attachments_clone {
                        let kind = att.get("kind").and_then(|v| v.as_str()).unwrap_or("");
                        if kind == "image" {
                            let name = att.get("name").and_then(|v| v.as_str()).unwrap_or("");
                            if !name.is_empty() {
                                let relative_path = std::path::Path::new(".flock")
                                    .join("attachments")
                                    .join(&thread_id_val_clone_inner)
                                    .join(name)
                                    .to_string_lossy()
                                    .to_string();
                                let mime_type = att.get("mime_type").and_then(|v| v.as_str()).unwrap_or("image/png");
                                content_blocks.push(serde_json::json!({
                                    "type": "image",
                                    "media_type": mime_type,
                                    "data": relative_path
                                }));
                            }
                        }
                    }
                    if !content_blocks.is_empty() {
                        db_messages.push(serde_json::json!({
                            "role": "user",
                            "content": content_blocks,
                            "timestamp": chrono::Utc::now().to_rfc3339()
                        }));
                    }
                }

                if !final_text_clone.is_empty() || !final_thinking_clone.is_empty() {
                    let mut content_blocks = Vec::new();
                    if !final_thinking_clone.is_empty() {
                        content_blocks.push(serde_json::json!({
                            "type": "thinking",
                            "thinking": final_thinking_clone
                        }));
                    }
                    if !final_text_clone.is_empty() {
                        content_blocks.push(serde_json::json!({
                            "type": "text",
                            "text": final_text_clone
                        }));
                    }
                    db_messages.push(serde_json::json!({
                        "role": "assistant",
                        "content": content_blocks,
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    }));
                }

                let enable_summary: Option<bool> = db_for_task.get_config("enable_title_summary").await;
                
                let is_placeholder = |s: &str| {
                    let s = s.trim();
                    if s.starts_with("对话") {
                        let rest = s.strip_prefix("对话").unwrap().trim();
                        if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                            return true;
                        }
                    }
                    if s.starts_with("Session") {
                        let rest = s.strip_prefix("Session").unwrap().trim();
                        if !rest.is_empty() && (rest.chars().all(|c| c.is_ascii_digit() || c == '_' || c == '-') || rest.starts_with("conv_")) {
                            return true;
                        }
                    }
                    false
                };

                let messages_for_summary: Vec<flock_core::types::message::Message> = db_messages
                    .iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect();

                let mut updated_title = None;

                if enable_summary.unwrap_or(false) {
                    let protocol_emitter_for_summary: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter> = Arc::new(crate::ipc::emitter::TauriProtocolEmitter::new(app_clone.clone(), thread_id_val_clone_inner.clone()));
                    if let Err(e) = flock_agent::engine::summary::run_background_summary(
                        db_for_task.clone(),
                        thread_id_val_clone_inner.clone(),
                        messages_for_summary,
                        provider_for_summary,
                        Some(protocol_emitter_for_summary),
                    ).await {
                        log::warn!("[workflow summary] Background auto summary failed: {}", e);
                    }
                } else if is_placeholder(&existing_summary) {
                    let mut default_sum = input_msg_clone.clone();
                    if !default_sum.is_empty() {
                        if default_sum.chars().count() > 80 {
                            let truncated: String = default_sum.chars().take(77).collect();
                            default_sum = format!("{}...", truncated);
                        }
                        
                        let _ = sqlx::query(
                            "UPDATE session_metadata SET summary = ?1 WHERE thread_id = ?2"
                        )
                        .bind(&default_sum)
                        .bind(&thread_id_val_clone_inner)
                        .execute(db_for_task.pool())
                        .await;

                        updated_title = Some(default_sum);
                    }
                }

                let updated_at = chrono::Utc::now().to_rfc3339();

                let _ = sqlx::query(
                    "UPDATE session_metadata SET updated_at = ?1 WHERE thread_id = ?2"
                )
                .bind(&updated_at)
                .bind(&thread_id_val_clone_inner)
                .execute(db_for_task.pool())
                .await;

                if let Some(title) = updated_title {
                    let title_updated_event = serde_json::json!({
                        "type": "title_updated",
                        "thread_id": thread_id_val_clone_inner.clone(),
                        "title": title,
                    });
                    let _ = app_clone.emit("agent-event", serde_json::to_string(&title_updated_event).unwrap_or_default());
                }
            });
        }

        flock_tools::unregister_global_emitter(&thread_id_val_clone);
        flock_tools::unregister_global_approval_manager(&thread_id_val_clone);
        execution_manager_clone.unregister_task(&workflow_id_clone).await;
    });

    // 10. 存储 JoinHandle
    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
        join_handle.abort();
    } else {
        execution_manager.register_task(workflow_id, join_handle, cancel_flag_clone, is_running).await;
    }

    Ok(())
}

/// 停止工作流
#[tauri::command]
pub async fn stop_workflow(
    execution_manager: State<'_, Arc<ExecutionManager>>,
    workflow_id: String,
) -> Result<(), String> {
    execution_manager.cancel_task(&workflow_id).await;
    Ok(())
}
