use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tokio::sync::mpsc;
use anyhow::Result;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use flock_agent::agent_setup::{AgentBuilder, AssistantOverrides};
use flock_agent::sinks::OutputSink;
use flock_core::config::settings::{CliArgs, Config};
use flock_core::db::DbManager;
use crate::agent::state::{AgentState, SessionCommand, SessionHandle};
use crate::agent::emitter::TauriProtocolEmitter;
use crate::agent::actor::run_session_actor;

/// 启动 Agent 引擎
pub async fn start_agent(
    app: AppHandle,
    state: Arc<Mutex<AgentState>>,
    workdir: PathBuf,
    session_id: Option<String>,
    assistant_id: Option<String>,
    extra_args: Vec<String>,
) -> Result<()> {
    let sid = session_id.clone().unwrap_or_else(|| "default".to_string());
    let force_restart = extra_args.iter().any(|arg| arg == "--force-restart");

    let db_manager: Arc<DbManager> = app.state::<Arc<DbManager>>().inner().clone();
    let max_cached: usize = db_manager.get_config("max_cached_sessions").await.unwrap_or(10);

    // 1. 检查该会话是否已经加载到内存中
    {
        let mut s = state.lock().await;
        if let Some(handle) = s.sessions.get_mut(&sid) {
            if force_restart {
                log::info!("Force restarting session {}...", sid);
                let _ = handle.tx.send(SessionCommand::Stop).await;
                s.sessions.remove(&sid);
            } else if handle.workdir == workdir && handle.assistant_id == assistant_id {
                log::info!("Agent already started for session: {}, updating last used time.", sid);
                handle.last_used = Instant::now();
                return Ok(());
            } else {
                log::info!("Session {} config changed, stopping old actor...", sid);
                let _ = handle.tx.send(SessionCommand::Stop).await;
                s.sessions.remove(&sid);
            }
        }

        // 2. 如果超出了最大缓存数限制，逐出最久未使用的闲置会话
        if s.sessions.len() >= max_cached {
            let oldest_idle_key = s.sessions.iter()
                .filter(|(_, v)| !v.is_running.load(Ordering::SeqCst))
                .min_by_key(|(_, v)| v.last_used)
                .map(|(k, _)| k.clone());

            if let Some(key_to_evict) = oldest_idle_key {
                log::info!("Evicting idle cached session {} to respect max_cached_sessions limit of {}", key_to_evict, max_cached);
                if let Some(handle) = s.sessions.remove(&key_to_evict) {
                    let _ = handle.tx.send(SessionCommand::Stop).await;
                }
            } else {
                log::warn!("Could not evict any session because all cached sessions are currently running!");
            }
        }
    }

    let mut provider = None;
    let mut api_key = None;
    let mut project_dir = None;

    let mut iter = extra_args.iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--provider" => provider = iter.next().cloned(),
            "--api-key" => api_key = iter.next().cloned(),
            "--project-dir" => project_dir = iter.next().map(PathBuf::from),
            "--force-restart" => {}
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

    let config = Config::resolve_from_db(&cli_args, db_manager.clone()).await?;

    log::info!(
        "Resolved config: provider={}, model={}, base_url={}",
        config.provider_label,
        config.model,
        config.base_url
    );

    let approval_manager = {
        let s = state.lock().await;
        s.approval_manager.clone()
    };

    let protocol_emitter = Arc::new(TauriProtocolEmitter::new(app.clone()));
    flock_tools::init_global_emitter(protocol_emitter.clone());
    flock_tools::init_global_approval_manager(approval_manager);
    let output: Arc<dyn OutputSink> = protocol_emitter.clone();

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
                    model: if asst.model.is_empty() { None } else { Some(asst.model) },
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

    let extra_dirs: Vec<String> = db_manager
        .get_config("extra_skill_dirs")
        .await
        .unwrap_or_default();
    if !extra_dirs.is_empty() {
        let raw_paths: Vec<PathBuf> = extra_dirs.into_iter().map(PathBuf::from).collect();
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

    let approval_manager = {
        let s = state.lock().await;
        s.approval_manager.clone()
    };
    engine.set_approval_manager(approval_manager);
    engine.set_protocol_writer(protocol_emitter.clone());

    let provider_name = config.provider_label.clone();
    if !is_resumed {
        log::info!("Initializing new session...");
        engine.init_session(&provider_name, &workdir.to_string_lossy(), session_id.as_deref()).await?;
    }

    let sid_actual = engine.current_session_id();
    log::info!("Agent ready. Session ID: {:?}", sid_actual);

    {
        let s = state.lock().await;
        protocol_emitter.emit_ready(
            engine.compat(),
            result.has_mcp,
            sid_actual.clone(),
            &s.approval_manager.current_mode(),
        );
    }

    let (tx, rx) = mpsc::channel(100);
    let is_running = Arc::new(AtomicBool::new(false));
    let cancel_flag = Arc::new(AtomicBool::new(false));

    engine.set_cancel_flag(cancel_flag.clone());

    let is_running_clone = is_running.clone();
    let cancel_flag_clone = cancel_flag.clone();
    let sid_str = sid.clone();
    tokio::spawn(async move {
        run_session_actor(sid_str, engine, rx, is_running_clone, cancel_flag_clone).await;
    });

    {
        let mut s = state.lock().await;
        s.sessions.insert(
            sid.clone(),
            SessionHandle {
                tx,
                workdir,
                assistant_id,
                is_running,
                cancel_flag,
                last_used: Instant::now(),
            },
        );
    }

    Ok(())
}

/// 停止 Agent
pub async fn stop_agent(state: Arc<Mutex<AgentState>>, session_id: Option<String>) -> Result<()> {
    let s = state.lock().await;
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    if let Some(handle) = s.sessions.get(&sid) {
        log::info!("Cancelling agent engine run for session: {}", sid);
        // 先触发 cancel，打断正在阻塞运行的 engine，但并不从缓存中移除，确保后续可继续交互
        handle.cancel_flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

/// 发送消息
pub async fn send_message(
    state: Arc<Mutex<AgentState>>,
    session_id: Option<String>,
    msg_id: String,
    content: String,
    app: AppHandle,
) -> Result<()> {
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    log::info!("Sending message [{}] for session {}: {}", msg_id, sid, content);

    let db_manager = app.state::<Arc<DbManager>>().inner().clone();
    let max_running: usize = db_manager.get_config("max_running_sessions").await.unwrap_or(4);

    let tx = {
        let s = state.lock().await;
        
        let running_count = s.sessions.iter()
            .filter(|(k, v)| k.as_str() != sid.as_str() && v.is_running.load(Ordering::SeqCst))
            .count();

        if running_count >= max_running {
            log::warn!("Rejected message for session {}: too many running tasks ({})", sid, running_count);
            anyhow::bail!("当前有太多会话在并发运行（最大限制为 {}），请稍等其他对话执行完毕后再试。", max_running);
        }

        if let Some(handle) = s.sessions.get(&sid) {
            if handle.is_running.load(Ordering::SeqCst) {
                anyhow::bail!("当前会话正在执行中，请等待回复完成后再发送消息。");
            }
            handle.tx.clone()
        } else {
            anyhow::bail!("会话尚未启动，请先初始化")
        }
    };

    {
        let mut s = state.lock().await;
        if let Some(handle) = s.sessions.get_mut(&sid) {
            handle.last_used = Instant::now();
        }
    }

    tx.send(SessionCommand::SendMessage { msg_id, content }).await
        .map_err(|e| anyhow::anyhow!("Failed to route message to actor: {}", e))?;

    Ok(())
}
