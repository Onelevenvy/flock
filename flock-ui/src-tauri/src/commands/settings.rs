use tauri::State;
use crate::SharedDbManager;

/// 获取指定 Key 的 app_config 配置
#[tauri::command]
pub async fn get_app_config(
    db: State<'_, SharedDbManager>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let config: Option<serde_json::Value> = db.get_config(&key).await;
    Ok(config)
}

/// 保存指定 Key 的 app_config 配置
#[tauri::command]
pub async fn set_app_config(
    db: State<'_, SharedDbManager>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    db.set_config(&key, &value).await
        .map_err(|e| format!("保存配置 '{}' 失败: {}", key, e))?;

    // 当 sandbox 被禁用时，将其 provider 标记为不可用
    if key == "sandbox" {
        let enabled = value.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
        if !enabled {
            let _ = db.set_tool_provider_available("sandbox", false).await;
        }
    }

    Ok(())
}

/// 测试云端沙盒（Daytona）的连通性，成功后将 sandbox provider 标记为可用
#[tauri::command]
pub async fn test_sandbox_connection(
    db: State<'_, SharedDbManager>,
    api_url: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let base = flock_tools::daytona::get_api_base(&api_url);
    let url = format!("{}/api/sandbox", base);

    let send_result = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await;

    let res = match send_result {
        Ok(r) => r,
        Err(e) => {
            let _ = db.set_tool_provider_available("sandbox", false).await;
            return Err(format!("无法连接到沙盒服务器: {}", e));
        }
    };

    if res.status().is_success() {
        db.set_tool_provider_available("sandbox", true)
            .await
            .map_err(|e| format!("更新沙盒可用状态失败: {}", e))?;
        Ok("连接成功".to_string())
    } else {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        let _ = db.set_tool_provider_available("sandbox", false).await;
        Err(format!("验证失败，HTTP 状态码: {}。错误详情: {}", status, err_body))
    }
}


/// 创建一个预装 Playwright 的 Daytona Snapshot
/// 需要约 3-5 分钟，完成后返回 Snapshot 名称。
#[tauri::command]
pub async fn create_playwright_snapshot(
    db: State<'_, SharedDbManager>,
    snapshot_name: String,
) -> Result<String, String> {
    flock_tools::daytona::create_playwright_snapshot(
        &*db,
        &snapshot_name,
    )
    .await
    .map_err(|e| e.to_string())
}
