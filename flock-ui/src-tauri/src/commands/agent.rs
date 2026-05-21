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

/// 手动销毁当前活跃的 Daytona 沙盒（并清除内存缓存）
#[tauri::command]
pub async fn destroy_sandbox(
    db: State<'_, crate::SharedDbManager>,
) -> Result<(), String> {
    flock_tools::daytona::destroy_active_sandbox(&*db)
        .await
        .map_err(|e| e.to_string())
}

/// 列出并销毁 Daytona 上所有运行中的沙盒（清理历史遗留的僵尸沙盒）
#[tauri::command]
pub async fn cleanup_all_sandboxes(
    db: State<'_, crate::SharedDbManager>,
) -> Result<String, String> {
    use flock_core::db::DbManager;
    use flock_tools::daytona::{get_sandbox_config, get_api_base};

    let db_ref: &DbManager = &*db;
    let cfg = get_sandbox_config(db_ref).await
        .ok_or_else(|| "沙盒未配置或未启用".to_string())?;

    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let list_url = format!("{}/api/sandbox", base);
    let resp = client.get(&list_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("获取沙盒列表失败: {}", e))?;

    let text = resp.text().await.unwrap_or_default();
    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析沙盒列表失败: {}", e))?;

    let sandboxes = val.as_array()
        .cloned()
        .unwrap_or_else(|| {
            val.get("items").or_else(|| val.get("data"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        });

    let mut deleted = 0usize;
    let mut failed = 0usize;

    for sb in &sandboxes {
        let id = sb.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        if id.is_empty() { continue; }

        let state_str = sb.get("state").or_else(|| sb.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // 只销毁 started / running / stopped 状态（跳过已删除的）
        if state_str == "deleted" || state_str == "archived" { continue; }

        let del_url = format!("{}/api/sandbox/{}", base, id);
        match client.delete(&del_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => deleted += 1,
            _ => failed += 1,
        }
    }

    // 清除本地缓存
    let _ = flock_tools::daytona::destroy_active_sandbox(db_ref).await;

    Ok(format!("清理完成：已销毁 {} 个沙盒，失败 {} 个。", deleted, failed))
}

/// 获取当前活动沙盒的 VNC 代理链接
#[tauri::command]
pub async fn get_active_sandbox_vnc_url(
    _state: State<'_, SharedAgentState>,
) -> Result<Option<String>, String> {
    if let Some(sandbox_id) = flock_tools::daytona::get_active_sandbox_id().await {
        Ok(Some(format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)))
    } else {
        Ok(None)
    }
}
