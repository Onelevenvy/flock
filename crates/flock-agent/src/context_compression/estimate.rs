use flock_core::types::message::{ContentBlock, Message};

const CHARS_PER_TOKEN_TEXT: usize = 4;

const CHARS_PER_TOKEN_JSON: usize = 3;

/// Estimate the total token count for a slice of messages.
///
/// Intentionally conservative (slightly over-estimates) to ensure
/// compaction triggers rather than being skipped.
pub fn estimate_tokens_from_messages(messages: &[Message], system_prompt: Option<&str>) -> u64 {
    let mut total_chars: usize = system_prompt.map(|s| s.len()).unwrap_or(0);
    let mut json_chars: usize = 0;

    for msg in messages {
        for block in &msg.content {
            match block {
                ContentBlock::Text { text } => {
                    total_chars += text.len();
                }
                ContentBlock::Thinking { thinking } => {
                    total_chars += thinking.len();
                }
                ContentBlock::ToolUse { name, input, .. } => {
                    let input_str = input.to_string();
                    json_chars += name.len() + input_str.len();
                }
                ContentBlock::ToolResult { content, .. } => {
                    total_chars += content.len();
                }
            }
        }
    }

    let text_tokens = total_chars / CHARS_PER_TOKEN_TEXT;
    let json_tokens = json_chars / CHARS_PER_TOKEN_JSON;

    (text_tokens + json_tokens) as u64
}

