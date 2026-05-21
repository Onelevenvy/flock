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
