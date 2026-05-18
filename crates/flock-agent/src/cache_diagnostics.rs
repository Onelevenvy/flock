//! Prompt cache break detection.
//!
//! Pairs request-side prompt state (hashes) with response-side cache tokens
//! to detect and diagnose prompt cache breaks across turns.

use std::hash::{DefaultHasher, Hash, Hasher};

use flock_core::types::tool::ToolDef;

/// Snapshot of prompt state taken before each API call.
#[derive(Debug, Clone)]
struct PromptSnapshot {
    system_hash: u64,
    tools_hash: u64,
}

/// Cache token statistics from a single API response.
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub input_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
}

/// Diagnostic result after comparing two consecutive turns.
#[derive(Debug, Clone)]
pub enum CacheDiagnostic {
    Healthy {
        hit_rate: f64,
    },
    PartialMiss {
        hit_rate: f64,
        cause: CacheBreakCause,
    },
    FullMiss {
        cause: CacheBreakCause,
    },
}

/// What caused a cache break.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CacheBreakCause {
    SystemPromptChanged,
    ToolsChanged,
    TtlExpiry,
    FirstRequest,
}

/// Detects prompt cache breaks by comparing consecutive turns.
pub struct CacheBreakDetector {
    /// Snapshot from the PREVIOUS turn (used for attribution on cache break).
    prev_snapshot: Option<PromptSnapshot>,
    /// Snapshot from the CURRENT turn (just recorded by record_request).
    current_snapshot: Option<PromptSnapshot>,
    /// Cache stats from the previous API response.
    prev_stats: Option<CacheStats>,
}

impl CacheBreakDetector {
    pub fn new() -> Self {
        Self {
            prev_snapshot: None,
            current_snapshot: None,
            prev_stats: None,
        }
    }

    /// Record the prompt state before an API call.
    pub fn record_request(&mut self, system: &str, tools: &[ToolDef]) {
        let mut system_hasher = DefaultHasher::new();
        system.hash(&mut system_hasher);
        let system_hash = system_hasher.finish();

        let mut tools_hasher = DefaultHasher::new();
        for t in tools {
            t.name.hash(&mut tools_hasher);
            t.description.hash(&mut tools_hasher);
            let schema_str = serde_json::to_string(&t.input_schema).unwrap_or_default();
            schema_str.hash(&mut tools_hasher);
            t.deferred.hash(&mut tools_hasher);
        }
        let tools_hash = tools_hasher.finish();

        // Rotate: current becomes prev, new snapshot becomes current
        self.prev_snapshot = self.current_snapshot.take();
        self.current_snapshot = Some(PromptSnapshot {
            system_hash,
            tools_hash,
        });
    }

    /// Check the response cache tokens against the previous turn.
    ///
    /// Returns `None` if no snapshot was recorded before the call.
    pub fn check_response(&mut self, stats: CacheStats) -> Option<CacheDiagnostic> {
        let current = self.current_snapshot.as_ref()?;
        let diagnostic = self.compute_diagnostic(current, &stats);
        self.prev_stats = Some(stats);
        Some(diagnostic)
    }

    fn compute_diagnostic(&self, current: &PromptSnapshot, stats: &CacheStats) -> CacheDiagnostic {
        let Some(prev) = &self.prev_stats else {
            // First request — no previous data to compare
            return CacheDiagnostic::Healthy { hit_rate: 0.0 };
        };

        // If provider doesn't support caching (both turns have 0 cache tokens),
        // report healthy to avoid false alarms (e.g., OpenAI).
        if prev.cache_read_tokens == 0
            && prev.cache_creation_tokens == 0
            && stats.cache_read_tokens == 0
            && stats.cache_creation_tokens == 0
        {
            return CacheDiagnostic::Healthy { hit_rate: 0.0 };
        }

        let prev_had_cache = prev.cache_read_tokens > 0 || prev.cache_creation_tokens > 0;

        // Full miss: had cache before, now read tokens dropped to 0
        if prev_had_cache && stats.cache_read_tokens == 0 {
            let cause = self.attribute_cause(current);
            return CacheDiagnostic::FullMiss { cause };
        }

        // Calculate hit rate
        let hit_rate = if stats.input_tokens > 0 {
            stats.cache_read_tokens as f64 / stats.input_tokens as f64
        } else {
            0.0
        };

        // Partial miss: cache_read dropped >5% compared to previous
        if prev.cache_read_tokens > 0 {
            let drop_pct = 1.0 - (stats.cache_read_tokens as f64 / prev.cache_read_tokens as f64);
            if drop_pct > 0.05 {
                let cause = self.attribute_cause(current);
                return CacheDiagnostic::PartialMiss { hit_rate, cause };
            }
        }

        CacheDiagnostic::Healthy { hit_rate }
    }

    /// Determine what caused the cache break by comparing prev vs current snapshots.
    fn attribute_cause(&self, current: &PromptSnapshot) -> CacheBreakCause {
        let Some(prev) = &self.prev_snapshot else {
            return CacheBreakCause::FirstRequest;
        };

        if prev.system_hash != current.system_hash {
            return CacheBreakCause::SystemPromptChanged;
        }
        if prev.tools_hash != current.tools_hash {
            return CacheBreakCause::ToolsChanged;
        }

        // Hashes match but cache was lost — server-side TTL expiry
        CacheBreakCause::TtlExpiry
    }
}

impl Default for CacheBreakDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_tools() -> Vec<ToolDef> {
        vec![ToolDef {
            name: "Read".into(),
            description: "Read a file".into(),
            input_schema: json!({"type": "object"}),
            deferred: false,
            category: "Info".into(),
            provider_id: "builtin".into(),
            provider_name: "Built-in Tools".into(),
            needs_auth: false,
        }]
    }

    #[test]
    fn first_request_returns_healthy() {
        let mut detector = CacheBreakDetector::new();
        detector.record_request("system prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 5000,
            })
            .unwrap();
        assert!(matches!(diag, CacheDiagnostic::Healthy { .. }));
    }

    #[test]
    fn healthy_when_cache_read_stable() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1
        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — similar cache_read
        detector.record_request("prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 11000,
                cache_read_tokens: 8000,
                cache_creation_tokens: 0,
            })
            .unwrap();

        assert!(matches!(diag, CacheDiagnostic::Healthy { .. }));
    }

    #[test]
    fn full_miss_when_cache_read_drops_to_zero() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1 — cache established
        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — cache_read drops to 0
        detector.record_request("prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 10000,
            })
            .unwrap();

        assert!(matches!(diag, CacheDiagnostic::FullMiss { .. }));
    }

    #[test]
    fn full_miss_system_prompt_changed() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1
        detector.record_request("prompt v1", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — different system prompt
        detector.record_request("prompt v2", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 10000,
            })
            .unwrap();

        match diag {
            CacheDiagnostic::FullMiss { cause } => {
                assert_eq!(cause, CacheBreakCause::SystemPromptChanged);
            }
            _ => panic!("expected FullMiss"),
        }
    }

    #[test]
    fn full_miss_tools_changed() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1
        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — different tools
        let new_tools = vec![ToolDef {
            name: "Write".into(),
            description: "Write a file".into(),
            input_schema: json!({"type": "object"}),
            deferred: false,
            category: "Info".into(),
            provider_id: "builtin".into(),
            provider_name: "Built-in Tools".into(),
            needs_auth: false,
        }];
        detector.record_request("prompt", &new_tools);
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 10000,
            })
            .unwrap();

        match diag {
            CacheDiagnostic::FullMiss { cause } => {
                assert_eq!(cause, CacheBreakCause::ToolsChanged);
            }
            _ => panic!("expected FullMiss"),
        }
    }

    #[test]
    fn full_miss_ttl_expiry() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1
        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — same prompt and tools but cache lost (TTL expired server-side)
        detector.record_request("prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 10000,
            })
            .unwrap();

        match diag {
            CacheDiagnostic::FullMiss { cause } => {
                assert_eq!(cause, CacheBreakCause::TtlExpiry);
            }
            _ => panic!("expected FullMiss"),
        }
    }

    #[test]
    fn partial_miss_when_cache_read_drops_significantly() {
        let mut detector = CacheBreakDetector::new();

        // Turn 1
        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 8000,
            cache_creation_tokens: 2000,
        });

        // Turn 2 — 50% drop in cache_read
        detector.record_request("prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 4000,
                cache_creation_tokens: 6000,
            })
            .unwrap();

        assert!(matches!(diag, CacheDiagnostic::PartialMiss { .. }));
    }

    #[test]
    fn openai_no_false_alarm() {
        // OpenAI never returns cache tokens — both turns have all zeros
        let mut detector = CacheBreakDetector::new();

        detector.record_request("prompt", &make_tools());
        detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
        });

        detector.record_request("prompt", &make_tools());
        let diag = detector
            .check_response(CacheStats {
                input_tokens: 10000,
                cache_read_tokens: 0,
                cache_creation_tokens: 0,
            })
            .unwrap();

        // Should be Healthy, not FullMiss
        assert!(matches!(diag, CacheDiagnostic::Healthy { .. }));
    }

    #[test]
    fn no_diagnostic_without_record_request() {
        let mut detector = CacheBreakDetector::new();
        let diag = detector.check_response(CacheStats {
            input_tokens: 10000,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
        });
        assert!(diag.is_none());
    }
}
