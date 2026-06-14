use tauri::State;
use crate::commands::assistant::{self, SharedAgentState};

/// 批准工具调用
#[tauri::command]
pub async fn approve_tool(
    state: State<'_, SharedAgentState>,
    call_id: String,
    scope: String,
    feedback: Option<String>,
) -> Result<(), String> {
    assistant::approve_tool_call(state.inner().clone(), call_id, scope, feedback)
        .await
        .map_err(|e| e.to_string())
}

/// 拒绝工具调用
#[tauri::command]
pub async fn deny_tool(
    state: State<'_, SharedAgentState>,
    call_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    assistant::deny_tool_call(state.inner().clone(), call_id, reason)
        .await
        .map_err(|e| e.to_string())
}

/// 人工接管完成后 Resume Agent
/// 当用户完成人工操作（如输入密码、处理验证码）后，调用此命令告知 Agent 继续执行。
/// 底层通过 approve_tool 机制实现，decision 字段记录人工接管结果。
#[tauri::command]
pub async fn resume_tool(
    state: State<'_, SharedAgentState>,
    call_id: String,
    decision: Option<String>,
) -> Result<(), String> {
    // decision: "human_done" 表示人工操作完成，"cancelled" 表示取消
    let scope = if decision.as_deref() == Some("cancelled") {
        "deny".to_string()
    } else {
        "once".to_string()
    };
    assistant::approve_tool_call(state.inner().clone(), call_id, scope, None)
        .await
        .map_err(|e| e.to_string())
}

/// 设置审批模式
#[tauri::command]
pub async fn set_mode(
    state: State<'_, SharedAgentState>,
    mode: String,
) -> Result<(), String> {
    assistant::set_approval_mode(state.inner().clone(), mode)
        .await
        .map_err(|e| e.to_string())
}
