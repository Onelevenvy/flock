use serde::{Deserialize, Serialize};

/// Configuration for debug / diagnostic output.
///
/// All fields are optional — when absent, the corresponding feature is off.
/// New debug knobs should be added here rather than relying on env vars.
///
/// ```toml
/// [debug]
/// dump_request_path = "/tmp/flock_request.json"
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DebugConfig {
    /// When set, every outgoing LLM request body is written (pretty-printed
    /// JSON) to this path.  Each request overwrites the previous one.
    #[serde(default)]
    pub dump_request_path: Option<String>,
    /// When set, raw SSE chunks from the LLM response are appended to this
    /// file.  The file is truncated at the start of each request so it only
    /// contains the most recent exchange.
    #[serde(default)]
    pub dump_response_path: Option<String>,
}

impl DebugConfig {
    /// Merge project-level overrides onto global defaults.
    /// Each `Some` field in `project` wins; `None` falls back to `global`.
    pub fn merge(global: Self, project: Self) -> Self {
        Self {
            dump_request_path: project.dump_request_path.or(global.dump_request_path),
            dump_response_path: project.dump_response_path.or(global.dump_response_path),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_all_off() {
        let cfg = DebugConfig::default();
        assert!(cfg.dump_request_path.is_none());
    }

    #[test]
    fn toml_with_dump_path() {
        let toml_str = r#"
dump_request_path = "/tmp/flock_request.json"
"#;
        let cfg: DebugConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(
            cfg.dump_request_path.as_deref(),
            Some("/tmp/flock_request.json")
        );
    }

    #[test]
    fn toml_empty_uses_defaults() {
        let cfg: DebugConfig = toml::from_str("").unwrap();
        assert!(cfg.dump_request_path.is_none());
    }

    #[test]
    fn merge_project_overrides_global() {
        let global = DebugConfig {
            dump_request_path: Some("/tmp/global.json".into()),
            ..Default::default()
        };
        let project = DebugConfig {
            dump_request_path: Some("/tmp/project.json".into()),
            ..Default::default()
        };
        let merged = DebugConfig::merge(global, project);
        assert_eq!(
            merged.dump_request_path.as_deref(),
            Some("/tmp/project.json")
        );
    }

    #[test]
    fn merge_falls_back_to_global() {
        let global = DebugConfig {
            dump_request_path: Some("/tmp/global.json".into()),
            ..Default::default()
        };
        let project = DebugConfig::default();
        let merged = DebugConfig::merge(global, project);
        assert_eq!(
            merged.dump_request_path.as_deref(),
            Some("/tmp/global.json")
        );
    }

    #[test]
    fn merge_response_dump_path() {
        let global = DebugConfig {
            dump_response_path: Some("/tmp/global_resp.jsonl".into()),
            ..Default::default()
        };
        let project = DebugConfig {
            dump_response_path: Some("/tmp/project_resp.jsonl".into()),
            ..Default::default()
        };
        let merged = DebugConfig::merge(global, project);
        assert_eq!(
            merged.dump_response_path.as_deref(),
            Some("/tmp/project_resp.jsonl")
        );
    }

    #[test]
    fn toml_with_response_dump_path() {
        let toml_str = r#"
dump_response_path = "/tmp/flock_response.jsonl"
"#;
        let cfg: DebugConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(
            cfg.dump_response_path.as_deref(),
            Some("/tmp/flock_response.jsonl")
        );
    }
}
