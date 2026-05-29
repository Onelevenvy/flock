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

use flock_agent::workflow_graph::{build_workflow_graph, build_debug_node_graph, WorkflowNodeContext, WorkflowSink};
use flock_core::model_factory::{CachedModelFactory, ModelFactory};
use flock_tools::all_tools;
use crate::SharedDbManager;
use flock_core::db::{UpsertWorkflow, WorkflowRecord};

pub struct WorkflowExecutionState {
    pub executions: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl WorkflowExecutionState {
    pub fn new() -> Self {
        Self {
            executions: Mutex::new(HashMap::new()),
        }
    }
}

struct TauriWorkflowSink {
    app: AppHandle,
    workflow_id: String,
    thread_id: String,
    accumulated_text: Arc<Mutex<String>>,
    accumulated_thinking: Arc<Mutex<String>>,
}

impl WorkflowSink for TauriWorkflowSink {
    fn emit_node_start(&self, node_id: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "node_start",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
        }));
    }
    fn emit_node_done(&self, node_id: &str, output: &JsonValue) {
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
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "thinking",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "node_id": node_id,
            "text": text,
        }));
    }
    fn emit_error(&self, msg: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "error",
            "workflow_id": &self.workflow_id,
            "thread_id": &self.thread_id,
            "message": msg,
        }));
    }
}

/// 列出所有工作流
#[tauri::command]
pub async fn list_workflows(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<WorkflowRecord>, String> {
    db.list_workflows().await.map_err(|e| e.to_string())
}

/// 获取单个工作流
#[tauri::command]
pub async fn get_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<Option<WorkflowRecord>, String> {
    db.get_workflow(&id).await.map_err(|e| e.to_string())
}

/// 创建工作流
#[tauri::command]
pub async fn create_workflow(
    db: State<'_, SharedDbManager>,
    input: UpsertWorkflow,
) -> Result<WorkflowRecord, String> {
    db.create_workflow(&input).await.map_err(|e| e.to_string())
}

/// 更新工作流配置（节点、边等）
#[tauri::command]
pub async fn update_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
    input: UpsertWorkflow,
) -> Result<WorkflowRecord, String> {
    db.update_workflow(&id, &input)
        .await
        .map_err(|e| e.to_string())
}

/// 删除工作流
#[tauri::command]
pub async fn delete_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_workflow(&id).await.map_err(|e| e.to_string())
}

/// 运行工作流（支持新运行或 resume 被打断的 review 节点）
#[tauri::command]
pub async fn run_workflow(
    app: AppHandle,
    db: State<'_, SharedDbManager>,
    execution_state: State<'_, Arc<WorkflowExecutionState>>,
    workflow_id: String,
    input: Option<String>,
    resume_value: Option<JsonValue>,
    thread_id: Option<String>,
) -> Result<(), String> {
    // 1. 获取工作流配置
    let wf_record = db.get_workflow(&workflow_id).await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow {} not found", workflow_id))?;

    // 2. 如果之前已经在运行，先取消之前的实例
    {
        let mut executions = execution_state.executions.lock().unwrap();
        if let Some(handle) = executions.remove(&workflow_id) {
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

    // 5. 初始化 Checkpointer（调试模式下使用 InMemorySaver，普通对话使用 SqliteSaver）
    let is_debug_run = thread_id.as_ref().map(|tid| tid.contains("_run_") || tid.starts_with("debug:")).unwrap_or(false);

    let checkpointer: Arc<dyn BaseCheckpointSaver> = if is_debug_run {
        Arc::new(InMemorySaver::new())
    } else {
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

    // 6. 实例化 Sink & Context
    let accumulated_text = Arc::new(Mutex::new(String::new()));
    let accumulated_thinking = Arc::new(Mutex::new(String::new()));

    let sink = Arc::new(TauriWorkflowSink {
        app: app.clone(),
        workflow_id: workflow_id.clone(),
        thread_id: thread_id_val.clone(),
        accumulated_text: accumulated_text.clone(),
        accumulated_thinking: accumulated_thinking.clone(),
    });
    let tools = Arc::new(all_tools().registry);

    // Extract env_vars from workflow config metadata
    let env_vars: HashMap<String, JsonValue> = wf_record.config
        .get("metadata")
        .and_then(|m| m.get("env_vars"))
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        model_factory,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
        env_vars,
        workflow_id: workflow_id.clone(),
    });

    // 6. 构建 Graph
    let graph = build_workflow_graph(&wf_record.config, ctx, checkpointer)
        .map_err(|e| e.to_string())?;

    // 7. 配置 thread_id
    let mut config = RunnableConfig::default();
    let thread_id_val = thread_id.unwrap_or_else(|| workflow_id.clone());
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": thread_id_val }),
    );

    // 自动为工作流切换至当前激活工作空间的 working directory，解决不能选择工作空间的问题
    let row = sqlx::query("SELECT workspace_id, cwd FROM session_metadata WHERE thread_id = ?1")
        .bind(&thread_id_val)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        let workspace_id: String = r.get("workspace_id");
        let cwd: String = r.get("cwd");
        let workdir = if !cwd.is_empty() {
            std::path::PathBuf::from(cwd)
        } else if !workspace_id.is_empty() {
            flock_core::config::db_path::workspace_root().join(workspace_id)
        } else {
            std::path::PathBuf::new()
        };
        if workdir.exists() {
            if let Err(e) = std::env::set_current_dir(&workdir) {
                log::warn!("Failed to set current dir to {:?}: {}", workdir, e);
            } else {
                log::info!("Successfully set current dir to {:?}", workdir);
            }
        }
    }

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
        let _ = app_clone.emit("workflow-event", serde_json::json!({
            "type": "workflow_start",
            "workflow_id": workflow_id_clone,
        }));

        let mut astream = graph.astream(&initial_input, &config, vec![StreamMode::Updates]);
        while let Some(part) = astream.next().await {
            log::info!("[workflow] step update: {:?}", part);
            let _ = app_clone.emit("workflow-event", serde_json::json!({
                "type": "workflow_progress",
                "workflow_id": workflow_id_clone,
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
                        "interrupt": first_interrupt,
                    }));
                } else {
                    // 顺利执行结束
                    let _ = app_clone.emit("workflow-event", serde_json::json!({
                        "type": "workflow_done",
                        "workflow_id": workflow_id_clone,
                        "node_outputs": snapshot.values.get("node_outputs"),
                    }));
                }
            }
            Err(e) => {
                let _ = app_clone.emit("workflow-event", serde_json::json!({
                    "type": "workflow_error",
                    "workflow_id": workflow_id_clone,
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

            tokio::spawn(async move {
                let existing_messages_str: Option<String> = sqlx::query_scalar(
                    "SELECT messages FROM session_metadata WHERE thread_id = ?1"
                )
                .bind(&thread_id_val_clone_inner)
                .fetch_optional(db_for_task.pool())
                .await
                .unwrap_or(None);

                let mut db_messages: Vec<serde_json::Value> = existing_messages_str
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or_default();

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

                let messages_json = serde_json::to_string(&db_messages).unwrap_or_else(|_| "[]".to_string());
                let msg_count = db_messages.len();
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
            });
        }

        let mut executions = execution_state_clone.executions.lock().unwrap();
        executions.remove(&workflow_id_clone);
    });

    // 10. 存储 JoinHandle
    {
        let mut executions = execution_state.executions.lock().unwrap();
        executions.insert(workflow_id, join_handle);
    }

    Ok(())
}

/// 停止工作流
#[tauri::command]
pub async fn stop_workflow(
    execution_state: State<'_, Arc<WorkflowExecutionState>>,
    workflow_id: String,
) -> Result<(), String> {
    let mut executions = execution_state.executions.lock().unwrap();
    if let Some(handle) = executions.remove(&workflow_id) {
        handle.abort();
    }
    Ok(())
}

/// 调试单个节点（独立执行，不走完整图）
#[tauri::command]
pub async fn debug_node(
    app: AppHandle,
    db: State<'_, SharedDbManager>,
    workflow_id: String,
    node_id: String,
    input: Option<String>,
) -> Result<(), String> {
    let wf_record = db.get_workflow(&workflow_id).await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow {} not found", workflow_id))?;

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
                    Err(e) => log::warn!("[debug_node] Failed to list models for provider {}: {}", p.id, e),
                }
            }
        }
        Err(e) => log::warn!("[debug_node] Failed to list providers: {}", e),
    }
    let model_factory: Arc<dyn ModelFactory> = Arc::new(CachedModelFactory::new(
        model_registry,
        config.provider.to_string(),
        config.api_key.clone(),
        if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
    ));

    let checkpointer: Arc<dyn BaseCheckpointSaver> = Arc::new(InMemorySaver::new());

    let sink = Arc::new(TauriWorkflowSink {
        app: app.clone(),
        workflow_id: format!("{}:debug:{}", workflow_id, node_id),
        thread_id: format!("debug:{}:{}", workflow_id, node_id),
        accumulated_text: Arc::new(Mutex::new(String::new())),
        accumulated_thinking: Arc::new(Mutex::new(String::new())),
    });
    let tools = Arc::new(all_tools().registry);

    let env_vars: HashMap<String, JsonValue> = wf_record.config
        .get("metadata")
        .and_then(|m| m.get("env_vars"))
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        model_factory,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
        env_vars,
        workflow_id: workflow_id.clone(),
    });

    let graph = build_debug_node_graph(&wf_record.config, &node_id, ctx, checkpointer)
        .map_err(|e| e.to_string())?;

    let mut config = RunnableConfig::default();
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": format!("debug:{}:{}", workflow_id, node_id) }),
    );

    let mut initial_input = serde_json::json!({
        "input_msg": "",
        "messages": [],
        "node_outputs": {},
        "current_node": "",
        "quit_requested": false,
        "env_vars": {},
    });

    if let Some(ref inp_str) = input {
        if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(inp_str) {
            if parsed_json.is_object() {
                if let Some(msg) = parsed_json.get("input_msg") {
                    initial_input["input_msg"] = msg.clone();
                }
                if let Some(outputs) = parsed_json.get("node_outputs") {
                    initial_input["node_outputs"] = outputs.clone();
                }
                if let Some(envs) = parsed_json.get("env_vars") {
                    initial_input["env_vars"] = envs.clone();
                }
            } else {
                initial_input["input_msg"] = serde_json::Value::String(inp_str.clone());
            }
        } else {
            initial_input["input_msg"] = serde_json::Value::String(inp_str.clone());
        }
    }

    let app_clone = app.clone();
    let debug_id = format!("{}:debug:{}", workflow_id, node_id);

    tokio::spawn(async move {
        let _ = app_clone.emit("workflow-event", serde_json::json!({
            "type": "debug_start",
            "workflow_id": workflow_id,
            "node_id": node_id,
        }));

        let mut astream = graph.astream(&initial_input, &config, vec![StreamMode::Updates]);
        while let Some(part) = astream.next().await {
            let _ = app_clone.emit("workflow-event", serde_json::json!({
                "type": "debug_progress",
                "workflow_id": workflow_id,
                "node_id": node_id,
                "output": part,
            }));
        }

        match graph.get_state(&config) {
            Ok(snapshot) => {
                let node_outputs = snapshot.values.get("node_outputs");
                let mut specific_output = serde_json::Value::Null;
                if let Some(outputs) = node_outputs.and_then(|o| o.as_object()) {
                    let debug_key = format!("__debug_{}", node_id);
                    if let Some(out) = outputs.get(&debug_key) {
                        specific_output = out.clone();
                    } else if let Some(out) = outputs.get(&node_id) {
                        specific_output = out.clone();
                    }
                }
                let _ = app_clone.emit("workflow-event", serde_json::json!({
                    "type": "debug_done",
                    "workflow_id": workflow_id,
                    "node_id": node_id,
                    "output": specific_output,
                    "node_outputs": node_outputs,
                }));
            }
            Err(e) => {
                let _ = app_clone.emit("workflow-event", serde_json::json!({
                    "type": "debug_error",
                    "workflow_id": workflow_id,
                    "node_id": node_id,
                    "error": format!("Failed to retrieve debug snapshot: {}", e),
                }));
            }
        }
    });

    Ok(())
}
