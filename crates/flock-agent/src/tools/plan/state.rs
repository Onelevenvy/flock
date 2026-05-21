/// Runtime state for Plan Mode.
///
/// Tracks whether the agent is currently in plan mode and the tool allow-list
/// that was active before plan mode was entered (for restoration on exit).
#[derive(Debug, Clone, Default)]
pub struct PlanState {
    /// Whether plan mode is currently active.
    pub is_active: bool,

    /// The tool allow-list that was in effect before entering plan mode.
    /// Restored when the agent exits plan mode.
    pub pre_plan_allow_list: Vec<String>,
}
