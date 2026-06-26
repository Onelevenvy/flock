use std::sync::Arc;
use crate::graph::NodeContext;
use langgraph::prebuilt::types::{Message as LgMessage, MessageContent, ContentBlock as LgContentBlock};
use flock_core::types::message::ContentBlock;

/// AgentMiddleware defines hooks that run at different stages of the LLM/Tool execution loop.
pub trait AgentMiddleware: Send + Sync {
    /// Runs before invoking the LLM provider, allowing modification of the system prompt and message list.
    fn before_llm_call(
        &self,
        _ctx: &NodeContext,
        _system_prompt: &mut String,
        _messages: &mut Vec<LgMessage>,
    ) {}

    /// Runs after tools have executed, allowing inspection or modification of tool results before they return.
    fn post_tool_execution(
        &self,
        _ctx: &NodeContext,
        _results: &mut Vec<ContentBlock>,
    ) {}
}

/// Merges consecutive or trailing SystemMessages into the leading system prompt
/// to satisfy provider constraints (e.g. Anthropic, Qwen, vLLM which reject multiple system messages).
pub struct SystemMessageCoalescing;

impl AgentMiddleware for SystemMessageCoalescing {
    fn before_llm_call(
        &self,
        _ctx: &NodeContext,
        system_prompt: &mut String,
        messages: &mut Vec<LgMessage>,
    ) {
        let mut extra_system_contents = Vec::new();
        
        // Retain only non-system messages, collecting system message text
        let mut i = 0;
        while i < messages.len() {
            if let LgMessage::System { content, .. } = &messages[i] {
                match content {
                    MessageContent::Text(text) => {
                        extra_system_contents.push(text.clone());
                    }
                    MessageContent::Blocks(blocks) => {
                        for block in blocks {
                            if let LgContentBlock::Text { text } = block {
                                extra_system_contents.push(text.clone());
                            }
                        }
                    }
                }
                messages.remove(i);
            } else {
                i += 1;
            }
        }

        if !extra_system_contents.is_empty() {
            log::info!("[middleware] Coalescing {} extra system messages into main system prompt", extra_system_contents.len());
            for extra in extra_system_contents {
                system_prompt.push_str("\n\n");
                system_prompt.push_str(&extra);
            }
        }
    }
}

/// Enforces a token/character budget limit on individual tool output results
/// to prevent giant tool outputs (e.g. large file reads or endless bash logs) from overflowing LLM context.
pub struct ToolOutputBudget {
    pub max_characters: usize,
}

impl Default for ToolOutputBudget {
    fn default() -> Self {
        Self {
            max_characters: 50_000, // Safe default boundary (~12k-15k tokens)
        }
    }
}

impl AgentMiddleware for ToolOutputBudget {
    fn post_tool_execution(
        &self,
        _ctx: &NodeContext,
        results: &mut Vec<ContentBlock>,
    ) {
        for result in results.iter_mut() {
            if let ContentBlock::ToolResult { content, .. } = result {
                if content.len() > self.max_characters {
                    log::warn!(
                        "[middleware] Tool output length {} exceeds limit {}, truncating...",
                        content.len(),
                        self.max_characters
                    );
                    let truncated = &content[..self.max_characters];
                    *content = format!(
                        "{}\n\n[... Tool Output Truncated by ToolOutputBudget to preserve context context ...]",
                        truncated
                    );
                }
            }
        }
    }
}
