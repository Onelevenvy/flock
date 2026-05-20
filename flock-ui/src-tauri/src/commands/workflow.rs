use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;
use tokio::task::JoinHandle;
use tauri::{AppHandle, State, Emitter, Manager};
use serde_json::Value as JsonValue;
use tokio_stream::StreamExt;

use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use langgraph_checkpoint::checkpoint::base::BaseCheckpointSaver;
use langgraph_checkpoint::checkpoint::memory::InMemorySaver;
use langgraph_checkpoint_sqlite::SqliteSaver;
use langgraph_prebuilt::BaseChatModel;

use flock_agent::workflow_graph::{build_workflow_graph, WorkflowNodeContext, WorkflowSink};
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
}

impl WorkflowSink for TauriWorkflowSink {
    fn emit_node_start(&self, node_id: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "node_start",
            "node_id": node_id,
        }));
    }
    fn emit_node_done(&self, node_id: &str, output: &JsonValue) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "node_done",
            "node_id": node_id,
            "output": output,
        }));
    }
    fn emit_text_delta(&self, node_id: &str, text: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "text_delta",
            "node_id": node_id,
            "text": text,
        }));
    }
    fn emit_thinking(&self, node_id: &str, text: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "thinking",
            "node_id": node_id,
            "text": text,
        }));
    }
    fn emit_error(&self, msg: &str) {
        let _ = self.app.emit("workflow-event", serde_json::json!({
            "type": "error",
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
    }).map_err(|e| e.to_string())?);

    // 4. 初始化 SQLite Checkpointer
    let db_path_str = config.db_path.to_string_lossy().to_string();
    let conn_str = format!("sqlite:{}", db_path_str);
    let checkpointer: Arc<dyn BaseCheckpointSaver> = match SqliteSaver::from_conn_string(&conn_str).await {
        Ok(saver) => {
            if saver.setup().await.is_ok() {
                Arc::new(saver)
            } else {
                Arc::new(InMemorySaver::new())
            }
        }
        Err(_) => Arc::new(InMemorySaver::new()),
    };

    // 5. 实例化 Sink & Context
    let sink = Arc::new(TauriWorkflowSink { app: app.clone() });
    let tools = Arc::new(all_tools().registry);
    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
    });

    // 6. 构建 Graph
    let graph = build_workflow_graph(&wf_record.config, ctx, checkpointer)
        .map_err(|e| e.to_string())?;

    // 7. 配置 thread_id
    let mut config = RunnableConfig::default();
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": &workflow_id }),
    );

    // 8. 决定初始输入（是全新启动还是 resume）
    let initial_input = if let Some(res_val) = resume_value {
        let cmd = langgraph::types::Command::resume(res_val);
        serde_json::to_value(cmd).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({
            "input_msg": input.unwrap_or_default(),
            "messages": [],
            "node_outputs": {},
            "current_node": "",
            "quit_requested": false,
        })
    };

    // 9. 启动后台 Tokio 任务
    let app_clone = app.clone();
    let workflow_id_clone = workflow_id.clone();
    let execution_state_clone = execution_state.inner().clone();

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
                "output": {
                    "mode": format!("{:?}", part.mode),
                    "ns": part.ns,
                    "data": part.data,
                },
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
