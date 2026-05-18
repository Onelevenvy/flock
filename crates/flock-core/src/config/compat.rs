// Configuration-driven provider compatibility layer.
// Each provider type has default presets; users can override any field via config.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Provider-level compatibility settings.
/// Each field is Option — None means "use provider-type default".
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProviderCompat {
    /// Field name for max tokens in request body.
    /// Default: "max_tokens" for all providers.
    pub max_tokens_field: Option<String>,

    /// Merge consecutive assistant messages (text concat + tool_calls merge).
    /// Default: true for openai.
    pub merge_assistant_messages: Option<bool>,

    /// Remove tool_use blocks that have no corresponding tool_result.
    /// Default: true for openai.
    pub clean_orphan_tool_calls: Option<bool>,

    /// Deduplicate tool results with same tool_call_id (keep last).
    /// Default: true for openai.
    pub dedup_tool_results: Option<bool>,

    /// Ensure messages alternate user/assistant (insert filler if needed).
    /// Default: true for anthropic/bedrock/vertex.
    pub ensure_alternation: Option<bool>,

    /// Merge consecutive same-role messages into one.
    /// Default: true for anthropic/bedrock/vertex.
    pub merge_same_role: Option<bool>,

    /// Sanitize JSON schemas for strict providers (remove additionalProperties, etc.).
    /// Default: true for bedrock.
    pub sanitize_schema: Option<bool>,

    /// Text patterns to strip from message history before sending.
    /// Default: empty.
    pub strip_patterns: Option<Vec<String>>,

    /// Auto-generate tool IDs when missing.
    /// Default: true for anthropic/bedrock/vertex.
    pub auto_tool_id: Option<bool>,

    /// Custom API path appended to base_url for chat completions.
    /// Default: "/v1/chat/completions" for OpenAI provider.
    /// Override to "/chat/completions" for providers like Gemini that include
    /// version prefix in the base URL itself.
    pub api_path: Option<String>,

    /// Whether this provider supports extended thinking (Anthropic-style).
    /// Default: true for anthropic/bedrock/vertex, false for openai.
    pub supports_thinking: Option<bool>,

    /// Whether this provider supports reasoning_effort (OpenAI-style).
    /// Default: false for anthropic/bedrock/vertex, true for openai.
    pub supports_effort: Option<bool>,

    /// Available effort levels for this provider (e.g., ["low", "medium", "high"]).
    /// Only meaningful when supports_effort is true.
    pub effort_levels: Option<Vec<String>>,
}

impl ProviderCompat {
    /// Defaults for Anthropic-family providers (Anthropic, Vertex)
    pub fn anthropic_defaults() -> Self {
        Self {
            ensure_alternation: Some(true),
            merge_same_role: Some(true),
            auto_tool_id: Some(true),
            supports_thinking: Some(true),
            supports_effort: Some(false),
            ..Default::default()
        }
    }

    /// Defaults for Bedrock (Anthropic + schema sanitization)
    pub fn bedrock_defaults() -> Self {
        Self {
            ensure_alternation: Some(true),
            merge_same_role: Some(true),
            auto_tool_id: Some(true),
            sanitize_schema: Some(true),
            supports_thinking: Some(true),
            supports_effort: Some(false),
            ..Default::default()
        }
    }

    /// Defaults for OpenAI-compatible providers
    pub fn openai_defaults() -> Self {
        Self {
            max_tokens_field: Some("max_tokens".into()),
            merge_assistant_messages: Some(true),
            clean_orphan_tool_calls: Some(true),
            dedup_tool_results: Some(true),
            supports_thinking: Some(false),
            supports_effort: Some(true),
            effort_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            ..Default::default()
        }
    }

    /// Merge user config over defaults (user wins on non-None fields)
    pub fn merge(defaults: Self, user: Self) -> Self {
        Self {
            max_tokens_field: user.max_tokens_field.or(defaults.max_tokens_field),
            merge_assistant_messages: user
                .merge_assistant_messages
                .or(defaults.merge_assistant_messages),
            clean_orphan_tool_calls: user
                .clean_orphan_tool_calls
                .or(defaults.clean_orphan_tool_calls),
            dedup_tool_results: user.dedup_tool_results.or(defaults.dedup_tool_results),
            ensure_alternation: user.ensure_alternation.or(defaults.ensure_alternation),
            merge_same_role: user.merge_same_role.or(defaults.merge_same_role),
            sanitize_schema: user.sanitize_schema.or(defaults.sanitize_schema),
            strip_patterns: user.strip_patterns.or(defaults.strip_patterns),
            auto_tool_id: user.auto_tool_id.or(defaults.auto_tool_id),
            api_path: user.api_path.or(defaults.api_path),
            supports_thinking: user.supports_thinking.or(defaults.supports_thinking),
            supports_effort: user.supports_effort.or(defaults.supports_effort),
            effort_levels: user.effort_levels.or(defaults.effort_levels),
        }
    }

    // --- Resolved accessors (Option<bool> → bool with false default) ---

    pub fn merge_assistant_messages(&self) -> bool {
        self.merge_assistant_messages.unwrap_or(false)
    }

    pub fn clean_orphan_tool_calls(&self) -> bool {
        self.clean_orphan_tool_calls.unwrap_or(false)
    }

    pub fn dedup_tool_results(&self) -> bool {
        self.dedup_tool_results.unwrap_or(false)
    }

    pub fn ensure_alternation(&self) -> bool {
        self.ensure_alternation.unwrap_or(false)
    }

    pub fn merge_same_role(&self) -> bool {
        self.merge_same_role.unwrap_or(false)
    }

    pub fn sanitize_schema(&self) -> bool {
        self.sanitize_schema.unwrap_or(false)
    }

    pub fn auto_tool_id(&self) -> bool {
        self.auto_tool_id.unwrap_or(false)
    }

    pub fn api_path(&self) -> &str {
        self.api_path.as_deref().unwrap_or("")
    }

    pub fn supports_thinking(&self) -> bool {
        self.supports_thinking.unwrap_or(false)
    }

    pub fn supports_effort(&self) -> bool {
        self.supports_effort.unwrap_or(false)
    }

    pub fn effort_levels(&self) -> &[String] {
        self.effort_levels.as_deref().unwrap_or(&[])
    }
}

/// Sanitize a JSON Schema for strict providers (e.g., Bedrock).
/// - Root type must be "object" (wrap if not)
/// - Recursively remove "additionalProperties"
/// - Normalize array types: ["string", "null"] → "string"
pub fn sanitize_json_schema(schema: &Value) -> Value {
    let mut schema = schema.clone();

    // Ensure root type is "object"
    if schema.get("type").and_then(|t| t.as_str()) != Some("object") {
        schema = serde_json::json!({
            "type": "object",
            "properties": {
                "value": schema
            },
            "required": ["value"]
        });
    }

    strip_additional_properties(&mut schema);
    normalize_array_types(&mut schema);
    schema
}

fn strip_additional_properties(val: &mut Value) {
    if let Some(obj) = val.as_object_mut() {
        obj.remove("additionalProperties");
        for v in obj.values_mut() {
            strip_additional_properties(v);
        }
    } else if let Some(arr) = val.as_array_mut() {
        for v in arr.iter_mut() {
            strip_additional_properties(v);
        }
    }
}

fn normalize_array_types(val: &mut Value) {
    if let Some(obj) = val.as_object_mut() {
        // Normalize ["string", "null"] → "string"
        if let Some(arr) = obj.get("type").and_then(Value::as_array) {
            let non_null: Vec<&Value> = arr.iter().filter(|v| v.as_str() != Some("null")).collect();
            if non_null.len() == 1 {
                obj.insert("type".to_string(), non_null[0].clone());
            }
        }
        for v in obj.values_mut() {
            normalize_array_types(v);
        }
    } else if let Some(arr) = val.as_array_mut() {
        for v in arr.iter_mut() {
            normalize_array_types(v);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_anthropic_defaults() {
        let compat = ProviderCompat::anthropic_defaults();
        assert!(compat.ensure_alternation());
        assert!(compat.merge_same_role());
        assert!(compat.auto_tool_id());
        assert!(!compat.sanitize_schema());
        assert!(!compat.merge_assistant_messages());
        assert!(!compat.clean_orphan_tool_calls());
    }

    #[test]
    fn test_bedrock_defaults() {
        let compat = ProviderCompat::bedrock_defaults();
        assert!(compat.ensure_alternation());
        assert!(compat.merge_same_role());
        assert!(compat.auto_tool_id());
        assert!(compat.sanitize_schema());
    }

    #[test]
    fn test_openai_defaults() {
        let compat = ProviderCompat::openai_defaults();
        assert!(compat.merge_assistant_messages());
        assert!(compat.clean_orphan_tool_calls());
        assert!(compat.dedup_tool_results());
        assert_eq!(compat.max_tokens_field.as_deref(), Some("max_tokens"));
        assert!(!compat.ensure_alternation());
    }

    #[test]
    fn test_merge_user_overrides_defaults() {
        let defaults = ProviderCompat::openai_defaults();
        let user = ProviderCompat {
            max_tokens_field: Some("max_completion_tokens".into()),
            merge_assistant_messages: Some(false),
            ..Default::default()
        };

        let merged = ProviderCompat::merge(defaults, user);
        assert_eq!(
            merged.max_tokens_field.as_deref(),
            Some("max_completion_tokens")
        );
        assert!(!merged.merge_assistant_messages());
        // Non-overridden fields keep defaults
        assert!(merged.clean_orphan_tool_calls());
        assert!(merged.dedup_tool_results());
    }

    #[test]
    fn test_merge_empty_user_keeps_defaults() {
        let defaults = ProviderCompat::anthropic_defaults();
        let user = ProviderCompat::default();

        let merged = ProviderCompat::merge(defaults, user);
        assert!(merged.ensure_alternation());
        assert!(merged.merge_same_role());
        assert!(merged.auto_tool_id());
    }

    #[test]
    fn test_sanitize_schema_wraps_non_object_root() {
        let schema = json!({"type": "string"});
        let sanitized = sanitize_json_schema(&schema);

        assert_eq!(sanitized["type"], "object");
        assert_eq!(sanitized["properties"]["value"]["type"], "string");
    }

    #[test]
    fn test_sanitize_schema_removes_additional_properties() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": {"type": "string", "additionalProperties": false}
            },
            "additionalProperties": false
        });
        let sanitized = sanitize_json_schema(&schema);

        assert!(sanitized.get("additionalProperties").is_none());
        assert!(
            sanitized["properties"]["name"]
                .get("additionalProperties")
                .is_none()
        );
    }

    #[test]
    fn test_sanitize_schema_normalizes_array_types() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]}
            }
        });
        let sanitized = sanitize_json_schema(&schema);

        assert_eq!(sanitized["properties"]["name"]["type"], "string");
    }

    #[test]
    fn test_sanitize_schema_no_change_for_valid_object() {
        let schema = json!({
            "type": "object",
            "properties": {
                "cmd": {"type": "string"}
            },
            "required": ["cmd"]
        });
        let sanitized = sanitize_json_schema(&schema);

        assert_eq!(sanitized["type"], "object");
        assert_eq!(sanitized["properties"]["cmd"]["type"], "string");
    }

    #[test]
    fn test_anthropic_defaults_capability_fields() {
        let compat = ProviderCompat::anthropic_defaults();
        assert_eq!(compat.supports_thinking, Some(true));
        assert_eq!(compat.supports_effort, Some(false));
        assert!(compat.effort_levels.is_none());
    }

    #[test]
    fn test_openai_defaults_capability_fields() {
        let compat = ProviderCompat::openai_defaults();
        assert_eq!(compat.supports_thinking, Some(false));
        assert_eq!(compat.supports_effort, Some(true));
        assert_eq!(
            compat.effort_levels,
            Some(vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string()
            ])
        );
    }

    #[test]
    fn test_bedrock_defaults_capability_fields() {
        let compat = ProviderCompat::bedrock_defaults();
        assert_eq!(compat.supports_thinking, Some(true));
        assert_eq!(compat.supports_effort, Some(false));
    }

    #[test]
    fn test_merge_capability_fields_user_overrides() {
        let defaults = ProviderCompat::openai_defaults();
        let user = ProviderCompat {
            supports_thinking: Some(true),
            ..Default::default()
        };
        let merged = ProviderCompat::merge(defaults, user);
        assert_eq!(merged.supports_thinking, Some(true));
        assert_eq!(merged.supports_effort, Some(true));
    }

    #[test]
    fn test_capability_accessors() {
        let compat = ProviderCompat::anthropic_defaults();
        assert!(compat.supports_thinking());
        assert!(!compat.supports_effort());
        assert!(compat.effort_levels().is_empty());

        let compat2 = ProviderCompat::openai_defaults();
        assert!(!compat2.supports_thinking());
        assert!(compat2.supports_effort());
        assert_eq!(compat2.effort_levels(), &["low", "medium", "high"]);
    }

    #[test]
    fn test_deserialize_from_toml() {
        let toml_str = r#"
max_tokens_field = "max_completion_tokens"
merge_assistant_messages = true
strip_patterns = ["__REASONING__"]
"#;
        let compat: ProviderCompat = toml::from_str(toml_str).unwrap();
        assert_eq!(
            compat.max_tokens_field.as_deref(),
            Some("max_completion_tokens")
        );
        assert_eq!(compat.merge_assistant_messages, Some(true));
        assert_eq!(
            compat.strip_patterns,
            Some(vec!["__REASONING__".to_string()])
        );
        assert!(compat.clean_orphan_tool_calls.is_none());
    }
}
