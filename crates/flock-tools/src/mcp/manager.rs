use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::json;

use super::mcp_config::{McpServerConfig, TransportType};
use super::protocol::{
    ClientCapabilities, ClientInfo, InitializeParams, InitializeResult, JsonRpcRequest,
    McpResource, McpToolDef, McpToolResult, ResourcesListResult, ResourcesReadResult,
    ToolsListResult,
};
use super::transport::sse::SseTransport;
use super::transport::stdio::StdioTransport;
use super::transport::streamable_http::StreamableHttpTransport;
use super::transport::{McpError, McpTransport};

/// A connected MCP server with its discovered tools and capabilities
struct McpServer {
    #[allow(dead_code)]
    name: String,
    transport: Box<dyn McpTransport>,
    tools: Vec<McpToolDef>,
    /// Whether the server declared resources capability in its initialize response
    supports_resources: bool,
}

/// Manages connections to multiple MCP servers
pub struct McpManager {
    servers: HashMap<String, McpServer>,
    /// Monotonically increasing request ID counter for all JSON-RPC calls
    next_id: AtomicU64,
}

impl McpManager {
    /// Connect to all configured MCP servers
    pub async fn connect_all(configs: &HashMap<String, McpServerConfig>) -> Result<Self, McpError> {
        let mut servers = HashMap::new();

        for (name, config) in configs {
            match Self::connect_server(name, config).await {
                Ok(server) => {
                    eprintln!(
                        "[mcp] Connected to '{}': {} tools, resources={}",
                        name,
                        server.tools.len(),
                        server.supports_resources,
                    );
                    servers.insert(name.clone(), server);
                }
                Err(e) => {
                    // Non-fatal: continue with other servers
                    eprintln!("[mcp] Failed to connect to '{}': {}", name, e);
                }
            }
        }

        Ok(Self {
            servers,
            next_id: AtomicU64::new(10),
        })
    }

    /// Connect a single additional MCP server after initial setup.
    /// Returns the list of tool names exposed by the server.
    pub async fn connect_one(
        &mut self,
        name: String,
        config: &McpServerConfig,
    ) -> Result<Vec<String>, McpError> {
        let server = Self::connect_server(&name, config).await?;
        let tool_names: Vec<String> = server.tools.iter().map(|t| t.name.clone()).collect();
        eprintln!(
            "[mcp] Connected to '{}': {} tools, resources={}",
            name,
            server.tools.len(),
            server.supports_resources,
        );
        self.servers.insert(name, server);
        Ok(tool_names)
    }

    /// Connect to a single MCP server: create transport, initialize, discover tools
    async fn connect_server(name: &str, config: &McpServerConfig) -> Result<McpServer, McpError> {
        let empty_map = HashMap::new();

        // 1. Create transport
        let transport: Box<dyn McpTransport> = match config.transport {
            TransportType::Stdio => {
                let command = config.command.as_deref().ok_or_else(|| {
                    McpError::InitFailed("stdio transport requires 'command'".into())
                })?;
                let args = config.args.as_deref().unwrap_or(&[]);
                let env = config.env.as_ref().unwrap_or(&empty_map);
                Box::new(StdioTransport::spawn(command, args, env).await?)
            }
            TransportType::Sse => {
                let url = config
                    .url
                    .as_deref()
                    .ok_or_else(|| McpError::InitFailed("SSE transport requires 'url'".into()))?;
                let headers = config.headers.as_ref().unwrap_or(&empty_map);
                Box::new(SseTransport::connect(url, headers).await?)
            }
            TransportType::StreamableHttp => {
                let url = config.url.as_deref().ok_or_else(|| {
                    McpError::InitFailed("streamable-http transport requires 'url'".into())
                })?;
                let headers = config.headers.as_ref().unwrap_or(&empty_map);
                Box::new(StreamableHttpTransport::connect(url, headers).await?)
            }
        };

        // 2. Initialize handshake
        let init_params = InitializeParams {
            protocol_version: "2025-03-26".to_string(),
            capabilities: ClientCapabilities {
                tools: Some(json!({})),
            },
            client_info: ClientInfo {
                name: "flock".to_string(),
                version: "0.3.0".to_string(),
            },
        };

        let init_req = JsonRpcRequest::new(
            1,
            "initialize",
            Some(serde_json::to_value(&init_params).map_err(|e| {
                McpError::InitFailed(format!("Failed to serialize init params: {}", e))
            })?),
        );

        let init_response = transport.request(&init_req).await?;
        let init_result: InitializeResult = serde_json::from_value(
            init_response
                .result
                .ok_or_else(|| McpError::InitFailed("No result in initialize response".into()))?,
        )
        .map_err(|e| McpError::InitFailed(format!("Failed to parse init result: {}", e)))?;

        // Check whether server declared resources capability
        let supports_resources = init_result
            .capabilities
            .get("resources")
            .map(|v| !v.is_null())
            .unwrap_or(false);

        // 3. Send initialized notification
        let initialized_notification =
            JsonRpcRequest::notification("notifications/initialized", None);
        transport.notify(&initialized_notification).await?;

        // 4. List tools
        let list_req = JsonRpcRequest::new(2, "tools/list", None);
        let list_response = transport.request(&list_req).await?;
        let tools_result: ToolsListResult = serde_json::from_value(
            list_response
                .result
                .ok_or_else(|| McpError::InitFailed("No result in tools/list response".into()))?,
        )
        .map_err(|e| McpError::InitFailed(format!("Failed to parse tools list: {}", e)))?;

        Ok(McpServer {
            name: name.to_string(),
            transport,
            tools: tools_result.tools,
            supports_resources,
        })
    }

    /// Get all discovered tools with their server names
    pub fn all_tools(&self) -> Vec<(&str, &McpToolDef)> {
        let mut result = Vec::new();
        for (server_name, server) in &self.servers {
            for tool in &server.tools {
                result.push((server_name.as_str(), tool));
            }
        }
        result
    }

    /// Check if a tool name exists across any server
    pub fn has_tool_name(&self, name: &str) -> bool {
        self.servers
            .values()
            .any(|s| s.tools.iter().any(|t| t.name == name))
    }

    /// Count how many servers have a tool with the given name
    pub fn tool_name_count(&self, name: &str) -> usize {
        self.servers
            .values()
            .filter(|s| s.tools.iter().any(|t| t.name == name))
            .count()
    }

    /// Execute a tool on a specific server
    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, McpError> {
        let server = self
            .servers
            .get(server_name)
            .ok_or_else(|| McpError::ServerNotFound(server_name.to_string()))?;

        let request = JsonRpcRequest::new(
            0, // id doesn't matter for stdio, will be used for SSE/HTTP
            "tools/call",
            Some(json!({
                "name": tool_name,
                "arguments": arguments
            })),
        );

        let response = server.transport.request(&request).await?;

        let result_value = response
            .result
            .ok_or_else(|| McpError::Transport("No result in tool call response".into()))?;

        // Parse result and concatenate text content
        let tool_result: McpToolResult = serde_json::from_value(result_value)
            .map_err(|e| McpError::Transport(format!("Failed to parse tool result: {}", e)))?;

        let mut text_parts = Vec::new();
        for content in &tool_result.content {
            match content {
                super::protocol::McpContent::Text { text } => text_parts.push(text.clone()),
                super::protocol::McpContent::Image { mime_type, .. } => {
                    text_parts.push(format!("[image: {}]", mime_type));
                }
                super::protocol::McpContent::Resource { .. } => {
                    text_parts.push("[resource]".to_string());
                }
            }
        }

        Ok(text_parts.join("\n"))
    }

    /// Get names of all connected servers.
    pub fn server_names(&self) -> Vec<String> {
        self.servers.keys().cloned().collect()
    }

    /// Check if a connected server declared the resources capability.
    pub fn server_supports_resources(&self, server_name: &str) -> bool {
        self.servers
            .get(server_name)
            .map(|s| s.supports_resources)
            .unwrap_or(false)
    }

    /// List all resources from a server.
    pub async fn list_resources(&self, server_name: &str) -> Result<Vec<McpResource>, McpError> {
        let server = self
            .servers
            .get(server_name)
            .ok_or_else(|| McpError::ServerNotFound(server_name.to_string()))?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let request = JsonRpcRequest::new(id, "resources/list", None);
        let response = server.transport.request(&request).await?;

        let result_value = response
            .result
            .ok_or_else(|| McpError::Transport("No result in resources/list response".into()))?;

        let list_result: ResourcesListResult = serde_json::from_value(result_value)
            .map_err(|e| McpError::Transport(format!("Failed to parse resources/list: {}", e)))?;

        Ok(list_result.resources)
    }

    /// Read a single resource by URI from a server. Returns the text content.
    pub async fn read_resource(&self, server_name: &str, uri: &str) -> Result<String, McpError> {
        let server = self
            .servers
            .get(server_name)
            .ok_or_else(|| McpError::ServerNotFound(server_name.to_string()))?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let request = JsonRpcRequest::new(id, "resources/read", Some(json!({ "uri": uri })));
        let response = server.transport.request(&request).await?;

        let result_value = response
            .result
            .ok_or_else(|| McpError::Transport("No result in resources/read response".into()))?;

        let read_result: ResourcesReadResult = serde_json::from_value(result_value)
            .map_err(|e| McpError::Transport(format!("Failed to parse resources/read: {}", e)))?;

        // Return the first text content found
        read_result
            .contents
            .into_iter()
            .find_map(|c| c.text)
            .ok_or_else(|| McpError::Transport(format!("No text content in resource '{}'", uri)))
    }

    /// Gracefully shutdown all servers
    pub async fn shutdown(&self) {
        for (name, server) in &self.servers {
            if let Err(e) = server.transport.close().await {
                eprintln!("[mcp] Error closing '{}': {}", name, e);
            }
        }
    }

    /// Test-only constructor: build a manager from pre-configured servers.
    #[cfg(any(test, feature = "test-utils"))]
    pub fn new_for_test(
        entries: Vec<(&str, bool, Box<dyn super::transport::McpTransport>)>,
    ) -> Self {
        let mut servers = HashMap::new();
        for (name, supports_resources, transport) in entries {
            servers.insert(
                name.to_string(),
                McpServer {
                    name: name.to_string(),
                    transport,
                    tools: vec![],
                    supports_resources,
                },
            );
        }
        Self {
            servers,
            next_id: AtomicU64::new(10),
        }
    }
}

