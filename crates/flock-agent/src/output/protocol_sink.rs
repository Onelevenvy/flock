use std::sync::Arc;

use flock_core::config::compat::ProviderCompat;
use flock_core::ipc_interface::events::{Capabilities, ErrorInfo, ProtocolEvent, Usage};
use flock_core::ipc_interface::writer::{ProtocolEmitter, ProtocolWriter};

use super::OutputSink;

/// JSON stream ipc_interface output sink
pub struct ProtocolSink {
    writer: Arc<ProtocolWriter>,
}

impl ProtocolSink {
    pub fn new(writer: Arc<ProtocolWriter>) -> Self {
        Self { writer }
    }

    /// Emit the ready event at session start
    pub fn emit_ready(
        &self,
        compat: &ProviderCompat,
        has_mcp: bool,
        session_id: Option<String>,
        current_mode: &str,
    ) {
        let _ = self.writer.emit(&ProtocolEvent::Ready {
            version: env!("CARGO_PKG_VERSION").to_string(),
            session_id,
            capabilities: Self::build_capabilities(compat, has_mcp, current_mode),
        });
    }

    /// Emit a config_changed event after set_config or set_mode updates
    pub fn emit_config_changed(&self, compat: &ProviderCompat, has_mcp: bool, current_mode: &str) {
        let _ = self.writer.emit(&ProtocolEvent::ConfigChanged {
            capabilities: Self::build_capabilities(compat, has_mcp, current_mode),
        });
    }

    /// Access the underlying writer for custom events
    pub fn writer(&self) -> &Arc<ProtocolWriter> {
        &self.writer
    }

    fn build_capabilities(
        compat: &ProviderCompat,
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
}

impl OutputSink for ProtocolSink {
    fn emit_text_delta(&self, text: &str, msg_id: &str) {
        let _ = self.writer.emit(&ProtocolEvent::TextDelta {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_thinking(&self, text: &str, msg_id: &str) {
        let _ = self.writer.emit(&ProtocolEvent::Thinking {
            text: text.to_string(),
            msg_id: msg_id.to_string(),
        });
    }

    fn emit_tool_call(&self, name: &str, _input: &str) {
        // In ipc_interface mode, tool_call is handled by tool_request/tool_running events.
        // This is a fallback for compatibility.
        let _ = self.writer.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("Tool call: {name}"),
        });
    }

    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str) {
        // In ipc_interface mode, tool results are emitted via explicit ToolResult events
        // with call_id. This fallback emits an info event.
        let status = if is_error { "error" } else { "success" };
        let _ = self.writer.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: format!("[{name} {status}] {content}"),
        });
    }

    fn emit_stream_start(&self, msg_id: &str) {
        let _ = self.writer.emit(&ProtocolEvent::StreamStart {
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
        let _ = self.writer.emit(&ProtocolEvent::StreamEnd {
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
        let _ = self.writer.emit(&ProtocolEvent::Error {
            msg_id: None,
            error: ErrorInfo {
                code: "engine_error".to_string(),
                message: msg.to_string(),
                retryable: false,
            },
        });
    }

    fn emit_info(&self, msg: &str) {
        let _ = self.writer.emit(&ProtocolEvent::Info {
            msg_id: String::new(),
            message: msg.to_string(),
        });
    }
}
