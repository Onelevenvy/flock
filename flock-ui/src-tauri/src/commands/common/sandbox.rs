use tauri::State;
use crate::commands::assistant::SharedAgentState;

/// 手动销毁当前活跃的沙盒（并清除内存缓存）
#[tauri::command]
pub async fn destroy_sandbox(
    db: State<'_, crate::SharedDbManager>,
) -> Result<(), String> {
    flock_tools::sandbox_core::manager::destroy_active_sandbox(&*db)
        .await
        .map_err(|e| e.to_string())
}

/// 列出并销毁所有运行中的沙盒（清理历史遗留的僵尸沙盒）
#[tauri::command]
pub async fn cleanup_all_sandboxes(
    db: State<'_, crate::SharedDbManager>,
) -> Result<String, String> {
    let db_ref = &*db;
    let res = flock_tools::sandbox_core::manager::cleanup_all_sandbox_instances(db_ref)
        .await
        .map_err(|e| e.to_string())?;

    // 清除本地缓存
    let _ = flock_tools::sandbox_core::manager::destroy_active_sandbox(db_ref).await;

    Ok(res)
}

/// 获取当前活动沙盒的 VNC 代理链接
#[tauri::command]
pub async fn get_active_sandbox_vnc_url(
    _state: State<'_, SharedAgentState>,
    db: State<'_, crate::SharedDbManager>,
) -> Result<Option<String>, String> {
    if let Some(sandbox_id) = flock_tools::sandbox_core::manager::get_active_sandbox_id().await {
        match flock_tools::sandbox_core::manager::get_sandbox_vnc_url(&*db, &sandbox_id).await {
            Ok(url) => Ok(Some(url)),
            Err(_) => {
                let fallback_url = match flock_tools::sandbox_core::config::get_sandbox_config(&*db).await {
                    Some(cfg) => {
                        let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
                        let provider = flock_tools::sandbox_core::manager::get_provider(provider_name);
                        provider.get_vnc_url(&*db, &cfg, &sandbox_id).await.unwrap_or_else(|_| {
                            if provider_name == "e2b" {
                                format!("https://6080-{}.e2b.app/vnc.html?autoconnect=true&resize=scale&path=websockify", sandbox_id)
                            } else {
                                format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)
                            }
                        })
                    }
                    None => {
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
