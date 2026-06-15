use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Unique identifier for a tool call
pub type ToolUseId = String;

/// A single content block within a message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    /// Plain text content
    #[serde(rename = "text")]
    Text { text: String },

    /// A tool invocation from the assistant
    #[serde(rename = "tool_use")]
    ToolUse {
        id: ToolUseId,
        name: String,
        input: Value,
    },

    /// Result of a tool execution, sent back as user message
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: ToolUseId,
        content: String,
        is_error: bool,
    },

    /// An image block, containing base64 encoded image data
    #[serde(rename = "image")]
    Image {
        media_type: String,
        data: String,
    },

    /// Thinking / reasoning block. Serialized as `thinking` for Anthropic
    /// and as `reasoning_content` for OpenAI-compatible providers.
    #[serde(rename = "thinking")]
    Thinking { thinking: String },
}

/// A message in the conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<ContentBlock>,
    /// When this message was created.  Used by microcompact to decide
    /// whether old tool results should be cleared.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
}

impl Message {
    /// Create a message without a timestamp (backward-compatible default).
    pub fn new(role: Role, content: Vec<ContentBlock>) -> Self {
        Self {
            role,
            content,
            timestamp: None,
        }
    }

    /// Create a message stamped with the current UTC time.
    pub fn now(role: Role, content: Vec<ContentBlock>) -> Self {
        Self {
            role,
            content,
            timestamp: Some(Utc::now()),
        }
    }

    /// 创建带有文本内容的 System 消息（不带时间戳）。
    pub fn system(text: impl Into<String>) -> Self {
        Self::new(Role::System, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建带有文本内容的 User（Human）消息（不带时间戳）。
    pub fn human(text: impl Into<String>) -> Self {
        Self::new(Role::User, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建带有文本内容的 Assistant（AI）消息（不带时间戳）。
    pub fn ai(text: impl Into<String>) -> Self {
        Self::new(Role::Assistant, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建 Tool 结果消息（不带时间戳）。
    pub fn tool_result(tool_use_id: impl Into<String>, content: impl Into<String>, is_error: bool) -> Self {
        Self::new(
            Role::Tool,
            vec![ContentBlock::ToolResult {
                tool_use_id: tool_use_id.into(),
                content: content.into(),
                is_error,
            }],
        )
    }

    /// 创建带有文本内容的 System 消息（带当前 UTC 时间戳）。
    pub fn system_now(text: impl Into<String>) -> Self {
        Self::now(Role::System, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建带有文本内容的 User（Human）消息（带当前 UTC 时间戳）。
    pub fn human_now(text: impl Into<String>) -> Self {
        Self::now(Role::User, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建带有文本内容的 Assistant（AI）消息（带当前 UTC 时间戳）。
    pub fn ai_now(text: impl Into<String>) -> Self {
        Self::now(Role::Assistant, vec![ContentBlock::Text { text: text.into() }])
    }

    /// 创建 Tool 结果消息（带当前 UTC 时间戳）。
    pub fn tool_result_now(tool_use_id: impl Into<String>, content: impl Into<String>, is_error: bool) -> Self {
        Self::now(
            Role::Tool,
            vec![ContentBlock::ToolResult {
                tool_use_id: tool_use_id.into(),
                content: content.into(),
                is_error,
            }],
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
    System,
    Tool,
}

/// Why the model stopped generating
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StopReason {
    /// Model finished naturally
    EndTurn,
    /// Model wants to call tools
    ToolUse,
    /// Hit max_tokens limit
    MaxTokens,
    /// Hit max_turns limit
    MaxTurns,
}

/// Token usage statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
}

