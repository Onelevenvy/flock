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
        .ok_or_else(|| flock_core::tr("沙盒未配置或未启用", "Sandbox not configured or enabled"))?;

    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let list_url = format!("{}/api/sandbox", base);
    let resp = client.get(&list_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| flock_core::tr(
            &format!("获取沙盒列表失败: {}", e),
            &format!("Failed to retrieve sandbox list: {}", e)
        ))?;

    let text = resp.text().await.unwrap_or_default();
    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| flock_core::tr(
            &format!("解析沙盒列表失败: {}", e),
            &format!("Failed to parse sandbox list: {}", e)
        ))?;

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

    Ok(flock_core::tr(
        &format!("清理完成：已销毁 {} 个沙盒，失败 {} 个。", deleted, failed),
        &format!("Cleanup complete: destroyed {} sandboxes, failed {}.", deleted, failed)
    ))
}

/// 获取当前活动沙盒的 VNC 代理链接
#[tauri::command]
pub async fn get_active_sandbox_vnc_url(
    _state: State<'_, SharedAgentState>,
    db: State<'_, crate::SharedDbManager>,
) -> Result<Option<String>, String> {
    if let Some(sandbox_id) = flock_tools::daytona::get_active_sandbox_id().await {
        match flock_tools::daytona::get_sandbox_vnc_url(&*db, &sandbox_id).await {
            Ok(url) => Ok(Some(url)),
            Err(e) => {
                println!("{}", flock_core::tr(
                    &format!("获取动态 VNC URL 失败: {}。使用静态备用 URL...", e),
                    &format!("Failed to retrieve dynamic VNC URL: {}. Using static fallback URL...", e)
                ));
                Ok(Some(format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)))
            }
        }
    } else {
        Ok(None)
    }
}

/// 通过 Tauri 后端代理拉取 VNC HTML 页面内容，注入 X-Daytona-Skip-Preview-Warning header 绕过警告拦截。
/// 返回 { html: String, base_url: String } 供前端以 srcdoc 形式注入到 iframe 中。
#[tauri::command]
pub async fn fetch_vnc_page_content(
    page_url: String,
    api_key: Option<String>,
) -> Result<serde_json::Value, String> {
    // 从 URL 解析出 base URL（协议 + 主机名）
    let base_url = {
        let url = reqwest::Url::parse(&page_url).map_err(|e| format!("无效的 VNC URL: {}", e))?;
        format!("{}://{}", url.scheme(), url.host_str().unwrap_or(""))
    };

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut req = client.get(&page_url)
        .header("X-Daytona-Skip-Preview-Warning", "true")
        .header("X-Daytona-Disable-CORS", "true")
        .header("User-Agent", "Mozilla/5.0 (Flock/Agent) AppleWebKit/537.36 (KHTML, like Gecko)")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");

    if let Some(key) = api_key {
        req = req.header("X-Daytona-Preview-Token", key);
    }

    let resp = req.send().await.map_err(|e| format!("拉取 VNC 页面失败: {}", e))?;
    let status = resp.status();
    let final_url = resp.url().clone().to_string();

    let html = resp.text().await.unwrap_or_default();

    // 注入 <base> 标签使相对路径资源引用到正确的 origin
    let html_with_base = if html.contains("<head>") || html.contains("<HEAD>") {
        let base_tag = format!("<base href=\"{}/\" target=\"_blank\">", base_url);
        html.replacen("<head>", &format!("<head>{}", base_tag), 1)
            .replacen("<HEAD>", &format!("<HEAD>{}", base_tag), 1)
    } else if html.starts_with("<!") || html.starts_with("<html") {
        format!("<base href=\"{}/\">{}", base_url, html)
    } else {
        html
    };

    Ok(serde_json::json!({
        "html": html_with_base,
        "base_url": base_url,
        "final_url": final_url,
        "status": status.as_u16(),
        "ok": status.is_success(),
    }))
}
