/// Effort level for a skill invocation or reasoning model.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
    Max,
}

/// Signals a transition into or out of Plan Mode.
///
/// Returned via `ContextModifier::plan_mode_transition` from
/// the EnterPlanMode / ExitPlanMode tools.  The engine reads this
/// to toggle the plan-mode state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlanModeTransition {
    /// Enter plan mode — restrict to read-only tools.
    Enter,
    /// Exit plan mode — optionally carrying the plan text.
    Exit { plan_content: Option<String> },
}

/// Convert EffortLevel to the string value expected by LlmRequest.reasoning_effort.
pub fn effort_to_string(level: EffortLevel) -> String {
    match level {
        EffortLevel::Low => "low".to_string(),
        EffortLevel::Medium => "medium".to_string(),
        EffortLevel::High => "high".to_string(),
        EffortLevel::Max => "max".to_string(),
    }
}

/// Overrides that a skill execution can apply to subsequent turns.
#[derive(Debug, Clone, Default)]
pub struct ContextModifier {
    /// Override model ID for subsequent LLM requests.
    /// None = no override.
    pub model: Option<String>,

    /// Override reasoning effort for subsequent LLM requests.
    pub effort: Option<EffortLevel>,

    /// Additional tools to auto-approve (added to allow_list).
    pub allowed_tools: Vec<String>,

    /// Signal a plan-mode state transition (enter or exit).
    /// None = no transition.
    pub plan_mode_transition: Option<PlanModeTransition>,

    /// Additional tools to promote (loading their deferred schemas).
    pub promoted_tools: Vec<String>,
}

impl ContextModifier {
    /// Returns true if this modifier carries no actual overrides.
    pub fn is_empty(&self) -> bool {
        self.model.is_none()
            && self.effort.is_none()
            && self.allowed_tools.is_empty()
            && self.plan_mode_transition.is_none()
            && self.promoted_tools.is_empty()
    }
}
