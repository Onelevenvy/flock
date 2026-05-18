//! Emergency truncation: the last safety net before a context overflow.
//!
//! When `last_input_tokens` is within `emergency_buffer` of the full
//! `context_window`, the engine should block the next API call and ask
//! the user to context_compression or start a new conversation.
//!
//! Unlike autocompact, the emergency check always applies — even when
//! the compaction system is disabled via `CompactConfig.enabled`.

use flock_core::config::compression::CompressionConfig;

/// User-facing message shown when the emergency limit is hit.
pub const EMERGENCY_USER_MESSAGE: &str =
    "Context window nearly full. Please use /context_compression or start a new conversation.";

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

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> CompressionConfig {
        CompressionConfig::default()
    }

    // ── is_at_emergency_limit ──────────────────────────────────────────

    #[test]
    fn below_limit_returns_false() {
        // limit = 200k - 3k = 197k; 190k < 197k
        let config = default_config();
        assert!(!is_at_emergency_limit(190_000, &config));
    }

    #[test]
    fn above_limit_returns_true() {
        // 198k >= 197k
        let config = default_config();
        assert!(is_at_emergency_limit(198_000, &config));
    }

    #[test]
    fn at_exact_limit_returns_true() {
        // 197k >= 197k
        let config = default_config();
        assert!(is_at_emergency_limit(197_000, &config));
    }

    #[test]
    fn small_context_window() {
        let config = CompressionConfig {
            context_window: 8_000,
            emergency_buffer: 3_000,
            ..default_config()
        };
        // limit = 8k - 3k = 5k; 6k >= 5k
        assert!(is_at_emergency_limit(6_000, &config));
    }

    #[test]
    fn zero_tokens_below_limit() {
        let config = default_config();
        assert!(!is_at_emergency_limit(0, &config));
    }

    #[test]
    fn custom_emergency_buffer() {
        let config = CompressionConfig {
            context_window: 100_000,
            emergency_buffer: 10_000,
            ..default_config()
        };
        // limit = 100k - 10k = 90k
        assert!(!is_at_emergency_limit(89_999, &config));
        assert!(is_at_emergency_limit(90_000, &config));
        assert!(is_at_emergency_limit(95_000, &config));
    }

    #[test]
    fn works_regardless_of_enabled_flag() {
        let config = CompressionConfig {
            enabled: false,
            ..default_config()
        };
        // Emergency check ignores the enabled flag
        assert!(is_at_emergency_limit(198_000, &config));
    }

    #[test]
    fn emergency_buffer_larger_than_context_window_saturates() {
        let config = CompressionConfig {
            context_window: 1_000,
            emergency_buffer: 5_000,
            ..default_config()
        };
        // saturating_sub: limit = 0; any positive token count triggers
        assert!(is_at_emergency_limit(1, &config));
        // 0 tokens = 0 >= 0 → true (degenerate but safe)
        assert!(is_at_emergency_limit(0, &config));
    }

    // ── EMERGENCY_USER_MESSAGE ─────────────────────────────────────────

    #[test]
    fn user_message_mentions_compact() {
        assert!(EMERGENCY_USER_MESSAGE.contains("/context_compression"));
    }

    #[test]
    fn user_message_mentions_new_conversation() {
        assert!(EMERGENCY_USER_MESSAGE.contains("new conversation"));
    }
}
