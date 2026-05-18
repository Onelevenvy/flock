use serde_json::Value;

/// Schema for a tool parameter, in JSON Schema format
pub type JsonSchema = Value;

/// Maximum chars kept from a deferred tool's description.
const DEFERRED_DESC_MAX_CHARS: usize = 200;

/// Truncate a description for a deferred tool stub.
///
/// Keeps up to the first blank line or `DEFERRED_DESC_MAX_CHARS` characters
/// (whichever is shorter). If the text was trimmed, an ellipsis is appended.
pub fn truncate_for_deferred_stub(desc: &str) -> String {
    // Find first blank line (double newline)
    let end_at_blank = desc.find("\n\n").unwrap_or(desc.len());
    let limit = end_at_blank.min(DEFERRED_DESC_MAX_CHARS);

    if limit >= desc.len() {
        return desc.to_string();
    }

    // Avoid cutting in the middle of a UTF-8 char boundary
    let safe_end = desc
        .char_indices()
        .take_while(|(i, _)| *i < limit)
        .last()
        .map(|(i, c)| i + c.len_utf8())
        .unwrap_or(0);

    format!("{}…", &desc[..safe_end])
}

/// Definition of a tool for the API
#[derive(Debug, Clone)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub input_schema: JsonSchema,
    /// Whether this tool's full schema is deferred (only name + stub sent to LLM).
    pub deferred: bool,
    pub category: String,
    pub provider_id: String,
    pub provider_name: String,
    pub needs_auth: bool,
}

/// Metadata for a tool provider (displayed in the UI).
#[derive(Debug, Clone)]
pub struct ProviderInfo {
    pub provider_id: String,
    pub provider_name: String,
    pub description: String,
    pub icon: Option<String>,
    /// JSON schema describing the credentials this provider requires.
    /// If Some → provider needs auth; if None → no auth needed.
    /// Example: `{"OPEN_WEATHER_API_KEY": {"type": "string", "description": "..."}}`
    pub credentials_schema: Option<serde_json::Value>,
    /// Sample input used to test the tool's connectivity.
    /// If Some, `test_tool_provider` will execute the actual tool with this input.
    pub test_input: Option<serde_json::Value>,
}

/// Result from executing a tool
#[derive(Debug, Clone)]
pub struct ToolResult {
    pub content: String,
    pub is_error: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // --- ToolDef construction and field validation ---

    #[test]
    fn test_tool_def_construction_fields() {
        // arrange
        let schema = json!({
            "type": "object",
            "properties": {
                "cmd": { "type": "string" }
            },
            "required": ["cmd"]
        });
        // act
        let tool = ToolDef {
            name: "bash".to_string(),
            description: "Run a shell command".to_string(),
            input_schema: schema.clone(),
            deferred: false,
            category: "Exec".to_string(),
            provider_id: "builtin".to_string(),
            provider_name: "Built-in Tools".to_string(),
            needs_auth: false,
        };
        // assert
        assert_eq!(tool.name, "bash");
        assert_eq!(tool.description, "Run a shell command");
        assert_eq!(tool.input_schema, schema);
    }

    #[test]
    fn test_tool_def_empty_schema_is_valid() {
        // arrange + act
        let tool = ToolDef {
            name: "noop".to_string(),
            description: "Does nothing".to_string(),
            input_schema: json!({}),
            deferred: false,
            category: "Info".to_string(),
            provider_id: "builtin".to_string(),
            provider_name: "Built-in Tools".to_string(),
            needs_auth: false,
        };
        // assert
        assert_eq!(tool.input_schema, json!({}));
    }

    // --- ToolResult success scenario ---

    #[test]
    fn test_tool_result_success_is_error_false() {
        // arrange + act
        let result = ToolResult {
            content: "command output".to_string(),
            is_error: false,
        };
        // assert
        assert_eq!(result.content, "command output");
        assert!(!result.is_error);
    }

    // --- ToolResult error scenario ---

    #[test]
    fn test_tool_result_error_is_error_true() {
        // arrange + act
        let result = ToolResult {
            content: "permission denied".to_string(),
            is_error: true,
        };
        // assert
        assert_eq!(result.content, "permission denied");
        assert!(result.is_error);
    }

    #[test]
    fn test_tool_result_error_empty_content() {
        // arrange + act – errors may carry an empty content string
        let result = ToolResult {
            content: String::new(),
            is_error: true,
        };
        // assert
        assert!(result.content.is_empty());
        assert!(result.is_error);
    }

    #[test]
    fn test_tool_def_deferred_defaults_to_false() {
        let tool = ToolDef {
            name: "test".to_string(),
            description: "desc".to_string(),
            input_schema: json!({}),
            deferred: false,
            category: "Info".to_string(),
            provider_id: "builtin".to_string(),
            provider_name: "Built-in Tools".to_string(),
            needs_auth: false,
        };
        assert!(!tool.deferred);
    }

    #[test]
    fn test_tool_def_deferred_true() {
        let tool = ToolDef {
            name: "spawn".to_string(),
            description: "desc".to_string(),
            input_schema: json!({}),
            deferred: true,
            category: "Info".to_string(),
            provider_id: "builtin".to_string(),
            provider_name: "Built-in Tools".to_string(),
            needs_auth: false,
        };
        assert!(tool.deferred);
    }

    // --- truncate_deferred_description tests ---

    #[test]
    fn truncate_short_description_unchanged() {
        let desc = "Search for issues in Sentry.";
        assert_eq!(truncate_for_deferred_stub(desc), desc);
    }

    #[test]
    fn truncate_at_blank_line() {
        let desc = "First paragraph here.\n\nSecond paragraph with details.";
        assert_eq!(
            truncate_for_deferred_stub(desc),
            "First paragraph here.…"
        );
    }

    #[test]
    fn truncate_at_200_chars_before_blank_line() {
        let desc = format!("{}. More text after.", "A".repeat(200));
        let result = truncate_for_deferred_stub(&desc);
        assert!(result.len() <= 200 + '…'.len_utf8());
        assert!(result.ends_with('…'));
    }

    #[test]
    fn truncate_blank_line_before_200_chars() {
        let desc = "Short first paragraph.\n\nLong second paragraph that goes on and on.";
        let result = truncate_for_deferred_stub(desc);
        assert_eq!(result, "Short first paragraph.…");
    }

    #[test]
    fn truncate_empty_string() {
        assert_eq!(truncate_for_deferred_stub(""), "");
    }

    #[test]
    fn truncate_exactly_200_chars() {
        let desc = "X".repeat(200);
        assert_eq!(truncate_for_deferred_stub(&desc), desc);
    }

    #[test]
    fn truncate_201_chars() {
        let desc = "X".repeat(201);
        let result = truncate_for_deferred_stub(&desc);
        assert!(result.ends_with('…'));
        // 200 X's + ellipsis
        assert_eq!(result.len(), 200 + '…'.len_utf8());
    }

    #[test]
    fn truncate_multibyte_chars_safe() {
        // 100 two-byte chars = 200 bytes, but only 100 char positions
        let desc: String = "é".repeat(150);
        let result = truncate_for_deferred_stub(&desc);
        // Should not panic and should be valid UTF-8
        assert!(result.ends_with('…'));
        // Should be at most 200 chars (counting code points)
        let char_count = result.chars().count();
        assert!(char_count <= 201); // 200 chars + ellipsis
    }
}
