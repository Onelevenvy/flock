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


