use flock_core::types::message::{ContentBlock, Message, Role};
use langgraph::prebuilt::types::Message as LgMessage;

/// Convert a Flock `Message` into a LangGraph `LgMessage`.
///
/// Handles all content block types: Text, Thinking, ToolUse, ToolResult, and Image.
/// Tool result messages are converted to Tool messages with appropriate status.
/// Image content blocks are converted to ImageUrl blocks for multimodal support.
pub fn to_langgraph_message(flock_msg: Message) -> LgMessage {
    let mut text = String::new();
    let mut thinking = None;
    let mut tool_calls = Vec::new();
    let mut lg_blocks = Vec::new();

    let mut tool_call_id_opt = None;
    let mut is_error_opt = false;

    for block in flock_msg.content {
        match block {
            ContentBlock::Text { text: t } => {
                text.push_str(&t);
                lg_blocks.push(langgraph::prebuilt::types::ContentBlock::Text { text: t });
            }
            ContentBlock::Thinking { thinking: t } => thinking = Some(t),
            ContentBlock::ToolUse { id, name, input } => {
                tool_calls.push(langgraph::prebuilt::ToolCall {
                    id: Some(id),
                    name,
                    args: input,
                });
            }
            ContentBlock::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                tool_call_id_opt = Some(tool_use_id);
                is_error_opt = is_error;
                lg_blocks.push(langgraph::prebuilt::types::ContentBlock::Text {
                    text: content.clone(),
                });
                text.push_str(&content);
            }
            ContentBlock::Image { media_type, data } => {
                lg_blocks.push(langgraph::prebuilt::types::ContentBlock::ImageUrl {
                    image_url: langgraph::prebuilt::types::ImageUrl {
                        url: format!("data:{};base64,{}", media_type, data),
                        detail: None,
                    },
                });
            }
        }
    }

    if let Some(tool_use_id) = tool_call_id_opt {
        return LgMessage::Tool {
            tool_call_id: tool_use_id,
            content: langgraph::prebuilt::types::MessageContent::Blocks(lg_blocks),
            name: None,
            id: None,
            status: if is_error_opt {
                "error".to_string()
            } else {
                "success".to_string()
            },
        };
    }

    match flock_msg.role {
        Role::System => LgMessage::system(text),
        Role::User => {
            let has_image = lg_blocks.iter().any(|b| {
                matches!(
                    b,
                    langgraph::prebuilt::types::ContentBlock::ImageUrl { .. }
                )
            });
            if has_image {
                LgMessage::Human {
                    content: langgraph::prebuilt::types::MessageContent::Blocks(lg_blocks),
                    id: None,
                }
            } else {
                LgMessage::human(text)
            }
        }
        Role::Assistant => {
            if tool_calls.is_empty() {
                let mut msg = LgMessage::ai(text);
                if let LgMessage::Ai {
                    thinking: ref mut th,
                    ..
                } = msg
                {
                    *th = thinking;
                }
                msg
            } else {
                let mut msg = LgMessage::ai_with_tool_calls(text, tool_calls);
                if let LgMessage::Ai {
                    thinking: ref mut th,
                    ..
                } = msg
                {
                    *th = thinking;
                }
                msg
            }
        }
        Role::Tool => LgMessage::System {
            content: langgraph::prebuilt::types::MessageContent::Text(
                "unknown tool result".to_string(),
            ),
            id: None,
        },
    }
}
