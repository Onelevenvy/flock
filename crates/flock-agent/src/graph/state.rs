//! Graph state for the flock agent.
//!
//! `AgentState` mirrors all runtime fields that currently live inside
//! `AgentEngine` but are conceptually *state* (not *infrastructure*).
//!
//! Using `#[langgraph_state]` automates:
//! 1. All necessary derives (Serialize, Deserialize, Default, StateGraph)
//! 2. Automatic injection of `#[serde(default)]` on ALL fields.
//!
//! This ensures maximum robustness with minimum boilerplate.

use langgraph_derive::langgraph_state;
// Required for the compiler to recognize the #[channel] attribute
pub use langgraph_derive::StateGraph; 
use serde_json::Value as JsonValue;

use flock_core::types::message::TokenUsage;

// ---------------------------------------------------------------------------
// AgentState
// ---------------------------------------------------------------------------

/// Runtime state of a single flock agent run.
///
/// All fields map 1-to-1 to existing fields in `AgentEngine`.
#[langgraph_state]
#[derive(Debug)]
pub struct AgentState {
    // ── Conversation history ─────────────────────────────────────────────
    #[channel(messages)]
    pub messages: Vec<JsonValue>,

    // ── Model config ─────────────────────────────────────────────────────
    #[channel]
    pub model: String,

    #[channel]
    pub reasoning_effort: Option<String>,

    // ── Token accounting ─────────────────────────────────────────────────
    #[channel]
    pub total_input_tokens: u64,

    #[channel]
    pub total_output_tokens: u64,

    #[channel]
    pub total_cache_creation_tokens: u64,

    #[channel]
    pub total_cache_read_tokens: u64,

    #[channel]
    pub last_input_tokens: u64,

    // ── Turn counter ─────────────────────────────────────────────────────
    #[channel]
    pub turns: i64,

    // ── Permissions ──────────────────────────────────────────────────────
    #[channel]
    pub allow_list: Vec<String>,

    // ── Plan mode ────────────────────────────────────────────────────────
    #[channel]
    pub plan_mode_active: bool,

    #[channel]
    pub pre_plan_allow_list: Vec<String>,

    // ── Compaction circuit-breaker ────────────────────────────────────────
    #[channel]
    pub compact_consecutive_failures: u32,

    // ── Control flow ─────────────────────────────────────────────────────
    #[channel]
    pub quit_requested: bool,
}

impl AgentState {
    /// Build an `AgentState` from an `AgentEngine`'s current runtime values.
    pub fn from_engine_snapshot(
        model: String,
        reasoning_effort: Option<String>,
        usage: &TokenUsage,
        last_input_tokens: u64,
        turns: usize,
        allow_list: Vec<String>,
        plan_mode_active: bool,
        pre_plan_allow_list: Vec<String>,
        messages: Vec<JsonValue>,
    ) -> Self {
        Self {
            messages,
            model,
            reasoning_effort,
            total_input_tokens: usage.input_tokens,
            total_output_tokens: usage.output_tokens,
            total_cache_creation_tokens: usage.cache_creation_tokens,
            total_cache_read_tokens: usage.cache_read_tokens,
            last_input_tokens,
            turns: turns as i64,
            allow_list,
            plan_mode_active,
            pre_plan_allow_list,
            compact_consecutive_failures: 0,
            quit_requested: false,
        }
    }

    /// Reconstruct a `TokenUsage` from the accumulated counters.
    pub fn to_token_usage(&self) -> TokenUsage {
        TokenUsage {
            input_tokens: self.total_input_tokens,
            output_tokens: self.total_output_tokens,
            cache_creation_tokens: self.total_cache_creation_tokens,
            cache_read_tokens: self.total_cache_read_tokens,
        }
    }
}
