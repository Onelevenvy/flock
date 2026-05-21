use serde::{Deserialize, Serialize};

/// How a compaction was triggered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompressionTrigger {
    /// Triggered automatically when token usage exceeded the watermark.
    Auto,
    /// Triggered manually by the user (e.g. `/mod` command).
    Manual,
}

/// Metadata stored in the mod boundary marker message.
///
/// After an autocompact or manual mod, a system-role message is
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

