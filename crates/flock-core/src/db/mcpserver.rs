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

impl super::DbManager {
    pub async fn list_mcp_servers(&self) -> anyhow::Result<Vec<McpServer>> {
        let rows = sqlx::query(
            "SELECT id, name, transport, command, args, env, url, headers,
                    deferred, is_connected, last_error, tool_count, enabled,
                    created_at, updated_at
             FROM mcp_server ORDER BY name",
        )
            .fetch_all(self.pool())
            .await?;

        Ok(rows.iter().map(mcp_server_from_row).collect())
    }

    pub async fn get_mcp_server(&self, id: &str) -> anyhow::Result<Option<McpServer>> {
        let r = sqlx::query(
            "SELECT id, name, transport, command, args, env, url, headers,
                    deferred, is_connected, last_error, tool_count, enabled,
                    created_at, updated_at
             FROM mcp_server WHERE id = ?1",
        )
            .bind(id)
            .fetch_optional(self.pool())
            .await?;

        Ok(r.map(|row| mcp_server_from_row(&row)))
    }

    pub async fn upsert_mcp_server(&self, server: &McpServer) -> anyhow::Result<()> {
        sqlx::query(
            "INSERT INTO mcp_server
                (id, name, transport, command, args, env, url, headers,
                 deferred, is_connected, last_error, tool_count, enabled,
                 created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                     datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                name = ?2, transport = ?3, command = ?4, args = ?5,
                env = ?6, url = ?7, headers = ?8, deferred = ?9,
                is_connected = ?10, last_error = ?11, tool_count = ?12,
                enabled = ?13, updated_at = datetime('now')",
        )
            .bind(&server.id)
            .bind(&server.name)
            .bind(&server.transport)
            .bind(&server.command)
            .bind(&server.args)
            .bind(&server.env)
            .bind(&server.url)
            .bind(&server.headers)
            .bind(server.deferred as i64)
            .bind(server.is_connected as i64)
            .bind(&server.last_error)
            .bind(server.tool_count)
            .bind(server.enabled as i64)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    pub async fn delete_mcp_server(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM mcp_server WHERE id = ?1")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    pub async fn set_mcp_server_connected(
        &self,
        id: &str,
        is_connected: bool,
        tool_count: i64,
        last_error: Option<&str>,
    ) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE mcp_server SET is_connected = ?2, tool_count = ?3,
                last_error = ?4, updated_at = datetime('now')
             WHERE id = ?1",
        )
            .bind(id)
            .bind(is_connected as i64)
            .bind(tool_count)
            .bind(last_error)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    pub async fn set_mcp_server_enabled(&self, id: &str, enabled: bool) -> anyhow::Result<()> {
        // Update mcp_server table
        sqlx::query(
            "UPDATE mcp_server SET enabled = ?2, updated_at = datetime('now') WHERE id = ?1",
        )
            .bind(id)
            .bind(enabled as i64)
            .execute(self.pool())
            .await?;

        // Sync tool_provider.is_available for this MCP server's tools.
        // The tool_provider id follows the pattern "mcp:{server_name}".
        if let Some(server) = self.get_mcp_server(id).await? {
            let provider_id = format!("mcp:{}", server.name);
            sqlx::query(
                "UPDATE tool_provider SET is_available = ?2, updated_at = datetime('now') WHERE id = ?1",
            )
                .bind(&provider_id)
                .bind(enabled as i64)
                .execute(self.pool())
                .await?;
        }

        Ok(())
    }

    /// Build a `McpConfig` from all enabled MCP server rows (for agent startup).
    pub async fn load_mcp_servers_as_config(&self) -> anyhow::Result<crate::config::settings::McpConfig> {
        use std::collections::HashMap;
        let servers = self.list_mcp_servers().await?;
        let mut map = HashMap::new();
        for s in servers {
            if s.enabled {
                map.insert(s.name.clone(), s.to_mcp_server_config());
            }
        }
        Ok(crate::config::settings::McpConfig { servers: map })
    }
}

