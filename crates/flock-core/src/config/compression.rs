use serde::{Deserialize, Serialize};

/// Configuration for the multi-level context compaction system.
///
/// All token-related fields are in tokens (not bytes or characters).
/// The defaults are tuned for Claude models with a 200k context window.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionConfig {
    /// Context window size in tokens (e.g. 200_000 for Claude).
    #[serde(default = "default_context_window")]
    pub context_window: usize,

    /// Tokens reserved for output generation.
    /// Subtracted from `context_window` to get the effective input budget.
    #[serde(default = "default_output_reserve")]
    pub output_reserve: usize,

    /// Buffer below the effective window that triggers autocompact.
    /// `threshold = context_window - output_reserve - autocompact_buffer`
    #[serde(default = "default_autocompact_buffer")]
    pub autocompact_buffer: usize,

    /// Tokens from context_window limit to trigger emergency block.
    /// `emergency_limit = context_window - emergency_buffer`
    #[serde(default = "default_emergency_buffer")]
    pub emergency_buffer: usize,

    /// Max consecutive autocompact failures before the circuit breaker trips.
    #[serde(default = "default_max_failures")]
    pub max_failures: u32,

    /// Microcompact: keep the N most recent compactable tool results.
    #[serde(default = "default_micro_keep_recent")]
    pub micro_keep_recent: usize,

    /// Microcompact: gap threshold in seconds for time-based trigger.
    /// When the last assistant message is older than this, microcompact fires.
    #[serde(default = "default_micro_gap_seconds")]
    pub micro_gap_seconds: u64,

    /// Tool names whose results are eligible for microcompact content clearing.
    #[serde(default = "default_compactable_tools")]
    pub compactable_tools: Vec<String>,

    /// Whether the compaction system is enabled.
    /// When false, microcompact and autocompact are skipped
    /// (emergency truncation still applies).
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Enable prompt cache diagnostics output to user.
    /// When true, cache hit/miss info is shown via OutputSink.
    /// Default: false.
    #[serde(default)]
    pub cache_diagnostics: bool,

    #[serde(default)]
    pub compaction: crate::context_compression::CompressionLevel,

    #[serde(default)]
    pub toon: bool,
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            context_window: default_context_window(),
            output_reserve: default_output_reserve(),
            autocompact_buffer: default_autocompact_buffer(),
            emergency_buffer: default_emergency_buffer(),
            max_failures: default_max_failures(),
            micro_keep_recent: default_micro_keep_recent(),
            micro_gap_seconds: default_micro_gap_seconds(),
            compactable_tools: default_compactable_tools(),
            enabled: default_true(),
            cache_diagnostics: false,
            compaction: crate::context_compression::CompressionLevel::default(),
            toon: false,
        }
    }
}

// --- Default value functions ---

fn default_context_window() -> usize {
    200_000
}
fn default_output_reserve() -> usize {
    20_000
}
fn default_autocompact_buffer() -> usize {
    13_000
}
fn default_emergency_buffer() -> usize {
    3_000
}
fn default_max_failures() -> u32 {
    3
}
fn default_micro_keep_recent() -> usize {
    5
}
fn default_micro_gap_seconds() -> u64 {
    3600
}
fn default_compactable_tools() -> Vec<String> {
    vec![
        "Read".into(),
        "Bash".into(),
        "Grep".into(),
        "Glob".into(),
        "Write".into(),
        "Edit".into(),
    ]
}
fn default_true() -> bool {
    true
}
