use tauri::State;

use crate::SharedDbManager;

/// 列出所有工具提供商
#[tauri::command]
pub async fn list_tool_providers(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<flock_core::db::ToolProvider>, String> {
    db.list_tool_providers().await.map_err(|e| e.to_string())
}

/// 列出所有工具
#[tauri::command]
pub async fn list_tools(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<flock_core::db::Tool>, String> {
    db.list_tools().await.map_err(|e| e.to_string())
}

/// 保存工具提供商的鉴权信息
#[tauri::command]
pub async fn update_tool_provider_credentials(
    db: State<'_, SharedDbManager>,
    provider_id: String,
    credentials: String,
) -> Result<(), String> {
    db.update_tool_provider_credentials(&provider_id, &credentials)
        .await
        .map_err(|e| e.to_string())
}

/// 测试工具提供商连通性并更新可用状态
#[tauri::command]
pub async fn test_tool_provider(
    db: State<'_, SharedDbManager>,
    provider_id: String,
) -> Result<String, String> {
    let providers = db.list_tool_providers().await.map_err(|e| e.to_string())?;
    let provider = providers.iter().find(|p| p.id == provider_id)
        .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

    // No-auth providers (no credentials_schema) are always available
    if provider.credentials_schema.is_none() {
        db.set_tool_provider_available(&provider_id, true).await.map_err(|e| e.to_string())?;
        return Ok("该工具不需要授权，已自动可用".to_string());
    }

    // Find tool and test_input from registry
    let tool_set = flock_tools::all_tools();
    let provider_infos = tool_set.provider_infos;
    let info = provider_infos.iter().find(|i| i.provider_id == provider_id);

    let test_input = info
        .and_then(|i| i.test_input.clone())
        .ok_or_else(|| format!("Provider '{}' 暂不支持连通性测试", provider_id))?;

    // Find the first tool belonging to this provider
    let tool = tool_set.registry.tools_iter()
        .find(|t| t.provider_id() == provider_id)
        .ok_or_else(|| format!("Provider '{}' 没有关联的工具", provider_id))?;

    // Execute the actual tool with test input
    let result = tool.execute(test_input).await;

    // Update availability based on test result
    db.set_tool_provider_available(&provider_id, !result.is_error).await.map_err(|e| e.to_string())?;

    if result.is_error {
        Err(result.content)
    } else {
        Ok(format!("{} 连通测试成功", provider.provider_name))
    }
}
