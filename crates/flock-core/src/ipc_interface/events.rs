use serde::Serialize;
use serde_json::Value;

/// Events emitted by the agent to the client (Agent -> Client)
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum ProtocolEvent {
    Ready {
        version: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
        capabilities: Capabilities,
    },
    StreamStart {
        msg_id: String,
    },
    TextDelta {
        text: String,
        msg_id: String,
    },
    Thinking {
        text: String,
        msg_id: String,
    },
    ToolRequest {
        msg_id: String,
        call_id: String,
        tool: ToolInfo,
    },
    ToolRunning {
        msg_id: String,
        call_id: String,
        tool_name: String,
    },
    ToolResult {
        msg_id: String,
        call_id: String,
        tool_name: String,
        status: ToolStatus,
        output: String,
        output_type: OutputType,
        #[serde(skip_serializing_if = "Option::is_none")]
        metadata: Option<Value>,
    },
    ToolCancelled {
        msg_id: String,
        call_id: String,
        reason: String,
    },
    StreamEnd {
        msg_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<Usage>,
    },
    Error {
        #[serde(skip_serializing_if = "Option::is_none")]
        msg_id: Option<String>,
        error: ErrorInfo,
    },
    Info {
        msg_id: String,
        message: String,
    },
    ConfigChanged {
        capabilities: Capabilities,
    },
    McpReady {
        name: String,
        tools: Vec<String>,
    },
    TitleUpdated {
        thread_id: String,
        title: String,
    },
    /// 通知前端需要人工接管（如遇到登录验证、验证码等）
    HumanTakeover {
        /// 对应的工具调用 ID（与 interrupt 关联，resume 时使用）
        call_id: String,
        /// 当前关联的消息 ID
        msg_id: String,
        /// 提示用户需要做什么操作的描述文本
        message: String,
        /// 当前可交互的远程桌面/浏览器代理 URL（可选，供前端展示 VNC 面板）
        #[serde(skip_serializing_if = "Option::is_none")]
        remote_url: Option<String>,
    },
    Pong,
}

#[derive(Debug, Clone, Serialize)]
pub struct Capabilities {
    pub tool_approval: bool,
    pub thinking: bool,
    pub effort: bool,
    pub effort_levels: Vec<String>,
    pub modes: Vec<String>,
    pub current_mode: String,
    pub mcp: bool,
}

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub name: String,
    pub category: ToolCategory,
    pub args: Value,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    Info,
    Edit,
    Exec,
    Mcp,
}

impl std::fmt::Display for ToolCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Info => write!(f, "info"),
            Self::Edit => write!(f, "edit"),
            Self::Exec => write!(f, "exec"),
            Self::Mcp => write!(f, "mcp"),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolStatus {
    Success,
    Error,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputType {
    Text,
    Diff,
    Image,
}

#[derive(Debug, Serialize)]
pub struct Usage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_write_tokens: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_ready_event_serialization() {
        let event = ProtocolEvent::Ready {
            version: "0.1.0".to_string(),
            session_id: Some("abc123".to_string()),
            capabilities: Capabilities {
                tool_approval: true,
                thinking: true,
                effort: false,
                effort_levels: vec![],
                modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
                current_mode: "default".into(),
                mcp: false,
            },
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "ready");
        assert_eq!(json["version"], "0.1.0");
        assert_eq!(json["session_id"], "abc123");
        assert_eq!(json["capabilities"]["tool_approval"], true);

        // session_id omitted when None
        let event_no_sid = ProtocolEvent::Ready {
            version: "0.1.0".to_string(),
            session_id: None,
            capabilities: Capabilities {
                tool_approval: true,
                thinking: true,
                effort: false,
                effort_levels: vec![],
                modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
                current_mode: "default".into(),
                mcp: false,
            },
        };
        let json2 = serde_json::to_value(&event_no_sid).unwrap();
        assert!(json2.get("session_id").is_none());
    }

    #[test]
    fn test_text_delta_event_serialization() {
        let event = ProtocolEvent::TextDelta {
            text: "hello".to_string(),
            msg_id: "m1".to_string(),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "text_delta");
        assert_eq!(json["text"], "hello");
        assert_eq!(json["msg_id"], "m1");
    }

    #[test]
    fn test_tool_request_event_serialization() {
        let event = ProtocolEvent::ToolRequest {
            msg_id: "m1".to_string(),
            call_id: "c1".to_string(),
            tool: ToolInfo {
                name: "Bash".to_string(),
                category: ToolCategory::Exec,
                args: json!({"command": "ls"}),
                description: "Execute: ls".to_string(),
            },
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "tool_request");
        assert_eq!(json["tool"]["category"], "exec");
    }

    #[test]
    fn test_tool_result_event_serialization() {
        let event = ProtocolEvent::ToolResult {
            msg_id: "m1".to_string(),
            call_id: "c1".to_string(),
            tool_name: "Read".to_string(),
            status: ToolStatus::Success,
            output: "file content".to_string(),
            output_type: OutputType::Text,
            metadata: None,
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "tool_result");
        assert_eq!(json["status"], "success");
        assert!(json.get("metadata").is_none());
    }

    #[test]
    fn test_error_event_serialization() {
        let event = ProtocolEvent::Error {
            msg_id: None,
            error: ErrorInfo {
                code: "rate_limit".to_string(),
                message: "Too many requests".to_string(),
                retryable: true,
            },
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "error");
        assert!(json.get("msg_id").is_none());
        assert_eq!(json["error"]["retryable"], true);
    }

    #[test]
    fn test_stream_end_with_usage() {
        let event = ProtocolEvent::StreamEnd {
            msg_id: "m1".to_string(),
            usage: Some(Usage {
                input_tokens: 100,
                output_tokens: 50,
                cache_read_tokens: Some(20),
                cache_write_tokens: None,
            }),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "stream_end");
        assert_eq!(json["usage"]["input_tokens"], 100);
        assert!(json["usage"].get("cache_write_tokens").is_none());
    }

    #[test]
    fn test_tool_category_display() {
        assert_eq!(ToolCategory::Info.to_string(), "info");
        assert_eq!(ToolCategory::Edit.to_string(), "edit");
        assert_eq!(ToolCategory::Exec.to_string(), "exec");
        assert_eq!(ToolCategory::Mcp.to_string(), "mcp");
    }

    #[test]
    fn test_ready_event_with_expanded_capabilities() {
        let event = ProtocolEvent::Ready {
            version: "0.2.0".to_string(),
            session_id: Some("abc".to_string()),
            capabilities: Capabilities {
                tool_approval: true,
                thinking: true,
                effort: true,
                effort_levels: vec!["low".into(), "medium".into(), "high".into()],
                modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
                current_mode: "default".into(),
                mcp: false,
            },
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["capabilities"]["thinking"], true);
        assert_eq!(json["capabilities"]["effort"], true);
        assert_eq!(json["capabilities"]["effort_levels"][0], "low");
        assert_eq!(json["capabilities"]["modes"][2], "yolo");
    }

    #[test]
    fn test_mcp_ready_event_serialization() {
        let event = ProtocolEvent::McpReady {
            name: "team-tools".to_string(),
            tools: vec!["team_send_message".into(), "team_task_create".into()],
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "mcp_ready");
        assert_eq!(json["name"], "team-tools");
        assert_eq!(json["tools"][0], "team_send_message");
        assert_eq!(json["tools"][1], "team_task_create");
        assert_eq!(json["tools"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_pong_event_serialization() {
        let event = ProtocolEvent::Pong;
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "pong");
        assert_eq!(json.as_object().unwrap().len(), 1);
    }

    #[test]
    fn test_config_changed_event_serialization() {
        let event = ProtocolEvent::ConfigChanged {
            capabilities: Capabilities {
                tool_approval: true,
                thinking: false,
                effort: true,
                effort_levels: vec!["low".into(), "medium".into(), "high".into()],
                modes: vec!["default".into(), "auto_edit".into(), "yolo".into()],
                current_mode: "default".into(),
                mcp: true,
            },
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "config_changed");
        assert_eq!(json["capabilities"]["thinking"], false);
        assert_eq!(json["capabilities"]["effort"], true);
    }
}
