use serde_json::Value as JsonValue;

/// Route after LLM: if the AI message has tool_calls, go to tools node.
pub fn route_after_llm(input: &JsonValue) -> String {
    let has_tools = input
        .get("messages")
        .and_then(|v| v.as_array())
        .and_then(|msgs| msgs.last())
        .and_then(|msg| {
            // Check tool_calls field (langgraph format)
            if let Some(calls) = msg.get("tool_calls") {
                if let Some(arr) = calls.as_array() {
                    if !arr.is_empty() {
                        return Some(true);
                    }
                }
            }
            // Check content array for ToolUse blocks (flock format)
            if let Some(content) = msg.get("content").and_then(|v| v.as_array()) {
                let has_tool_use = content.iter().any(|block| {
                    block.get("type").and_then(|v| v.as_str()) == Some("tool_use")
                });
                if has_tool_use {
                    return Some(true);
                }
            }
            None
        })
        .unwrap_or(false);

    eprintln!("[route] route_after_llm: has_tools={}", has_tools);

    if has_tools {
        "tools".to_string()
    } else {
        langgraph::constants::END.to_string()
    }
}

/// Route after tools: go to END on quit, otherwise back to compaction.
pub fn route_after_tools(input: &JsonValue) -> String {
    // quit 时 FlockToolNode 设置了 quit_requested=true
    if input.get("quit_requested").and_then(|v| v.as_bool()).unwrap_or(false) {
        eprintln!("[route] route_after_tools: quit_requested=true, routing to END");
        return langgraph::constants::END.to_string();
    }
    "compaction".to_string()
}
