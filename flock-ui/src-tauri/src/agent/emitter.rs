use tauri::{AppHandle, Emitter};
use flock_agent::sinks::OutputSink;
use flock_core::ipc_interface::events::{Capabilities, ErrorInfo, ProtocolEvent, Usage};
use flock_core::ipc_interface::writer::ProtocolEmitter;

/// Tauri 实现的 ProtocolEmitter & OutputSink，将事件通过 Tauri Emitter 发送给前端
pub struct TauriProtocolEmitter {
    app: AppHandle,
}

impl TauriProtocolEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn build_capabilities(
        compat: &flock_core::config::compat::ProviderCompat,
        has_mcp: bool,
        current_mode: &str,
    ) -> Capabilities {
        Capabilities {
            tool_approval: true,
            thinking: compat.supports_thinking(),
            effort: compat.supports_effort(),
            effort_levels: compat.effort_levels().to_vec(),
            modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
            current_mode: current_mode.to_string(),
            mcp: has_mcp,
        }
    }

    pub fn emit_ready(
        &self,
        compat: &flock_core::config::compat::ProviderCompat,
        has_mcp: bool,
        session_id: Option<String>,
        current_mode: &str,
    ) {
        let _ = self.emit(&ProtocolEvent::Ready {
            version: "0.1.0".to_string(),
            session_id,
            capabilities: Self::build_capabilities(compat, has_mcp, current_mode),
        });
    }
}

impl ProtocolEmitter for TauriProtocolEmitter {
    fn emit(&self, event: &ProtocolEvent) -> std::io::Result<()> {
        let json = serde_json::to_string(event).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to serialize event: {}", e),
            )
        })?;
        let _ = self.app.emit("agent-event", json);
        Ok(())
    }
}

impl OutputSink for TauriProtocolEmitter {
    fn emit_text_delta(&self, text: &str, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::TextDelta {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_thinking(&self, text: &str, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::Thinking {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_tool_call(&self, name: &str, _input: &str) {
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("Tool call: {name}"),
        });
    }

    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str) {
        let status = if is_error { "error" } else { "success" };
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("[{name} {status}] {content}"),
        });
    }

    fn emit_stream_start(&self, msg_id: &str) {
        let _ = self.emit(&ProtocolEvent::StreamStart {
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_stream_end(
        &self,
        msg_id: &str,
        _turns: usize,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_tokens: u64,
        cache_read_tokens: u64,
    ) {
        let _ = self.emit(&ProtocolEvent::StreamEnd {
            msg_id: msg_id.to_string(),
            usage: Some(Usage {
                input_tokens,
                output_tokens,
                cache_read_tokens: if cache_read_tokens > 0 {
                    Some(cache_read_tokens)
                } else {
                    None
                },
                cache_write_tokens: if cache_creation_tokens > 0 {
                    Some(cache_creation_tokens)
                } else {
                    None
                },
            }),
        });
    }

    fn emit_error(&self, msg: &str) {
        let _ = self.emit(&ProtocolEvent::Error {
            msg_id: None,
            error: ErrorInfo {
                code: "engine_error".to_string(),
                message: msg.to_string(),
                retryable: false,
            },
        });
    }

    fn emit_info(&self, msg: &str) {
        let _ = self.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: msg.to_string(),
        });
    }
}
