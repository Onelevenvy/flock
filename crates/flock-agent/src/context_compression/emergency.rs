//! Emergency truncation: the last safety net before a context overflow.
//!
//! When `last_input_tokens` is within `emergency_buffer` of the full
//! `context_window`, the engine should block the next API call and ask
//! the user to mod or start a new conversation.
//!
//! Unlike autocompact, the emergency check always applies — even when
//! the compaction system is disabled via `CompactConfig.enabled`.

use flock_core::config::compression::CompressionConfig;

/// User-facing message shown when the emergency limit is hit.
pub const EMERGENCY_USER_MESSAGE: &str =
    "Context window nearly full. Please use /mod or start a new conversation.";

/// Check whether the last observed input token count has reached the
/// emergency blocking limit.
///
/// The limit is `context_window - emergency_buffer`.  When
/// `last_input_tokens >= limit`, the engine must not send another API
/// request — doing so would almost certainly fail with a prompt-too-long
/// error from the provider.
///
/// This check is independent of `CompactConfig.enabled`; the emergency
/// safety net is always active.
pub fn is_at_emergency_limit(last_input_tokens: u64, config: &CompressionConfig) -> bool {
    let limit = config
        .context_window
        .saturating_sub(config.emergency_buffer);
    last_input_tokens as usize >= limit
}

