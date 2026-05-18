use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::config::settings::{McpServerConfig, TransportType};

/// MCP server stored in the `mcp_server` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub command: Option<String>,
    pub args: Option<String>,
    pub env: Option<String>,
    pub url: Option<String>,
    pub headers: Option<String>,
    pub deferred: bool,
    pub is_connected: bool,
    pub last_error: Option<String>,
    pub tool_count: i64,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl McpServer {
    /// Convert this DB row back into a `McpServerConfig` for agent use.
    pub fn to_mcp_server_config(&self) -> McpServerConfig {
        let transport = match self.transport.as_str() {
            "sse" => TransportType::Sse,
            "streamable-http" => TransportType::StreamableHttp,
            _ => TransportType::Stdio,
        };
        let args: Option<Vec<String>> = self
            .args
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        let env: Option<std::collections::HashMap<String, String>> = self
            .env
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        let headers: Option<std::collections::HashMap<String, String>> = self
            .headers
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        McpServerConfig {
            transport,
            command: self.command.clone(),
            args,
            env,
            url: self.url.clone(),
            headers,
            deferred: Some(self.deferred),
        }
    }
}

/// Parse a `McpServer` from a SQLite row.
pub(super) fn mcp_server_from_row(r: &sqlx::sqlite::SqliteRow) -> McpServer {
    McpServer {
        id: r.get("id"),
        name: r.get("name"),
        transport: r.get("transport"),
        command: r.try_get("command").ok(),
        args: r.try_get("args").ok(),
        env: r.try_get("env").ok(),
        url: r.try_get("url").ok(),
        headers: r.try_get("headers").ok(),
        deferred: r.get::<i64, _>("deferred") != 0,
        is_connected: r.get::<i64, _>("is_connected") != 0,
        last_error: r.try_get("last_error").ok(),
        tool_count: r.get("tool_count"),
        enabled: r.get::<i64, _>("enabled") != 0,
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}
