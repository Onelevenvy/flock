pub mod file;
pub mod prompt;
pub mod state;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};

use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::skill_types::{ContextModifier, PlanModeTransition};
use flock_core::types::tool::{JsonSchema, ToolResult};
use flock_tools::Tool;

// ---------------------------------------------------------------------------
// EnterPlanModeTool
// ---------------------------------------------------------------------------

/// Transitions the agent into Plan Mode.
///
/// While in plan mode the engine restricts the available tool set to
/// read-only (`Info`-category) tools so the LLM can focus on understanding
/// the codebase and composing an implementation plan.
pub struct EnterPlanModeTool {
    /// Shared flag indicating whether plan mode is currently active.
    /// Read by `execute()` to prevent double-entry.
    plan_active: Arc<AtomicBool>,
}

impl EnterPlanModeTool {
    pub fn new(plan_active: Arc<AtomicBool>) -> Self {
        Self { plan_active }
    }
}

#[async_trait]
impl Tool for EnterPlanModeTool {
    fn name(&self) -> &str {
        "EnterPlanMode"
    }

    fn description(&self) -> &str {
        "Enter plan mode to focus on reading code and creating an implementation plan. \
         While in plan mode, only read-only tools are available. \
         Use ExitPlanMode when your plan is ready."
    }

    fn input_schema(&self) -> JsonSchema {
        json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        true
    }

    fn is_deferred(&self) -> bool {
        true
    }

    async fn execute(&self, _input: Value) -> ToolResult {
        if self.plan_active.load(Ordering::Acquire) {
            return ToolResult {
                content: "Already in plan mode. Use ExitPlanMode to exit first.".to_string(),
                is_error: true,
            };
        }

        ToolResult {
            content: "Entered plan mode. You can now only use read-only tools to explore \
                      the codebase and create your implementation plan. When your plan is \
                      ready, use ExitPlanMode to exit plan mode and begin implementation."
                .to_string(),
            is_error: false,
        }
    }

    fn context_modifier_for(&self, _input: &Value) -> Option<ContextModifier> {
        Some(ContextModifier {
            plan_mode_transition: Some(PlanModeTransition::Enter),
            ..Default::default()
        })
    }

    fn category(&self) -> ToolCategory {
        ToolCategory::Info
    }

    fn describe(&self, _input: &Value) -> String {
        "Enter plan mode".to_string()
    }
}

// ---------------------------------------------------------------------------
// ExitPlanModeTool
// ---------------------------------------------------------------------------

/// Transitions the agent out of Plan Mode.
///
/// On exit the engine restores the full tool set and the allow-list
/// that was in effect before plan mode was entered.
pub struct ExitPlanModeTool {
    /// Shared flag indicating whether plan mode is currently active.
    /// Read by `execute()` to reject exit when not in plan mode.
    plan_active: Arc<AtomicBool>,
}

impl ExitPlanModeTool {
    pub fn new(plan_active: Arc<AtomicBool>) -> Self {
        Self { plan_active }
    }
}

#[async_trait]
impl Tool for ExitPlanModeTool {
    fn name(&self) -> &str {
        "ExitPlanMode"
    }

    fn description(&self) -> &str {
        "Exit plan mode after completing your implementation plan. \
         This restores full tool access so you can begin implementing the plan."
    }

    fn input_schema(&self) -> JsonSchema {
        json!({
            "type": "object",
            "properties": {
                "plan": {
                    "type": "string",
                    "description": "The final implementation plan to save to disk."
                }
            },
            "required": []
        })
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        true
    }

    fn is_deferred(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value) -> ToolResult {
        if !self.plan_active.load(Ordering::Acquire) {
            return ToolResult {
                content: "Not in plan mode. Use EnterPlanMode to enter plan mode first."
                    .to_string(),
                is_error: true,
            };
        }

        let plan_provided = input.get("plan").and_then(|v| v.as_str()).is_some();
        let content = if plan_provided {
            "Exited plan mode. Your plan has been saved. Full tool access has been restored."
        } else {
            "Exited plan mode. Full tool access has been restored. You can now proceed with implementing the plan."
        };

        ToolResult {
            content: content.to_string(),
            is_error: false,
        }
    }

    fn context_modifier_for(&self, input: &Value) -> Option<ContextModifier> {
        let plan_content = input.get("plan").and_then(|v| v.as_str()).map(|s| s.to_string());
        Some(ContextModifier {
            plan_mode_transition: Some(PlanModeTransition::Exit { plan_content }),
            ..Default::default()
        })
    }

    fn category(&self) -> ToolCategory {
        ToolCategory::Info
    }

    fn describe(&self, _input: &Value) -> String {
        "Exit plan mode".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_shared_flag(active: bool) -> Arc<AtomicBool> {
        Arc::new(AtomicBool::new(active))
    }

    // --- EnterPlanModeTool unit tests ---

    #[test]
    fn enter_tool_name() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        assert_eq!(tool.name(), "EnterPlanMode");
    }

    #[test]
    fn enter_tool_category_is_info() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        assert!(matches!(tool.category(), ToolCategory::Info));
    }

    #[test]
    fn enter_tool_concurrency_safe() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        assert!(tool.is_concurrency_safe(&json!({})));
    }

    #[test]
    fn enter_tool_schema_has_no_required_fields() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        let schema = tool.input_schema();
        let required = schema["required"].as_array().unwrap();
        assert!(required.is_empty());
    }

    #[test]
    fn enter_tool_context_modifier_returns_enter() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        let modifier = tool.context_modifier_for(&json!({}));
        assert!(modifier.is_some());
        let cm = modifier.unwrap();
        assert_eq!(cm.plan_mode_transition, Some(PlanModeTransition::Enter));
        // Other fields are default
        assert!(cm.model.is_none());
        assert!(cm.effort.is_none());
        assert!(cm.allowed_tools.is_empty());
    }

    #[tokio::test]
    async fn enter_succeeds_when_not_active() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        let result = tool.execute(json!({})).await;
        assert!(!result.is_error);
        assert!(result.content.contains("Entered plan mode"));
    }

    #[tokio::test]
    async fn enter_rejects_when_already_active() {
        let tool = EnterPlanModeTool::new(make_shared_flag(true));
        let result = tool.execute(json!({})).await;
        assert!(result.is_error);
        assert!(result.content.contains("Already in plan mode"));
    }

    #[test]
    fn enter_tool_describe() {
        let tool = EnterPlanModeTool::new(make_shared_flag(false));
        assert_eq!(tool.describe(&json!({})), "Enter plan mode");
    }

    // --- ExitPlanModeTool unit tests ---

    #[test]
    fn exit_tool_name() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        assert_eq!(tool.name(), "ExitPlanMode");
    }

    #[test]
    fn exit_tool_category_is_info() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        assert!(matches!(tool.category(), ToolCategory::Info));
    }

    #[test]
    fn exit_tool_concurrency_safe() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        assert!(tool.is_concurrency_safe(&json!({})));
    }

    #[test]
    fn exit_tool_schema_has_no_required_fields() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        let schema = tool.input_schema();
        let required = schema["required"].as_array().unwrap();
        assert!(required.is_empty());
    }

    #[test]
    fn exit_tool_context_modifier_returns_exit() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        let modifier = tool.context_modifier_for(&json!({}));
        assert!(modifier.is_some());
        let cm = modifier.unwrap();
        assert!(matches!(
            cm.plan_mode_transition,
            Some(PlanModeTransition::Exit { plan_content: None })
        ));
        // Other fields are default
        assert!(cm.model.is_none());
        assert!(cm.effort.is_none());
        assert!(cm.allowed_tools.is_empty());
    }

    #[tokio::test]
    async fn exit_succeeds_when_active() {
        let tool = ExitPlanModeTool::new(make_shared_flag(true));
        let result = tool.execute(json!({})).await;
        assert!(!result.is_error);
        assert!(result.content.contains("Exited plan mode"));
    }

    #[tokio::test]
    async fn exit_rejects_when_not_active() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        let result = tool.execute(json!({})).await;
        assert!(result.is_error);
        assert!(result.content.contains("Not in plan mode"));
    }

    #[test]
    fn exit_tool_describe() {
        let tool = ExitPlanModeTool::new(make_shared_flag(false));
        assert_eq!(tool.describe(&json!({})), "Exit plan mode");
    }

    // --- Shared flag tests ---

    #[tokio::test]
    async fn shared_flag_reflects_state_changes() {
        let flag = make_shared_flag(false);
        let enter_tool = EnterPlanModeTool::new(Arc::clone(&flag));
        let exit_tool = ExitPlanModeTool::new(Arc::clone(&flag));

        // Initially not active — enter succeeds, exit fails
        let r = enter_tool.execute(json!({})).await;
        assert!(!r.is_error);
        let r = exit_tool.execute(json!({})).await;
        assert!(r.is_error);

        // Simulate engine setting the flag after processing Enter transition
        flag.store(true, Ordering::Release);

        // Now active — enter fails, exit succeeds
        let r = enter_tool.execute(json!({})).await;
        assert!(r.is_error);
        let r = exit_tool.execute(json!({})).await;
        assert!(!r.is_error);
    }
}
