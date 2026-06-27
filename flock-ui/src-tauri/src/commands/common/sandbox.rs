use tauri::State;
use crate::commands::assistant::SharedAgentState;

/// 手动销毁当前活跃的 Daytona 沙盒（并清除内存缓存）
#[tauri::command]
pub async fn destroy_sandbox(
    db: State<'_, crate::SharedDbManager>,
) -> Result<(), String> {
    flock_tools::sandbox_manager::destroy_active_sandbox(&*db)
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
    let _ = flock_tools::sandbox_manager::destroy_active_sandbox(db_ref).await;

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
    if let Some(sandbox_id) = flock_tools::sandbox_manager::get_active_sandbox_id().await {
        match flock_tools::sandbox_manager::get_sandbox_vnc_url(&*db, &sandbox_id).await {
            Ok(url) => Ok(Some(url)),
            Err(_) => {
                let fallback_url = match flock_tools::daytona::get_sandbox_config(&*db).await {
                    Some(cfg) if cfg.provider.as_deref().unwrap_or("e2b") == "e2b" => {
                        format!("https://6080-{}.e2b.app/vnc.html?autoconnect=true&resize=scale&skip-preview-warning=true&skip_preview_warning=true", sandbox_id)
                    }
                    _ => {
                        format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)
                    }
                };
                Ok(Some(fallback_url))
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
