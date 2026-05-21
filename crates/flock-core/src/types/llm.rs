use serde_json::Value;

use crate::types::message::{StopReason, TokenUsage, ToolUseId};
use crate::types::tool::ToolDef;

/// A request to the LLM provider
#[derive(Debug, Clone)]
pub struct LlmRequest {
    pub model: String,
    pub system: String,
    pub messages: Vec<crate::types::message::Message>,
    pub tools: Vec<ToolDef>,
    pub max_tokens: u32,
    /// Optional: thinking config (Anthropic extended thinking)
    pub thinking: Option<ThinkingConfig>,
    /// Optional: reasoning effort for OpenAI reasoning models (low/medium/high)
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone)]
pub enum ThinkingConfig {
    Enabled { budget_tokens: u32 },
    Disabled,
}

/// Streaming events from the LLM
#[derive(Debug, Clone)]
pub enum LlmEvent {
    /// Incremental text output
    TextDelta(String),
    /// Complete tool call (after accumulating streaming deltas)
    ToolUse {
        id: ToolUseId,
        name: String,
        input: Value,
    },
    /// Thinking content (Anthropic only)
    ThinkingDelta(String),
    /// Response complete
    Done {
        stop_reason: StopReason,
        usage: TokenUsage,
    },
    /// Error from the API
    Error(String),
}

