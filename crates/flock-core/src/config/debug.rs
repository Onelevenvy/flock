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
