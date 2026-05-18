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
