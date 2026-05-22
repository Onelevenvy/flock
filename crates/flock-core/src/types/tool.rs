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

/// A bilingual string containing both Chinese and English translations.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct I18nString {
    pub zh: String,
    pub en: String,
}

impl I18nString {
    pub fn new(zh: impl Into<String>, en: impl Into<String>) -> Self {
        Self {
            zh: zh.into(),
            en: en.into(),
        }
    }

    /// Construct a single bilingual string where zh and en are the same.
    pub fn single(val: impl Into<String>) -> Self {
        let val_str = val.into();
        Self {
            zh: val_str.clone(),
            en: val_str,
        }
    }
}

/// Metadata for a tool provider (displayed in the UI).
#[derive(Debug, Clone)]
pub struct ProviderInfo {
    pub provider_id: String,
    pub provider_name: I18nString,
    pub description: I18nString,
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

