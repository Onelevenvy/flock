use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue};
use tokio::sync::Mutex;

use super::{McpError, McpTransport};
use crate::mcp::protocol::{JsonRpcRequest, JsonRpcResponse};

/// Streamable HTTP transport: uses HTTP POST for both requests and responses
/// Supports optional SSE streaming for server responses
pub struct StreamableHttpTransport {
    client: reqwest::Client,
    url: String,
    headers: HeaderMap,
    session_id: Mutex<Option<String>>,
    next_id: AtomicU64,
}

impl StreamableHttpTransport {
    /// Create a new Streamable HTTP transport
    pub async fn connect(url: &str, headers: &HashMap<String, String>) -> Result<Self, McpError> {
        let mut header_map = HeaderMap::new();
        for (k, v) in headers {
            let name = reqwest::header::HeaderName::from_bytes(k.as_bytes())
                .map_err(|e| McpError::Transport(format!("Invalid header name '{}': {}", k, e)))?;
            let value = HeaderValue::from_str(v)
                .map_err(|e| McpError::Transport(format!("Invalid header value '{}': {}", v, e)))?;
            header_map.insert(name, value);
        }

        Ok(Self {
            client: reqwest::Client::new(),
            url: url.to_string(),
            headers: header_map,
            session_id: Mutex::new(None),
            next_id: AtomicU64::new(1),
        })
    }

    pub fn next_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Build request with session ID header if available
    async fn build_request(&self, body: &str) -> reqwest::RequestBuilder {
        let mut req = self
            .client
            .post(&self.url)
            .headers(self.headers.clone())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream");

        if let Some(sid) = self.session_id.lock().await.as_ref() {
            req = req.header("Mcp-Session-Id", sid.as_str());
        }

        req.body(body.to_string())
    }

    /// Parse response based on content type
    async fn parse_response(
        &self,
        response: reqwest::Response,
    ) -> Result<JsonRpcResponse, McpError> {
        // Capture session ID from response headers
        if let Some(sid) = response.headers().get("mcp-session-id")
            && let Ok(sid_str) = sid.to_str()
        {
            *self.session_id.lock().await = Some(sid_str.to_string());
        }

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if content_type.contains("text/event-stream") {
            // SSE response: parse events to find the JSON-RPC response
            self.parse_sse_response(response).await
        } else {
            // Direct JSON response
            let text = response
                .text()
                .await
                .map_err(|e| McpError::Transport(format!("Read response body failed: {}", e)))?;
            serde_json::from_str(&text).map_err(|e| {
                McpError::Transport(format!("Parse JSON response failed: {} — raw: {}", e, text))
            })
        }
    }

    /// Parse an SSE stream response to extract JSON-RPC response
    async fn parse_sse_response(
        &self,
        response: reqwest::Response,
    ) -> Result<JsonRpcResponse, McpError> {
        use futures::StreamExt;

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| McpError::Transport(format!("SSE read error: {}", e)))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Parse SSE events
            while let Some(event_end) = buffer.find("\n\n") {
                let event_block = buffer[..event_end].to_string();
                buffer = buffer[event_end + 2..].to_string();

                // Extract data lines
                let mut data_lines = Vec::new();
                for line in event_block.lines() {
                    if let Some(value) = line.strip_prefix("data:") {
                        data_lines.push(value.trim().to_string());
                    }
                }

                let data = data_lines.join("\n");
                if !data.is_empty()
                    && let Ok(rpc_response) = serde_json::from_str::<JsonRpcResponse>(&data)
                {
                    return Ok(rpc_response);
                }
            }
        }

        Err(McpError::Transport(
            "SSE stream ended without JSON-RPC response".into(),
        ))
    }
}

#[async_trait]
impl McpTransport for StreamableHttpTransport {
    async fn request(&self, req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let body = serde_json::to_string(req)
            .map_err(|e| McpError::Transport(format!("JSON serialize error: {}", e)))?;

        let http_req = self.build_request(&body).await;
        let response = http_req
            .send()
            .await
            .map_err(|e| McpError::Transport(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(McpError::Transport(format!(
                "HTTP request returned status: {}",
                response.status()
            )));
        }

        let rpc_response = self.parse_response(response).await?;

        if let Some(err) = &rpc_response.error {
            return Err(McpError::JsonRpc {
                code: err.code,
                message: err.message.clone(),
            });
        }

        Ok(rpc_response)
    }

    async fn notify(&self, req: &JsonRpcRequest) -> Result<(), McpError> {
        let body = serde_json::to_string(req)
            .map_err(|e| McpError::Transport(format!("JSON serialize error: {}", e)))?;

        let http_req = self.build_request(&body).await;
        http_req
            .send()
            .await
            .map_err(|e| McpError::Transport(format!("Notification request failed: {}", e)))?;

        Ok(())
    }

    async fn close(&self) -> Result<(), McpError> {
        // No persistent connection to close for HTTP
        Ok(())
    }
}
