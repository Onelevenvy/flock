use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue};
use tokio::sync::{oneshot, Mutex};

use super::{McpError, McpTransport};
use crate::tools::mcp::protocol::{JsonRpcRequest, JsonRpcResponse};

/// SSE transport: connects to an SSE endpoint for server→client events,
/// sends requests via POST to the endpoint URL received from the SSE stream
pub struct SseTransport {
    client: reqwest::Client,
    /// The POST endpoint URL (received from the SSE stream's "endpoint" event)
    post_url: String,
    headers: HeaderMap,
    /// Pending request-response channels, keyed by JSON-RPC id
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>,
    next_id: AtomicU64,
    /// Handle to the background SSE listener task
    _listener: tokio::task::JoinHandle<()>,
}

impl SseTransport {
    /// Connect to an SSE MCP server
    pub async fn connect(url: &str, headers: &HashMap<String, String>) -> Result<Self, McpError> {
        let mut header_map = HeaderMap::new();
        for (k, v) in headers {
            let name = reqwest::header::HeaderName::from_bytes(k.as_bytes())
                .map_err(|e| McpError::Transport(format!("Invalid header name '{}': {}", k, e)))?;
            let value = HeaderValue::from_str(v)
                .map_err(|e| McpError::Transport(format!("Invalid header value '{}': {}", v, e)))?;
            header_map.insert(name, value);
        }

        let client = reqwest::Client::new();

        // GET the SSE endpoint to establish the event stream
        let response = client
            .get(url)
            .headers(header_map.clone())
            .header("Accept", "text/event-stream")
            .send()
            .await
            .map_err(|e| McpError::Transport(format!("SSE connection failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(McpError::Transport(format!(
                "SSE connection returned status: {}",
                response.status()
            )));
        }

        let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        // Parse the SSE stream to find the endpoint URL
        // The server sends an "endpoint" event with the POST URL
        let base_url = extract_base_url(url);
        let mut bytes_stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut post_url: Option<String> = None;

        use futures::StreamExt;
        // Read initial events to get the endpoint URL
        while let Some(chunk) = bytes_stream.next().await {
            let chunk = chunk.map_err(|e| McpError::Transport(format!("SSE read error: {}", e)))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Parse SSE events from buffer
            while let Some(event_end) = buffer.find("\n\n") {
                let event_block = buffer[..event_end].to_string();
                buffer = buffer[event_end + 2..].to_string();

                let (event_type, event_data) = parse_sse_event(&event_block);

                if event_type == "endpoint" {
                    // The endpoint might be relative or absolute
                    let endpoint = if event_data.starts_with("http") {
                        event_data.clone()
                    } else {
                        format!("{}{}", base_url, event_data)
                    };
                    post_url = Some(endpoint);
                    break;
                }
            }

            if post_url.is_some() {
                break;
            }
        }

        let post_url = post_url
            .ok_or_else(|| McpError::Transport("No endpoint event received from SSE".into()))?;

        // Spawn background task to listen for SSE responses
        let pending_clone = pending.clone();
        let listener = tokio::spawn(async move {
            let mut buf = buffer; // carry over remaining buffer
            while let Some(chunk) = bytes_stream.next().await {
                let Ok(chunk) = chunk else { break };
                buf.push_str(&String::from_utf8_lossy(&chunk));

                while let Some(event_end) = buf.find("\n\n") {
                    let event_block = buf[..event_end].to_string();
                    buf = buf[event_end + 2..].to_string();

                    let (event_type, event_data) = parse_sse_event(&event_block);

                    if (event_type == "message" || event_type.is_empty())
                        && let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&event_data)
                        && let Some(id) = response.id
                    {
                        let mut map: tokio::sync::MutexGuard<
                            '_,
                            HashMap<u64, oneshot::Sender<JsonRpcResponse>>,
                        > = pending_clone.lock().await;
                        if let Some(sender) = map.remove(&id) {
                            let _ = sender.send(response);
                        }
                    }
                }
            }
        });

        Ok(Self {
            client,
            post_url,
            headers: header_map,
            pending,
            next_id: AtomicU64::new(1),
            _listener: listener,
        })
    }

    pub fn next_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }
}

#[async_trait]
impl McpTransport for SseTransport {
    async fn request(&self, req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let req_id = req
            .id
            .ok_or_else(|| McpError::Transport("Request must have an id".into()))?;

        // Set up response channel before sending
        let (tx, rx) = oneshot::channel::<JsonRpcResponse>();
        {
            let mut map: tokio::sync::MutexGuard<
                '_,
                HashMap<u64, oneshot::Sender<JsonRpcResponse>>,
            > = self.pending.lock().await;
            map.insert(req_id, tx);
        }

        // POST the request
        let body = serde_json::to_string(req)
            .map_err(|e| McpError::Transport(format!("JSON serialize error: {}", e)))?;

        let response = self
            .client
            .post(&self.post_url)
            .headers(self.headers.clone())
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
            .map_err(|e| McpError::Transport(format!("POST request failed: {}", e)))?;

        if !response.status().is_success() {
            // Clean up pending
            self.pending.lock().await.remove(&req_id);
            return Err(McpError::Transport(format!(
                "POST returned status: {}",
                response.status()
            )));
        }

        // Wait for response from SSE stream
        let rpc_response = rx
            .await
            .map_err(|_| McpError::Transport("Response channel closed unexpectedly".into()))?;

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

        self.client
            .post(&self.post_url)
            .headers(self.headers.clone())
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
            .map_err(|e| McpError::Transport(format!("Notification POST failed: {}", e)))?;

        Ok(())
    }

    async fn close(&self) -> Result<(), McpError> {
        self._listener.abort();
        Ok(())
    }
}

/// Parse a single SSE event block into (event_type, data)
fn parse_sse_event(block: &str) -> (String, String) {
    let mut event_type = String::new();
    let mut data_lines = Vec::new();

    for line in block.lines() {
        if let Some(value) = line.strip_prefix("event:") {
            event_type = value.trim().to_string();
        } else if let Some(value) = line.strip_prefix("data:") {
            data_lines.push(value.trim().to_string());
        }
    }

    (event_type, data_lines.join("\n"))
}

/// Extract base URL (scheme + host + port) from a full URL
fn extract_base_url(url: &str) -> String {
    // Find the position after "://"
    if let Some(scheme_end) = url.find("://") {
        let rest = &url[scheme_end + 3..];
        if let Some(path_start) = rest.find('/') {
            return url[..scheme_end + 3 + path_start].to_string();
        }
    }
    url.to_string()
}
