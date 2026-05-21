use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tokio::sync::mpsc;

use anyhow::Result;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use flock_agent::agent_setup::{AgentBuilder, AssistantOverrides};
use flock_agent::engine::AgentEngine;
use flock_agent::sinks::OutputSink;
use flock_core::config::settings::{CliArgs, Config};
use flock_core::db::DbManager;
use flock_core::ipc_interface::approval::{ToolApprovalManager, ToolApprovalResult};
use flock_core::ipc_interface::commands::{ApprovalScope, SessionMode};
use flock_core::ipc_interface::events::{Capabilities, ErrorInfo, ProtocolEvent, Usage};
use flock_core::ipc_interface::writer::ProtocolEmitter;

/// Tauri 实现的 ProtocolEmitter & OutputSink，将事件通过 Tauri Emitter 发送给前端
pub struct TauriProtocolEmitter {
    app: AppHandle,
}

impl TauriProtocolEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn build_capabilities(
        compat: &flock_core::config::compat::ProviderCompat,
        has_mcp: bool,
        current_mode: &str,
    ) -> Capabilities {
        Capabilities {
            tool_approval: true,
            thinking: compat.supports_thinking(),
            effort: compat.supports_effort(),
            effort_levels: compat.effort_levels().to_vec(),
            modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
            current_mode: current_mode.to_string(),
            mcp: has_mcp,
        }
    }

    pub fn emit_ready(
        &self,
        compat: &flock_core::config::compat::ProviderCompat,
        has_mcp: bool,
        session_id: Option<String>,
        current_mode: &str,
    ) {
        let _ = self.emit(&ProtocolEvent::Ready {
            version: "0.1.0".to_string(),
            session_id,
            capabilities: Self::build_capabilities(compat, has_mcp, current_mode),
        });
    }

    // pub fn emit_config_changed(
    //     &self,
    //     compat: &flock_core::config::compat::ProviderCompat,
    //     has_mcp: bool,
    //     current_mode: &str,
    // ) {
    //     let _ = self.emit(&ProtocolEvent::ConfigChanged {
    //         capabilities: Self::build_capabilities(compat, has_mcp, current_mode),
    //     });
    // }
}

impl ProtocolEmitter for TauriProtocolEmitter {
    fn emit(&self, event: &ProtocolEvent) -> std::io::Result<()> {
        let json = serde_json::to_string(event).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to serialize event: {}", e),
            )
        })?;
        let _ = self.app.emit("agent-event", json);
        Ok(())
    }
}

impl OutputSink for TauriProtocolEmitter {
    fn emit_text_delta(&self, text: &str, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::TextDelta {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_thinking(&self, text: &str, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::Thinking {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_tool_call(&self, name: &str, _input: &str) {
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("Tool call: {name}"),
        });
    }

    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str) {
        let status = if is_error { "error" } else { "success" };
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("[{name} {status}] {content}"),
        });
    }

    fn emit_stream_start(&self, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::StreamStart {
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_stream_end(
        &self,
        msg_id: &str,
        _turns: usize,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_tokens: u64,
        cache_read_tokens: u64,
    ) {
        let _ = self.emit(&ProtocolEvent::StreamEnd {
            msg_id: msg_id.to_string(),
            usage: Some(Usage {
                input_tokens,
                output_tokens,
                cache_read_tokens: if cache_read_tokens > 0 {
                    Some(cache_read_tokens)
                } else {
                    None
                },
                cache_write_tokens: if cache_creation_tokens > 0 {
                    Some(cache_creation_tokens)
                } else {
                    None
                },
            }),
        });
    }

    fn emit_error(&self, msg: &str) {
        let _ = self.emit(&ProtocolEvent::Error {
            msg_id: None,
            error: ErrorInfo {
                code: "engine_error".to_string(),
                message: msg.to_string(),
                retryable: false,
            },
        });
    }

    fn emit_info(&self, msg: &str) {
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: msg.to_string(),
        });
    }
}

pub enum SessionCommand {
    SendMessage { msg_id: String, content: String },
    SetConfig {
        model: Option<String>,
        thinking: Option<String>,
        thinking_budget: Option<u32>,
        effort: Option<String>,
        compaction: Option<String>,
    },
    Stop,
}

pub struct SessionHandle {
    pub tx: mpsc::Sender<SessionCommand>,
    pub workdir: PathBuf,
    pub assistant_id: Option<String>,
    pub is_running: Arc<AtomicBool>,
    pub cancel_flag: Arc<AtomicBool>,
    pub last_used: Instant,
}

/// 全局 Agent 状态
pub struct AgentState {
    pub sessions: HashMap<String, SessionHandle>,
    pub approval_manager: Arc<ToolApprovalManager>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            approval_manager: Arc::new(ToolApprovalManager::new()),
        }
    }
}

async fn run_session_actor(
    session_id: String,
    mut engine: AgentEngine,
    mut rx: mpsc::Receiver<SessionCommand>,
    is_running: Arc<AtomicBool>,
    cancel_flag: Arc<AtomicBool>,
) {
    log::info!("Session actor started for session: {}", session_id);
    while let Some(cmd) = rx.recv().await {
        match cmd {
            SessionCommand::SendMessage { msg_id, content } => {
                is_running.store(true, Ordering::SeqCst);
                let run_result = engine.run(&content, &msg_id).await;
                if let Err(err) = run_result {
                    if matches!(err, flock_agent::engine::AgentError::UserAborted) {
                        log::info!("Agent run for session {} aborted by user.", session_id);
                        engine.output().emit_stream_end(&msg_id, 0, 0, 0, 0, 0);
                    } else {
                        log::error!("Agent run error for session {}: {}", session_id, err);
                        engine.output().emit_error(&format!("Agent 运行出错: {}", err));
                    }
                }
                is_running.store(false, Ordering::SeqCst);
            }
            SessionCommand::SetConfig { model, thinking, thinking_budget, effort, compaction } => {
                engine.apply_config_update(model, thinking, thinking_budget, effort, compaction);
            }
            SessionCommand::Stop => {
                log::info!("Stopping agent engine for session: {}...", session_id);
                cancel_flag.store(true, Ordering::SeqCst);
                engine.run_stop_hooks().await;
                break;
            }
        }
    }
    log::info!("Session actor stopped for session: {}", session_id);
}

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
                    "Applying assistant overrides: name={}, tools={:?}, skills={:?}",
                    asst.name, asst.tools, asst.skills
                );
                let overrides = AssistantOverrides {
                    system_prompt: if asst.system_prompt.is_empty() {
                        None
                    } else {
                        Some(asst.system_prompt)
                    },
                    model: if asst.model.is_empty() { None } else { Some(asst.model) },
                    allowed_tool_providers: Some(asst.tools),
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

/// 批准工具调用
pub async fn approve_tool(
    state: Arc<Mutex<AgentState>>,
    call_id: String,
    scope: String,
) -> Result<()> {
    let s = state.lock().await;
    let scope = match scope.as_str() {
        "always" => ApprovalScope::Always,
        _ => ApprovalScope::Once,
    };
    s.approval_manager.approve(&call_id, scope);
    Ok(())
}

/// 拒绝工具调用
pub async fn deny_tool(
    state: Arc<Mutex<AgentState>>,
    call_id: String,
    reason: Option<String>,
) -> Result<()> {
    let s = state.lock().await;
    s.approval_manager.resolve(
        &call_id,
        ToolApprovalResult::Denied {
            reason: reason.unwrap_or_else(|| "User denied".to_string()),
        },
    );
    Ok(())
}

/// 设置模式
pub async fn set_mode(state: Arc<Mutex<AgentState>>, mode: String) -> Result<()> {
    let s = state.lock().await;
    let mode_enum = match mode.as_str() {
        "auto_edit" => SessionMode::AutoEdit,
        "yolo" => SessionMode::Yolo,
        _ => SessionMode::Default,
    };
    s.approval_manager.set_mode(mode_enum);
    Ok(())
}

/// 更新配置
pub async fn set_config(
    state: Arc<Mutex<AgentState>>,
    session_id: Option<String>,
    model: Option<String>,
    thinking: Option<String>,
    thinking_budget: Option<u32>,
    effort: Option<String>,
    compaction: Option<String>,
) -> Result<()> {
    let s = state.lock().await;
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    if let Some(handle) = s.sessions.get(&sid) {
        let _ = handle.tx.send(SessionCommand::SetConfig {
            model,
            thinking,
            thinking_budget,
            effort,
            compaction,
        }).await;
    }
    Ok(())
}
