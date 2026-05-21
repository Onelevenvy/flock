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
