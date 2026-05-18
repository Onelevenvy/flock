use serde::{Deserialize, Serialize};

/// Configuration for the file state cache.
///
/// Controls the LRU cache that tracks files the model has seen,
/// enabling dedup detection and staleness checks.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FileCacheConfig {
    /// Maximum number of cached file entries.
    #[serde(default = "default_max_entries")]
    pub max_entries: usize,

    /// Maximum total cache size in bytes.
    #[serde(default = "default_max_size_bytes")]
    pub max_size_bytes: usize,

    /// Enable file state caching.
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

impl Default for FileCacheConfig {
    fn default() -> Self {
        Self {
            max_entries: default_max_entries(),
            max_size_bytes: default_max_size_bytes(),
            enabled: default_enabled(),
        }
    }
}

fn default_max_entries() -> usize {
    100
}

fn default_max_size_bytes() -> usize {
    25 * 1024 * 1024 // 25 MB
}

fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_correct() {
        let config = FileCacheConfig::default();
        assert_eq!(config.max_entries, 100);
        assert_eq!(config.max_size_bytes, 25 * 1024 * 1024);
        assert!(config.enabled);
    }

    #[test]
    fn deserialize_from_toml_full() {
        let toml_str = r#"
max_entries = 50
max_size_bytes = 10485760
enabled = false
"#;
        let config: FileCacheConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.max_entries, 50);
        assert_eq!(config.max_size_bytes, 10_485_760);
        assert!(!config.enabled);
    }

    #[test]
    fn deserialize_from_toml_partial_uses_defaults() {
        let toml_str = r#"
max_entries = 200
"#;
        let config: FileCacheConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.max_entries, 200);
        assert_eq!(config.max_size_bytes, 25 * 1024 * 1024);
        assert!(config.enabled);
    }

    #[test]
    fn deserialize_from_empty_toml() {
        let config: FileCacheConfig = toml::from_str("").unwrap();
        assert_eq!(config.max_entries, 100);
        assert_eq!(config.max_size_bytes, 25 * 1024 * 1024);
        assert!(config.enabled);
    }
}
