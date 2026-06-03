use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use anyhow::Result;
use tokio::sync::Mutex;

use crate::agent_setup::{AgentBuilder, AssistantOverrides};
use crate::sinks::OutputSink;
use flock_core::config::settings::{CliArgs, Config};
use flock_core::db::DbManager;
use crate::session_host::state::{AgentState, ActiveSession, SessionMetadata};

/// 辅助函数：根据当前会话配置和环境构建 AgentEngine
async fn build_session_engine(
    db_manager: Arc<DbManager>,
    workdir: PathBuf,
    session_id: Option<String>,
    assistant_id: Option<String>,
    extra_args: Vec<String>,
    approval_manager: Arc<flock_core::ipc_interface::approval::ToolApprovalManager>,
    protocol_emitter: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter + Send + Sync>,
    output: Arc<dyn OutputSink + Send + Sync>,
) -> Result<(crate::engine::AgentEngine, bool, bool)> {
    let mut provider = None;
    let mut api_key = None;
    let mut project_dir = None;

    let mut iter = extra_args.iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--provider" => provider = iter.next().cloned(),
            "--api-key" => api_key = iter.next().cloned(),
            "--project-dir" => project_dir = iter.next().map(PathBuf::from),
            _ => {}
        }
    }

    let cli_args = CliArgs {
        provider,
        api_key,
        base_url: None,
        model: None,
        max_tokens: None,
        max_turns: None,
        system_prompt: None,
        auto_approve: false,
        project_dir,
    };

    if std::env::current_dir().map(|d| d != workdir).unwrap_or(true) {
        let _ = std::env::set_current_dir(&workdir);
    }

    let mut config = Config::resolve_from_db(&cli_args, db_manager.clone()).await?;

    let mut has_session_model_override = false;
    if let Some(ref sid) = session_id {
        let row = sqlx::query("SELECT provider, model FROM session_metadata WHERE thread_id = ?1")
            .bind(sid)
            .fetch_optional(db_manager.pool())
            .await
            .unwrap_or(None);

        if let Some(r) = row {
            use sqlx::Row;
            let prov: String = r.get("provider");
            let model: String = r.get("model");
            if !prov.is_empty() && !model.is_empty() {
                let model_override = format!("{}:{}", prov, model);
                if let Err(e) = config.apply_assistant_model_override(&model_override).await {
                    log::error!("Failed to apply session model override: {}", e);
                } else {
                    log::info!(
                        "Session overrides model to: {} (provider: {})",
                        config.model,
                        config.provider_label
                    );
                    has_session_model_override = true;
                }
            }
        }
    }

    log::info!(
        "Resolved config: provider={}, model={}, base_url={}",
        config.provider_label,
        config.model,
        config.base_url
    );

    flock_tools::init_global_emitter(protocol_emitter.clone());
    flock_tools::init_global_approval_manager(approval_manager.clone());

    let mut bootstrap = AgentBuilder::new(config.clone(), workdir.to_string_lossy(), output.clone());

    if let Some(ref asst_id) = assistant_id {
        match db_manager.get_assistant(asst_id).await {
            Ok(Some(asst)) => {
                log::info!(
                    "Applying assistant overrides: name={:?}, tools={:?}, skills={:?}",
                    asst.name, asst.tools, asst.skills
                );
                let enabled_tools: Vec<String> = asst
                    .tools
                    .into_iter()
                    .filter(|t| !asst.disabled_tools.contains(t))
                    .collect();
                let overrides = AssistantOverrides {
                    system_prompt: if asst.system_prompt.is_empty() {
                        None
                    } else {
                        Some(asst.system_prompt)
                    },
                    model: if has_session_model_override {
                        None
                    } else if asst.model.is_empty() {
                        None
                    } else {
                        Some(asst.model)
                    },
                    allowed_tool_providers: Some(enabled_tools),
                    allowed_skill_names: Some(asst.skills),
                };
                bootstrap = bootstrap.with_assistant(overrides);
            }
            Ok(None) => {
                log::warn!("Assistant '{}' not found in DB, using default config.", asst_id);
            }
            Err(e) => {
                log::error!("Failed to load assistant '{}': {}", asst_id, e);
            }
        }
    }

    let mut raw_paths: Vec<PathBuf> = Vec::new();
    if let Ok(rows) = sqlx::query("SELECT path FROM imported_skill")
        .fetch_all(db_manager.pool())
        .await
    {
        use sqlx::Row;
        for row in rows {
            if let Ok(path_str) = row.try_get::<String, _>("path") {
                raw_paths.push(PathBuf::from(path_str));
            }
        }
    }

    let extra_dirs: Vec<String> = db_manager
        .get_config("extra_skill_dirs")
        .await
        .unwrap_or_default();
    for d in extra_dirs {
        raw_paths.push(PathBuf::from(d));
    }

    if !raw_paths.is_empty() {
        bootstrap = bootstrap.add_raw_skill_paths(raw_paths);
    }
    
    let mut is_resumed = false;
    if let Some(sid_val) = &session_id {
        if let Some(db) = &config.db_manager {
            let session_mgr = db.session_manager(config.session.max_sessions);
            if let Ok(session) = session_mgr.load(sid_val).await {
                log::info!("Resuming session: {}", sid_val);
                bootstrap = bootstrap.resume(session);
                is_resumed = true;
            }
        }
    }

    let result = bootstrap.build().await?;
    let mut engine = result.engine;

    engine.set_approval_manager(approval_manager);
    engine.set_protocol_writer(protocol_emitter.clone());

    Ok((engine, is_resumed, result.has_mcp))
}

/// 启动 Agent 引擎
pub async fn start_agent(
    db_manager: Arc<DbManager>,
    state: Arc<Mutex<AgentState>>,
    workdir: PathBuf,
    session_id: Option<String>,
    assistant_id: Option<String>,
    extra_args: Vec<String>,
    protocol_emitter: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter + Send + Sync>,
    output: Arc<dyn OutputSink + Send + Sync>,
) -> Result<()> {
    let sid = session_id.clone().unwrap_or_else(|| "default".to_string());
    let approval_manager = {
        let s = state.lock().await;
        s.approval_manager.clone()
    };

    let (mut engine, is_resumed, has_mcp) = build_session_engine(
        db_manager.clone(),
        workdir.clone(),
        session_id.clone(),
        assistant_id.clone(),
        extra_args.clone(),
        approval_manager,
        protocol_emitter.clone(),
        output.clone(),
    ).await?;

    let provider_name = engine.provider_label.clone();
    if !is_resumed {
        log::info!("Initializing new session...");
        engine.init_session(&provider_name, &workdir.to_string_lossy(), session_id.as_deref()).await?;
    }

    let sid_actual = engine.current_session_id();
    log::info!("Agent ready. Session ID: {:?}", sid_actual);

    {
        let s = state.lock().await;
        let ready_event = flock_core::ipc_interface::events::ProtocolEvent::Ready {
            version: "0.1.0".to_string(),
            session_id: sid_actual.clone(),
            capabilities: flock_core::ipc_interface::events::Capabilities {
                tool_approval: true,
                thinking: engine.compat().supports_thinking(),
                effort: engine.compat().supports_effort(),
                effort_levels: engine.compat().effort_levels().to_vec(),
                modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
                current_mode: s.approval_manager.current_mode(),
                mcp: has_mcp,
            },
        };
        let _ = protocol_emitter.emit(&ready_event);
    }

    {
        let mut s = state.lock().await;
        s.metadata.insert(
            sid,
            SessionMetadata {
                workdir,
                assistant_id,
                extra_args,
            },
        );
    }

    Ok(())
}

/// 停止 Agent 运行
pub async fn stop_agent(state: Arc<Mutex<AgentState>>, session_id: Option<String>) -> Result<()> {
    let mut s = state.lock().await;
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    if let Some(active) = s.sessions.remove(&sid) {
        log::info!("Cancelling agent engine run for session: {}", sid);
        active.cancel_flag.store(true, Ordering::SeqCst);
        active.join_handle.abort();
    }
    Ok(())
}

/// 发送消息（无状态运行）
pub async fn send_message(
    state: Arc<Mutex<AgentState>>,
    session_id: Option<String>,
    msg_id: String,
    content: String,
    db_manager: Arc<DbManager>,
    protocol_emitter: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter + Send + Sync>,
    output: Arc<dyn OutputSink + Send + Sync>,
) -> Result<()> {
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    log::info!("Sending message [{}] for session {}: {}", msg_id, sid, content);

    // 1. 获取会话元数据与运行状态检查
    let (workdir, assistant_id, extra_args) = {
        let s = state.lock().await;
        if let Some(h) = s.sessions.get(&sid) {
            if h.is_running.load(Ordering::SeqCst) {
                anyhow::bail!("当前会话正在执行中，请等待回复完成后再发送消息。");
            }
        }
        if let Some(m) = s.metadata.get(&sid) {
            (m.workdir.clone(), m.assistant_id.clone(), m.extra_args.clone())
        } else {
            anyhow::bail!("会话 {} 尚未启动，请先初始化", sid);
        }
    };

    let approval_manager = {
        let s = state.lock().await;
        s.approval_manager.clone()
    };

    // 3. 构建单次运行的 Engine
    let (mut engine, _, _) = build_session_engine(
        db_manager.clone(),
        workdir,
        Some(sid.clone()),
        assistant_id,
        extra_args,
        approval_manager,
        protocol_emitter,
        output,
    ).await?;

    let is_running = Arc::new(AtomicBool::new(true));
    let cancel_flag = Arc::new(AtomicBool::new(false));
    engine.set_cancel_flag(cancel_flag.clone());

    let is_running_clone = is_running.clone();
    let cancel_flag_clone = cancel_flag.clone();
    let sid_clone = sid.clone();
    let content_clone = content.clone();
    let msg_id_clone = msg_id.clone();

    // 4. 异步拉起单次运行
    let join_handle = tokio::spawn(async move {
        let run_result = flock_core::CURRENT_SESSION_ID.scope(sid_clone.clone(), async {
            engine.run(&content_clone, &msg_id_clone).await
        }).await;

        if let Err(err) = run_result {
            if matches!(err, crate::engine::AgentError::UserAborted) || cancel_flag_clone.load(Ordering::SeqCst) {
                log::info!("Agent run for session {} aborted by user.", sid_clone);
                engine.output().emit_stream_end(&msg_id_clone, 0, 0, 0, 0, 0);
            } else {
                log::error!("Agent run error for session {}: {}", sid_clone, err);
                engine.output().emit_error(&format!("Agent 运行出错: {}", err));
            }
        }
        is_running_clone.store(false, Ordering::SeqCst);
    });

    {
        let mut s = state.lock().await;
        s.sessions.insert(
            sid,
            ActiveSession {
                join_handle,
                cancel_flag,
                is_running,
            },
        );
    }

    Ok(())
}
