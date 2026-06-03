use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::process::{Child, ChildStdin, ChildStdout};
use tokio::sync::Mutex;

use super::{McpError, McpTransport};
use crate::tools::mcp::protocol::{JsonRpcRequest, JsonRpcResponse};

/// Stdio transport: communicates with MCP server via child process stdin/stdout
pub struct StdioTransport {
    stdin: Mutex<BufWriter<ChildStdin>>,
    stdout: Mutex<BufReader<ChildStdout>>,
    child: Mutex<Child>,
    next_id: AtomicU64,
}

impl StdioTransport {
    /// Spawn a child process and return the transport
    pub async fn spawn(
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
    ) -> Result<Self, McpError> {
        let mut cmd = tokio::process::Command::new(command);
        cmd.args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .envs(env);

        let mut child = cmd
            .spawn()
            .map_err(|e| McpError::Transport(format!("Failed to spawn '{}': {}", command, e)))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| McpError::Transport("Failed to capture child stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| McpError::Transport("Failed to capture child stdout".into()))?;

        Ok(Self {
            stdin: Mutex::new(BufWriter::new(stdin)),
            stdout: Mutex::new(BufReader::new(stdout)),
            child: Mutex::new(child),
            next_id: AtomicU64::new(1),
        })
    }

    /// Get the next request ID
    pub fn next_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Send a JSON-RPC message (request or notification) via stdin
    async fn send(&self, req: &JsonRpcRequest) -> Result<(), McpError> {
        let json = serde_json::to_string(req)
            .map_err(|e| McpError::Transport(format!("JSON serialize error: {}", e)))?;

        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(json.as_bytes())
            .await
            .map_err(|e| McpError::Transport(format!("Write to stdin failed: {}", e)))?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|e| McpError::Transport(format!("Write newline failed: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| McpError::Transport(format!("Flush stdin failed: {}", e)))?;
        Ok(())
    }

    /// Read a single JSON-RPC response from stdout
    async fn read_response(&self) -> Result<JsonRpcResponse, McpError> {
        let mut stdout = self.stdout.lock().await;
        let mut line = String::new();

        // Read lines until we get a non-empty one (skip blank lines)
        loop {
            line.clear();
            let bytes_read = stdout
                .read_line(&mut line)
                .await
                .map_err(|e| McpError::Transport(format!("Read from stdout failed: {}", e)))?;

            if bytes_read == 0 {
                return Err(McpError::Transport("Child process stdout closed".into()));
            }

            let trimmed = line.trim();
            if !trimmed.is_empty() {
                let response: JsonRpcResponse = serde_json::from_str(trimmed).map_err(|e| {
                    McpError::Transport(format!(
                        "Failed to parse JSON-RPC response: {} — raw: {}",
                        e, trimmed
                    ))
                })?;
                return Ok(response);
            }
        }
    }
}

#[async_trait]
impl McpTransport for StdioTransport {
    async fn request(&self, req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        self.send(req).await?;
        let response = self.read_response().await?;

        // Check for JSON-RPC error in response
        if let Some(err) = &response.error {
            return Err(McpError::JsonRpc {
                code: err.code,
                message: err.message.clone(),
            });
        }

        Ok(response)
    }

    async fn notify(&self, req: &JsonRpcRequest) -> Result<(), McpError> {
        self.send(req).await
    }

    async fn close(&self) -> Result<(), McpError> {
        // Drop stdin to signal EOF, then wait for child
        let mut child = self.child.lock().await;
        // kill the child process gracefully
        let _ = child.kill().await;
        Ok(())
    }
}
