use std::collections::HashMap;
use tauri::State;

use crate::SharedDbManager;

/// List all MCP servers from the database.
#[tauri::command]
pub async fn list_mcp_servers(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<flock_core::db::McpServer>, String> {
    db.list_mcp_servers().await.map_err(|e| e.to_string())
}

/// Create or update an MCP server.
#[tauri::command]
pub async fn upsert_mcp_server(
    db: State<'_, SharedDbManager>,
    server: flock_core::db::McpServer,
) -> Result<(), String> {
    db.upsert_mcp_server(&server)
        .await
        .map_err(|e| e.to_string())
}

/// Delete an MCP server by id.
#[tauri::command]
pub async fn delete_mcp_server(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_mcp_server(&id).await.map_err(|e| e.to_string())
}

/// Enable or disable an MCP server.
#[tauri::command]
pub async fn set_mcp_server_enabled(
    db: State<'_, SharedDbManager>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    db.set_mcp_server_enabled(&id, enabled)
        .await
        .map_err(|e| e.to_string())
}

/// Test an MCP server connection. Creates a temporary McpManager to connect,
/// then seeds discovered tools into the DB and updates connection status.
#[tauri::command]
pub async fn test_mcp_server(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<String, String> {
    let server = db
        .get_mcp_server(&id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "MCP server not found".to_string())?;

    let server_config = server.to_mcp_server_config();
    let mut configs = HashMap::new();
    configs.insert(server.name.clone(), server_config);

    match flock_tools::mcp::McpManager::connect_all(&configs).await {
        Ok(manager) => {
            let all_tools = manager.all_tools();
            let tool_count = all_tools.len() as i64;

            // Build ToolDefs from discovered MCP tools and seed into DB
            let provider_id = format!("mcp:{}", server.name);
            let tool_defs: Vec<flock_core::types::tool::ToolDef> = all_tools
                .iter()
                .map(|(_, mcp_tool)| flock_core::types::tool::ToolDef {
                    name: mcp_tool.name.clone(),
                    description: mcp_tool.description.clone().unwrap_or_default(),
                    input_schema: mcp_tool.input_schema.clone(),
                    deferred: server.deferred,
                    category: "mcp".to_string(),
                    provider_id: provider_id.clone(),
                    provider_name: format!("MCP: {}", server.name),
                    needs_auth: false,
                })
                .collect();

            // Seed provider and tools into DB
            let provider_info = flock_core::types::tool::ProviderInfo {
                provider_id: provider_id.clone(),
                provider_name: flock_core::types::tool::I18nString::single(format!("MCP: {}", server.name)),
                description: flock_core::types::tool::I18nString::single(format!("MCP server: {}", server.name)),
                icon: None,
                credentials_schema: None,
                test_input: None,
            };
            let provider_infos = vec![provider_info];

            if let Err(e) = db.seed_tool_providers(&provider_infos).await {
                log::warn!("Failed to seed MCP provider: {}", e);
            }
            if let Err(e) = db.upsert_tools(&tool_defs, &provider_infos).await {
                log::warn!("Failed to seed MCP tools: {}", e);
            }

            // Update connection status
            let _ = db
                .set_mcp_server_connected(&id, true, tool_count, None)
                .await;

            Ok(format!("连接成功，发现 {} 个工具", tool_count))
        }
        Err(e) => {
            let msg = format!("{}", e);
            let _ = db
                .set_mcp_server_connected(&id, false, 0, Some(&msg))
                .await;
            Err(format!("连接失败: {}", e))
        }
    }
}
