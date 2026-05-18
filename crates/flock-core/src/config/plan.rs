use serde::{Deserialize, Serialize};

/// Configuration for Plan Mode.
///
/// Plan Mode restricts the agent to read-only tools while it builds
/// an implementation plan.  After the user approves the plan the agent
/// exits plan mode and regains full tool access.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanConfig {
    /// Whether Plan Mode tools (EnterPlanMode / ExitPlanMode) are registered.
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Directory for plan files, relative to the project root.
    #[serde(default = "default_plan_directory")]
    pub plan_directory: String,
}

impl Default for PlanConfig {
    fn default() -> Self {
        Self {
            enabled: default_true(),
            plan_directory: default_plan_directory(),
        }
    }
}

// --- Default value functions ---

fn default_true() -> bool {
    true
}

fn default_plan_directory() -> String {
    ".flock/plans".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_values_match_spec() {
        let cfg = PlanConfig::default();
        assert!(cfg.enabled);
        assert_eq!(cfg.plan_directory, ".flock/plans");
    }

    #[test]
    fn toml_full_override() {
        let toml_str = r#"
enabled = false
plan_directory = "/custom/plans"
"#;
        let cfg: PlanConfig = toml::from_str(toml_str).unwrap();
        assert!(!cfg.enabled);
        assert_eq!(cfg.plan_directory, "/custom/plans");
    }

    #[test]
    fn toml_partial_override_uses_defaults() {
        let toml_str = r#"
enabled = false
"#;
        let cfg: PlanConfig = toml::from_str(toml_str).unwrap();
        assert!(!cfg.enabled);
        assert_eq!(cfg.plan_directory, ".flock/plans");
    }

    #[test]
    fn toml_empty_uses_all_defaults() {
        let cfg: PlanConfig = toml::from_str("").unwrap();
        assert!(cfg.enabled);
        assert_eq!(cfg.plan_directory, ".flock/plans");
    }

    #[test]
    fn json_serialization_roundtrip() {
        let cfg = PlanConfig {
            enabled: false,
            plan_directory: "/tmp/plans".to_string(),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let back: PlanConfig = serde_json::from_str(&json).unwrap();
        assert!(!back.enabled);
        assert_eq!(back.plan_directory, "/tmp/plans");
    }
}
