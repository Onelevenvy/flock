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
        .map_err(|e| format!("保存配置 '{}' 失败: {}", key, e))
}

/// 测试云端沙盒（Daytona）的连通性
#[tauri::command]
pub async fn test_sandbox_connection(
    api_url: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/sandbox", api_url.trim_end_matches('/'));
    
    let res = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("无法连接到沙盒服务器: {}", e))?;
        
    if res.status().is_success() {
        Ok("连接成功".to_string())
    } else {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        Err(format!("验证失败，HTTP 状态码: {}。错误详情: {}", status, err_body))
    }
}
