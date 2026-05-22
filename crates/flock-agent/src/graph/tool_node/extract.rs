use serde_json::Value as JsonValue;
use flock_core::types::message::ContentBlock;

/// Extract tool calls from the last AI message in the state.
pub fn extract_tool_calls(input: &JsonValue) -> Vec<ContentBlock> {
    let messages = match input.get("messages") {
        Some(JsonValue::Array(arr)) => arr,
        _ => return vec![],
    };

    for msg in messages.iter().rev() {
        if let Some(obj) = msg.as_object() {
            let role = obj.get("role").and_then(|v| v.as_str());
            let msg_type = obj.get("type").and_then(|v| v.as_str());

            // Match AI messages (either role="assistant" or type="ai")
            if role == Some("assistant") || msg_type == Some("ai") {
                if let Some(JsonValue::Array(calls)) = obj.get("tool_calls") {
                    return calls
                        .iter()
                        .filter_map(|tc| serde_json::from_value(tc.clone()).ok())
                        .collect();
                }
                // Also check content array for ToolUse blocks
                if let Some(JsonValue::Array(content)) = obj.get("content") {
                    let tool_uses: Vec<ContentBlock> = content
                        .iter()
                        .filter_map(|block| {
                            if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                serde_json::from_value(block.clone()).ok()
                            } else {
                                None
                            }
                        })
                        .collect();
                    if !tool_uses.is_empty() {
                        return tool_uses;
                    }
                }
            }
        }
    }

    vec![]
}
