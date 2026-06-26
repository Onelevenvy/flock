use tauri::{AppHandle, Emitter};
use flock_agent::sinks::OutputSink;
use flock_core::ipc_interface::events::{ErrorInfo, ProtocolEvent, Usage};
use flock_core::ipc_interface::writer::ProtocolEmitter;

/// Tauri 实现的 ProtocolEmitter & OutputSink，将事件通过 Tauri Emitter 发送给前端。
///
/// 每条事件都会自动注入 `session_id` 字段，保证并发多 session 时前端能正确路由。
/// 优先级：task-local CURRENT_SESSION_ID（engine.run 内部） > 构造时绑定的 session_id（start/cleanup 阶段）。
pub struct TauriProtocolEmitter {
    app: AppHandle,
    /// 当 task-local 作用域不可用时（如 start_agent、cleanup task）使用此值作为 session_id
    session_id: String,
}

impl TauriProtocolEmitter {
    pub fn new(app: AppHandle, session_id: String) -> Self {
        Self { app, session_id }
    }

    fn get_session_id(&self) -> String {
        flock_core::CURRENT_SESSION_ID
            .try_with(|id| id.clone())
            .unwrap_or_else(|_| self.session_id.clone())
    }
}

impl ProtocolEmitter for TauriProtocolEmitter {
    fn emit(&self, event: &ProtocolEvent) -> std::io::Result<()> {
        let session_id = self.get_session_id();

        let mut value = serde_json::to_value(event).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to serialize event: {e}"))
        })?;
        if let Some(obj) = value.as_object_mut() {
            // or_insert_with：不覆盖 Ready 事件自带的 session_id
            obj.entry("session_id")
                .or_insert_with(|| serde_json::Value::String(session_id));
        }
        let json = serde_json::to_string(&value).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to serialize event: {e}"))
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


