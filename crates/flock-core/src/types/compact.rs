use serde::{Deserialize, Serialize};

/// How a compaction was triggered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompressionTrigger {
    /// Triggered automatically when token usage exceeded the watermark.
    Auto,
    /// Triggered manually by the user (e.g. `/context_compression` command).
    Manual,
}

/// Metadata stored in the context_compression boundary marker message.
///
/// After an autocompact or manual context_compression, a system-role message is
/// inserted whose content carries this metadata serialized as JSON.
/// It records *what happened* so that downstream code (and the model
/// itself) can reason about the compaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompressionMetadata {
    /// How this compaction was triggered.
    pub trigger: CompressionTrigger,
    /// Input token count reported by the API *before* compaction.
    pub pre_compact_tokens: u64,
    /// Number of conversation messages that were summarized.
    pub messages_summarized: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trigger_auto_serializes_to_snake_case() {
        let json = serde_json::to_string(&CompressionTrigger::Auto).unwrap();
        assert_eq!(json, "\"auto\"");
    }

    #[test]
    fn trigger_manual_serializes_to_snake_case() {
        let json = serde_json::to_string(&CompressionTrigger::Manual).unwrap();
        assert_eq!(json, "\"manual\"");
    }

    #[test]
    fn trigger_roundtrip() {
        for trigger in [CompressionTrigger::Auto, CompressionTrigger::Manual] {
            let json = serde_json::to_value(trigger).unwrap();
            let back: CompressionTrigger = serde_json::from_value(json).unwrap();
            assert_eq!(back, trigger);
        }
    }

    #[test]
    fn metadata_serialization_roundtrip() {
        let meta = CompressionMetadata {
            trigger: CompressionTrigger::Auto,
            pre_compact_tokens: 150_000,
            messages_summarized: 42,
        };
        let json = serde_json::to_value(&meta).unwrap();
        let back: CompressionMetadata = serde_json::from_value(json).unwrap();
        assert_eq!(back, meta);
    }

    #[test]
    fn metadata_json_field_names() {
        let meta = CompressionMetadata {
            trigger: CompressionTrigger::Manual,
            pre_compact_tokens: 200_000,
            messages_summarized: 10,
        };
        let json = serde_json::to_value(&meta).unwrap();
        assert_eq!(json["trigger"], "manual");
        assert_eq!(json["pre_compact_tokens"], 200_000);
        assert_eq!(json["messages_summarized"], 10);
    }
}
