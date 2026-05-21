use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::mpsc;
use flock_agent::engine::AgentEngine;
use flock_agent::sinks::OutputSink;
use crate::agent::state::SessionCommand;

pub async fn run_session_actor(
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
