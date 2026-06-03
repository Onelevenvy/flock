use std::sync::Arc;
use tokio::sync::Mutex;
use anyhow::Result;
use flock_core::ipc_interface::approval::ToolApprovalResult;
use flock_core::ipc_interface::commands::{ApprovalScope, SessionMode};
use crate::session_host::state::AgentState;

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

/// 更新配置 (无状态模式下配置变化主要通过数据库持久化，此接口做日志记录)
pub async fn set_config(
    _state: Arc<Mutex<AgentState>>,
    session_id: Option<String>,
    model: Option<String>,
    thinking: Option<String>,
    thinking_budget: Option<u32>,
    effort: Option<String>,
    compaction: Option<String>,
) -> Result<()> {
    log::info!(
        "set_config called for session={:?}, model={:?}, thinking={:?}, thinking_budget={:?}, effort={:?}, compaction={:?}",
        session_id, model, thinking, thinking_budget, effort, compaction
    );
    Ok(())
}
