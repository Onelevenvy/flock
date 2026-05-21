use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use crate::agent::{self, AgentState};

pub type SharedAgentState = Arc<Mutex<AgentState>>;

/// 启动 Agent（工作目录自动绑定工作空间路径）
#[tauri::command]
pub async fn start_agent(
    app: AppHandle,
    state: State<'_, SharedAgentState>,
    workdir: String,
    project_dir: Option<String>,
    api_key: Option<String>,
    session_id: Option<String>,
    assistant_id: Option<String>,
    extra_args: Option<Vec<String>>,
) -> Result<(), String> {
    let workdir = PathBuf::from(&workdir);
    let mut args = extra_args.unwrap_or_default();

    if let Some(ref pd) = project_dir {
        args.push("--project-dir".to_string());
        args.push(pd.clone());
    }

    if let Some(ref key) = api_key {
        args.push("--api-key".to_string());
        args.push(key.clone());
    }

    agent::start_agent(app, state.inner().clone(), workdir, session_id, assistant_id, args)
        .await
        .map_err(|e| e.to_string())
}

/// 停止 Agent
#[tauri::command]
pub async fn stop_agent(
    state: State<'_, SharedAgentState>,
    session_id: Option<String>,
) -> Result<(), String> {
    agent::stop_agent(state.inner().clone(), session_id)
        .await
        .map_err(|e| e.to_string())
}

/// 发送消息给 Agent
#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    state: State<'_, SharedAgentState>,
    session_id: Option<String>,
    msg_id: String,
    content: String,
) -> Result<(), String> {
    agent::send_message(state.inner().clone(), session_id, msg_id, content, app)
        .await
        .map_err(|e| e.to_string())
}

/// 批准工具调用
#[tauri::command]
pub async fn approve_tool(
    state: State<'_, SharedAgentState>,
    call_id: String,
    scope: String,
) -> Result<(), String> {
    agent::approve_tool(state.inner().clone(), call_id, scope)
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
    agent::deny_tool(state.inner().clone(), call_id, reason)
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
    agent::approve_tool(state.inner().clone(), call_id, scope)
        .await
        .map_err(|e| e.to_string())
}

/// 设置审批模式
#[tauri::command]
pub async fn set_mode(
    state: State<'_, SharedAgentState>,
    mode: String,
) -> Result<(), String> {
    agent::set_mode(state.inner().clone(), mode)
        .await
        .map_err(|e| e.to_string())
}

/// 更新配置
#[tauri::command]
pub async fn set_config(
    state: State<'_, SharedAgentState>,
    session_id: Option<String>,
    model: Option<String>,
    thinking: Option<String>,
    thinking_budget: Option<u32>,
    effort: Option<String>,
    compaction: Option<String>,
) -> Result<(), String> {
    agent::set_config(
        state.inner().clone(),
        session_id,
        model,
        thinking,
        thinking_budget,
        effort,
        compaction,
    )
    .await
    .map_err(|e| e.to_string())
}

/// Ping Agent
#[tauri::command]
pub async fn ping_agent(_state: State<'_, SharedAgentState>) -> Result<(), String> {
    Ok(())
}

/// 获取 flock 可执行路径
#[tauri::command]
pub async fn get_flock_path(_state: State<'_, SharedAgentState>) -> Result<String, String> {
    Ok("integrated".to_string())
}

/// 获取当前工作目录
#[tauri::command]
pub async fn get_workdir(
    state: State<'_, SharedAgentState>,
    session_id: Option<String>,
) -> Result<Option<String>, String> {
    let s = state.lock().await;
    let sid = session_id.unwrap_or_else(|| "default".to_string());
    Ok(s.sessions.get(&sid).map(|h| h.workdir.to_string_lossy().to_string()))
}
