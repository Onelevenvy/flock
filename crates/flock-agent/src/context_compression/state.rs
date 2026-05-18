use flock_core::config::compression::CompressionConfig;

/// Runtime state for the compaction circuit breaker.
///
/// Tracks consecutive autocompact failures so we can stop retrying
/// after `config.max_failures` consecutive failures.
#[derive(Debug, Clone)]
pub struct CompactState {
    /// Number of consecutive autocompact failures.
    pub consecutive_failures: u32,
    /// Input token count from the last API call (used as the watermark).
    pub last_input_tokens: u64,
}

impl CompactState {
    pub fn new() -> Self {
        Self {
            consecutive_failures: 0,
            last_input_tokens: 0,
        }
    }

    /// Check whether the circuit breaker has tripped.
    pub fn is_circuit_broken(&self, config: &CompressionConfig) -> bool {
        self.consecutive_failures >= config.max_failures
    }

    /// Record a successful autocompact — resets the failure counter.
    pub fn record_success(&mut self) {
        self.consecutive_failures = 0;
    }

    /// Record a failed autocompact — increments the failure counter.
    pub fn record_failure(&mut self) {
        self.consecutive_failures += 1;
    }
}

impl Default for CompactState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> CompressionConfig {
        CompressionConfig {
            max_failures: 3,
            ..Default::default()
        }
    }

    #[test]
    fn new_state_not_circuit_broken() {
        let state = CompactState::new();
        assert_eq!(state.consecutive_failures, 0);
        assert_eq!(state.last_input_tokens, 0);
        assert!(!state.is_circuit_broken(&test_config()));
    }

    #[test]
    fn circuit_breaker_trips_at_max_failures() {
        let config = test_config();
        let mut state = CompactState::new();

        state.record_failure();
        assert!(!state.is_circuit_broken(&config));
        state.record_failure();
        assert!(!state.is_circuit_broken(&config));
        state.record_failure();
        assert!(state.is_circuit_broken(&config));
    }

    #[test]
    fn success_resets_failure_counter() {
        let config = test_config();
        let mut state = CompactState::new();

        state.record_failure();
        state.record_failure();
        assert_eq!(state.consecutive_failures, 2);

        state.record_success();
        assert_eq!(state.consecutive_failures, 0);
        assert!(!state.is_circuit_broken(&config));
    }

    #[test]
    fn circuit_breaker_with_max_failures_one() {
        let config = CompressionConfig {
            max_failures: 1,
            ..Default::default()
        };
        let mut state = CompactState::new();

        assert!(!state.is_circuit_broken(&config));
        state.record_failure();
        assert!(state.is_circuit_broken(&config));
    }

    #[test]
    fn default_impl_matches_new() {
        let a = CompactState::new();
        let b = CompactState::default();
        assert_eq!(a.consecutive_failures, b.consecutive_failures);
        assert_eq!(a.last_input_tokens, b.last_input_tokens);
    }
}
