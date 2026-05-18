//! Autocompact: watermark-triggered LLM summarization.
//!
//! When the token watermark exceeds the configured threshold, this module
//! calls the LLM to produce a structured summary of the conversation,
//! then replaces the full history with a context_compression boundary marker and the
//! summary.  A circuit breaker prevents runaway retries.

use flock_core::config::compression::CompressionConfig;
use flock_core::types::compact::{CompressionMetadata, CompressionTrigger};
use flock_core::types::message::{ContentBlock, Message, Role};
use langgraph_checkpoint::config::RunnableConfig;
use langgraph_prebuilt::BaseChatModel;

use super::prompt::{
    build_compact_prompt, build_summary_content,
    format_compact_summary,
};
use super::state::CompactState;

/// Maximum number of prompt-too-long retries.
const MAX_PTL_RETRIES: u32 = 2;

/// Content prefix for the context_compression boundary marker message.
pub const BOUNDARY_PREFIX: &str = "[Conversation compacted]";

// ── Public types ────────────────────────────────────────────────────────────

/// Result of a successful autocompact operation.
#[derive(Debug, Clone)]
pub struct CompactResult {
    /// Post-context_compression messages that replace the original conversation.
    /// Contains a boundary marker and a summary message.
    pub messages: Vec<Message>,
    /// How many original messages were summarized.
    pub messages_summarized: usize,
    /// Input token count before compaction (from the last API call).
    pub pre_compact_tokens: u64,
}

/// Errors specific to autocompact.
#[derive(Debug, thiserror::Error)]
pub enum CompactError {
    #[error("LLM provider error: {0}")]
    Provider(String),
    #[error("Prompt too long after {attempts} retries")]
    PromptTooLong { attempts: u32 },
    #[error("Empty response from LLM")]
    EmptyResponse,
    #[error("Stream error: {0}")]
    StreamError(String),
    #[error("Circuit breaker tripped after {failures} consecutive failures")]
    CircuitBroken { failures: u32 },
}

// ── Trigger check ───────────────────────────────────────────────────────────

/// Check if autocompact should trigger based on the token watermark.
///
/// Returns `true` when `last_input_tokens` >= the autocompact threshold:
/// `threshold = context_window - output_reserve - autocompact_buffer`
pub fn should_autocompact(last_input_tokens: u64, config: &CompressionConfig) -> bool {
    if !config.enabled {
        return false;
    }
    let effective_window = config.context_window.saturating_sub(config.output_reserve);
    let threshold = effective_window.saturating_sub(config.autocompact_buffer);
    last_input_tokens as usize >= threshold
}

// ── Core autocompact ────────────────────────────────────────────────────────

/// Execute autocompact: call LLM to summarize the conversation.
///
/// 1. Build a summary prompt and send conversation + prompt to the LLM.
/// 2. If the prompt is too long, truncate oldest 20% messages and retry
///    (up to [`MAX_PTL_RETRIES`] times).
/// 3. Parse the `<summary>` from the response.
/// 4. Return a [`CompactResult`] with boundary marker + summary messages.
///
/// On failure, increments `state.consecutive_failures`.
/// On success, resets the failure counter.
pub async fn autocompact(
    provider: &dyn BaseChatModel,
    messages: &[flock_core::types::message::Message],
    _model: &str,
    config: &CompressionConfig,
    state: &mut CompactState,
) -> Result<CompactResult, CompactError> {
    // Circuit breaker check
    if state.is_circuit_broken(config) {
        return Err(CompactError::CircuitBroken {
            failures: state.consecutive_failures,
        });
    }

    let pre_compact_tokens = state.last_input_tokens;
    let messages_summarized = messages.len();

    // Build messages for the context_compression LLM call: conversation + summary prompt
    let mut conv_messages: Vec<langgraph_prebuilt::Message> = messages.iter()
        .filter_map(|m| serde_json::from_value(serde_json::to_value(m).ok()?).ok())
        .collect();
    
    conv_messages.push(langgraph_prebuilt::Message::human(build_compact_prompt()));

    let mut ptl_attempts = 0u32;
    let runnable_config = RunnableConfig::new();

    let summary_text = loop {
        match provider.ainvoke(&conv_messages[..], &runnable_config).await {
            Ok(msg) => break msg.text().unwrap_or_default().to_string(),
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("context_length_exceeded") && ptl_attempts < MAX_PTL_RETRIES {
                     ptl_attempts += 1;
                     let conversation_part = &conv_messages[..conv_messages.len() - 1];
                     match truncate_for_retry(conversation_part) {
                         Some(mut truncated) => {
                             truncated.push(langgraph_prebuilt::Message::human(build_compact_prompt()));
                             conv_messages = truncated;
                             continue;
                         }
                         None => {
                             state.record_failure();
                             return Err(CompactError::PromptTooLong { attempts: ptl_attempts });
                         }
                     }
                }
                state.record_failure();
                return Err(CompactError::Provider(err_str));
            }
        }
    };

    if summary_text.trim().is_empty() {
        state.record_failure();
        return Err(CompactError::EmptyResponse);
    }

    // Format and build post-context_compression messages
    let formatted = format_compact_summary(&summary_text);
    let summary_content = build_summary_content(&formatted, true);

    let metadata = CompressionMetadata {
        trigger: CompressionTrigger::Auto,
        pre_compact_tokens,
        messages_summarized,
    };

    let boundary_text = format!(
        "{BOUNDARY_PREFIX}\n{}",
        serde_json::to_string(&metadata).expect("CompactMetadata serialization cannot fail")
    );

    let boundary_msg = Message::new(
        Role::User,
        vec![ContentBlock::Text {
            text: boundary_text,
        }],
    );

    let summary_msg = Message::new(
        Role::User,
        vec![ContentBlock::Text {
            text: summary_content,
        }],
    );

    state.record_success();

    Ok(CompactResult {
        messages: vec![boundary_msg, summary_msg],
        messages_summarized,
        pre_compact_tokens,
    })
}

// ── Helpers ─────────────────────────────────────────────────────────────────


/// Truncate the oldest ~20% of messages for PTL retry.
///
/// Returns `None` if there are too few messages to truncate meaningfully.
fn truncate_for_retry(messages: &[langgraph_prebuilt::Message]) -> Option<Vec<langgraph_prebuilt::Message>> {
    if messages.len() < 2 {
        return None;
    }

    let drop_count = (messages.len() / 5).max(1);
    if drop_count >= messages.len() {
        return None;
    }

    let remaining = &messages[drop_count..];
    let mut result = Vec::with_capacity(remaining.len() + 1);

    // Ensure the first message is User role for API compatibility
    if !matches!(remaining.first(), Some(langgraph_prebuilt::Message::Human { .. })) {
        result.push(langgraph_prebuilt::Message::human("[earlier conversation truncated for compaction retry]"));
    }

    result.extend_from_slice(remaining);
    Some(result)
}

/// Check if a message is a context_compression boundary marker.
pub fn is_compact_boundary(message: &Message) -> bool {
    message.content.iter().any(|block| {
        if let ContentBlock::Text { text } = block {
            text.starts_with(BOUNDARY_PREFIX)
        } else {
            false
        }
    })
}

/// Extract [`CompressionMetadata`] from a boundary marker message.
pub fn extract_compact_metadata(message: &Message) -> Option<CompressionMetadata> {
    for block in &message.content {
        if let ContentBlock::Text { text } = block
            && let Some(json_str) = text.strip_prefix(BOUNDARY_PREFIX)
        {
            let json_str = json_str.trim_start_matches('\n');
            return serde_json::from_str(json_str).ok();
        }
    }
    None
}
