use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::{AppHandle, State, Emitter};
use serde_json::Value as JsonValue;
use tokio_stream::StreamExt;

use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use langgraph::checkpoint::BaseCheckpointSaver;
use langgraph::checkpoint::InMemorySaver;
use langgraph::prebuilt::BaseChatModel;

use flock_workflow::{build_debug_node_graph, WorkflowNodeContext};
use flock_core::model_factory::{CachedModelFactory, ModelFactory};
use flock_tools::all_tools;
use crate::SharedDbManager;
use crate::commands::SharedAgentState;
use super::exec::TauriWorkflowSink;

/// 调试单个节点（独立执行，不走完整图）
#[tauri::command]
pub async fn debug_node(
    app: AppHandle,
    db: State<'_, SharedDbManager>,
    agent_state: State<'_, SharedAgentState>,
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
        events_log: Arc::new(Mutex::new(Vec::new())),
    });
    let tools = Arc::new(all_tools().registry);

    let env_vars: HashMap<String, JsonValue> = wf_record.config
        .get("metadata")
        .and_then(|m| m.get("env_vars"))
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let approval_manager = agent_state.lock().await.approval_manager.clone();

    let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        model_factory,
        tools,
        db: db.inner().clone(),
        sink: sink.clone(),
        debug_mode: true,
        env_vars,
        workflow_id: workflow_id.clone(),
        approval_manager,
        cancel_flag,
        has_error: Arc::new(std::sync::Mutex::new(None)),
    });

    // 为调试节点默认切换至专属的 debug 工作区，确保内置工具可以读写文件且不污染其他项目
    let debug_dir = flock_core::config::db_path::workspace_root().join("debug");
    if !debug_dir.exists() {
        let _ = std::fs::create_dir_all(&debug_dir);
    }
    if debug_dir.exists() {
        flock_tools::init_workspace_dir(&format!("debug:{}:{}", workflow_id, node_id), debug_dir.clone());
        if let Err(e) = std::env::set_current_dir(&debug_dir) {
            log::warn!("[debug_node] Failed to set current dir to {:?}: {}", debug_dir, e);
        } else {
            log::info!("[debug_node] Successfully set current dir and initialized debug workspace to {:?}", debug_dir);
        }
    }

    let graph = build_debug_node_graph(&wf_record.config, &node_id, ctx.clone(), checkpointer)
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
                if let Some(err_msg) = ctx.has_error.lock().ok().and_then(|guard| guard.clone()) {
                    let _ = app_clone.emit("workflow-event", serde_json::json!({
                        "type": "debug_error",
                        "workflow_id": workflow_id,
                        "node_id": node_id,
                        "error": err_msg,
                    }));
                } else {
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
