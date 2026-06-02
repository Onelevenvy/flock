use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;
use sqlx::Row;
use tokio::task::JoinHandle;
use tauri::{AppHandle, State, Emitter};
use serde_json::Value as JsonValue;
use tokio_stream::StreamExt;

use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use langgraph_checkpoint::checkpoint::base::BaseCheckpointSaver;
use langgraph_checkpoint::checkpoint::memory::InMemorySaver;
use langgraph_checkpoint_sqlite::SqliteSaver;
use langgraph_prebuilt::BaseChatModel;

use flock_workflow::{build_workflow_graph, WorkflowNodeContext, WorkflowSink};
use flock_core::model_factory::{CachedModelFactory, ModelFactory};
use flock_tools::all_tools;
use crate::SharedDbManager;
use crate::commands::agent::SharedAgentState;

pub struct WorkflowExecutionState {
    pub executions: Mutex<HashMap<String, (JoinHandle<()>, Arc<std::sync::atomic::AtomicBool>)>>,
}

impl WorkflowExecutionState {
    pub fn new() -> Self {
        Self {
            executions: Mutex::new(HashMap::new()),
        }
    }
}

pub(crate) struct TauriWorkflowSink {
    pub(crate) app: AppHandle,
    pub(crate) workflow_id: String,
    pub(crate) thread_id: String,
    pub(crate) accumulated_text: Arc<Mutex<String>>,
    pub(crate) accumulated_thinking: Arc<Mutex<String>>,
    pub(crate) events_log: Arc<Mutex<Vec<JsonValue>>>,
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
        let ts = chrono::Utc::now().timestamp_millis();
        self.push_event(serde_json::json!({
            "type": "text_delta",
            "content": text,
            "nodeId": node_id,
            "timestamp": ts
        }));
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "text_delta",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
            "text": text,
        }));
    }
    fn emit_thinking(&self, node_id: &str, text: &str) {
        if let Ok(mut lock) = self.accumulated_thinking.lock() {
            lock.push_str(text);
        }
        let ts = chrono::Utc::now().timestamp_millis();
        self.push_event(serde_json::json!({
            "type": "thinking",
            "content": text,
            "nodeId": node_id,
            "timestamp": ts
        }));
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "thinking",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
            "text": text,
        }));
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
    execution_state: State<'_, Arc<WorkflowExecutionState>>,
    agent_state: State<'_, SharedAgentState>,
    workflow_id: String,
    input: Option<String>,
    resume_value: Option<JsonValue>,
    thread_id: Option<String>,
    use_draft: Option<bool>,
) -> Result<(), String> {
    // 1. 获取工作流配置
    let wf_record = db.get_workflow(&workflow_id).await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow {} not found", workflow_id))?;

    // 2. 如果之前已经在运行，先取消之前的实例
    {
        let mut executions = execution_state.executions.lock().unwrap();
        if let Some((handle, cancel_flag)) = executions.remove(&workflow_id) {
            cancel_flag.store(true, std::sync::atomic::Ordering::SeqCst);
            handle.abort();
        }
    }

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
    let model_factory: Arc<dyn ModelFactory> = Arc::new(CachedModelFactory::new(
        model_registry,
        config.provider.to_string(),
        config.api_key.clone(),
        if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
    ));

    // 5. 初始化 Checkpointer（无论是调试还是普通，都统一使用 SqliteSaver 以持久化和跨调用周期保存状态，实现连续多轮提问和完美的打断恢复）
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

    // 自动为工作流切换至当前激活工作空间的 working directory，解决不能选择工作空间的问题
    let thread_id_val = thread_id.unwrap_or_else(|| workflow_id.clone());

    // 重点：如果是全新启动工作流运行（不是 resume 打断），彻底清空 sqlite checkpointer 里旧状态 records，防止 aborted 时脏状态残留导致数据串了和参数叠加
    if resume_value.is_none() {
        log::info!("[workflow] Fresh run detected. Purging old checkpoints for thread: {}", thread_id_val);
        let _ = sqlx::query("DELETE FROM checkpoints WHERE thread_id = ?1")
            .bind(&thread_id_val)
            .execute(db.pool())
            .await;
        let _ = sqlx::query("DELETE FROM writes WHERE thread_id = ?1")
            .bind(&thread_id_val)
            .execute(db.pool())
            .await;
    }

    let mut final_workdir: Option<std::path::PathBuf> = None;
    let row = sqlx::query("SELECT workspace_id, cwd, summary FROM session_metadata WHERE thread_id = ?1")
        .bind(&thread_id_val)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        let workspace_id: String = r.get("workspace_id");
        let cwd: String = r.get("cwd");
        let existing_summary: String = r.get("summary");
        
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

        // 实时更新：如果当前是占位标题，且此次有首次输入的 input (即首句提问)，立刻将标题修改并通知前端，实现侧边栏实时改变
        if let Some(ref input_str) = input {
            if !input_str.is_empty() && (existing_summary.is_empty() || is_placeholder(&existing_summary)) {
                let mut title_to_use = input_str.clone();
                
                // 智能解包工作流首句提问 JSON 结构，提取诸如 {"query":"旅游"} 中的 "旅游" 纯文本
                if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(&title_to_use) {
                    if let Some(obj) = parsed_json.as_object() {
                        let found_val = obj.get("query")
                            .or_else(|| obj.get("q"))
                            .or_else(|| obj.get("input"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        
                        if let Some(val) = found_val {
                            title_to_use = val;
                        } else if let Some((_, first_val)) = obj.iter().next() {
                            if let Some(s) = first_val.as_str() {
                                title_to_use = s.to_string();
                            } else {
                                title_to_use = first_val.to_string();
                            }
                        }
                    }
                }

                if title_to_use.chars().count() > 80 {
                    let truncated: String = title_to_use.chars().take(77).collect();
                    title_to_use = format!("{}...", truncated);
                }
                
                let _ = sqlx::query("UPDATE session_metadata SET summary = ?1 WHERE thread_id = ?2")
                    .bind(&title_to_use)
                    .bind(&thread_id_val)
                    .execute(db.pool())
                    .await;

                let title_updated_event = serde_json::json!({
                    "type": "title_updated",
                    "thread_id": thread_id_val.clone(),
                    "title": title_to_use,
                });
                let _ = app.emit("agent-event", serde_json::to_string(&title_updated_event).unwrap_or_default()).ok();
            }
        }

        let workdir = if !cwd.is_empty() {
            std::path::PathBuf::from(cwd)
        } else if !workspace_id.is_empty() {
            flock_core::config::db_path::workspace_root().join(workspace_id)
        } else {
            std::path::PathBuf::new()
        };
        if workdir.exists() && workdir.as_os_str().len() > 0 {
            final_workdir = Some(workdir);
        }
    }

    // 调试模式或无会话绑定时的绝妙处理：退回到专属的 debug 工作区，确保不污染其他项目
    let workdir = if let Some(wd) = final_workdir {
        wd
    } else {
        let debug_dir = flock_core::config::db_path::workspace_root().join("debug");
        if !debug_dir.exists() {
            let _ = std::fs::create_dir_all(&debug_dir);
        }
        debug_dir
    };

    if workdir.exists() {
        // 同步助手处理：初始化 tools 的全局工作空间路径，让内置工具正确寻址和识别
        flock_tools::init_workspace_dir(workdir.clone());

        if let Err(e) = std::env::set_current_dir(&workdir) {
            log::warn!("Failed to set current dir to {:?}: {}", workdir, e);
        } else {
            log::info!("Successfully set current dir and initialized debug/session workspace to {:?}", workdir);
        }
    }

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
    // 优先从已发布的 published_config 中获取，如果为空（例如第一次创建还未发布过）或者明确要求使用草稿，则 fallback 到草稿 config
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

    let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();

    let ctx = Arc::new(WorkflowNodeContext {
        provider: provider.clone(),
        model_factory,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
        env_vars,
        workflow_id: workflow_id.clone(),
        approval_manager,
        cancel_flag,
    });

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

        if let Some(ref inp_str) = input {
            if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(inp_str) {
                if parsed_json.is_object() {
                    start_outputs = parsed_json.clone();
                    if let Some(q) = parsed_json.get("query").and_then(|v| v.as_str()) {
                        input_msg = q.to_string();
                    }
                } else {
                    input_msg = inp_str.clone();
                    start_outputs["query"] = serde_json::Value::String(inp_str.clone());
                }
            } else {
                input_msg = inp_str.clone();
                start_outputs["query"] = serde_json::Value::String(inp_str.clone());
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
    let execution_state_clone = execution_state.inner().clone();
    let db_for_task = db.inner().clone();
    let thread_id_val_clone = thread_id_val.clone();

    let join_handle = tokio::spawn(async move {
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

        let mut astream = graph.astream(&initial_input, &config, vec![StreamMode::Updates]);
        while let Some(part) = astream.next().await {
            log::info!("[workflow] step update: {:?}", part);
            let _ = app_clone.emit("workflow-event", serde_json::json!({
                "type": "workflow_progress",
                "workflow_id": workflow_id_clone,
                "thread_id": thread_id_val_clone.clone(),
                "output": part,
            }));
        }

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
            let msgs = sink.events_log.lock().unwrap().clone();

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

                if !input_msg_clone.is_empty() {
                    db_messages.push(serde_json::json!({
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": input_msg_clone
                            }
                        ],
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    }));
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
                    let protocol_emitter_for_summary: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter> = Arc::new(crate::agent::TauriProtocolEmitter::new(app_clone.clone()));
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

                // 重点：使用带有 __wf_native__ 标记的前端原生格式保存完整的 messages
                let wrapped = serde_json::json!({
                    "__wf_native__": true,
                    "msgs": msgs
                });
                let messages_json = serde_json::to_string(&wrapped).unwrap_or_else(|_| "{}".to_string());
                let msg_count = msgs.len();
                let updated_at = chrono::Utc::now().to_rfc3339();

                let _ = sqlx::query(
                    "UPDATE session_metadata SET messages = ?1, msg_count = ?2, updated_at = ?3 WHERE thread_id = ?4"
                )
                .bind(&messages_json)
                .bind(msg_count as i64)
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

        let mut executions = execution_state_clone.executions.lock().unwrap();
        executions.remove(&workflow_id_clone);
    });

    // 10. 存储 JoinHandle
    {
        let mut executions = execution_state.executions.lock().unwrap();
        executions.insert(workflow_id, (join_handle, cancel_flag_clone));
    }

    Ok(())
}

/// 停止工作流
#[tauri::command]
pub async fn stop_workflow(
    execution_state: State<'_, Arc<WorkflowExecutionState>>,
    workflow_id: String,
) -> Result<(), String> {
    log::info!("[workflow] stop_workflow command received for workflow_id: {}", workflow_id);
    let mut executions = execution_state.executions.lock().unwrap();
    if let Some((handle, cancel_flag)) = executions.remove(&workflow_id) {
        log::info!("[workflow] Found active execution handle for {}, aborting it...", workflow_id);
        cancel_flag.store(true, std::sync::atomic::Ordering::SeqCst);
        handle.abort();
    } else {
        log::warn!("[workflow] No active execution handle found for workflow_id: {} in executions map! Current keys: {:?}", workflow_id, executions.keys().collect::<Vec<_>>());
    }
    Ok(())
}
