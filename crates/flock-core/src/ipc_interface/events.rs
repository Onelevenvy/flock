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
