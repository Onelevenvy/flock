use std::sync::{Arc, Mutex};
use crate::approval::{ApprovalDecision, ToolConfirmer};
use flock_core::types::message::ContentBlock;
use flock_core::config::hooks::HookEngine;
use crate::registry::ToolRegistry;
use super::types::ExecutionControl;
use super::helpers::truncate_display;

/// Confirm a single tool call. Returns Ok(Some(result)) if denied, Ok(None) if approved, Err if quit.
pub fn request_approval(
    confirmer: Option<&Arc<Mutex<dyn ToolConfirmer>>>,
    call: &ContentBlock,
) -> Result<Option<ContentBlock>, ExecutionControl> {
    let ContentBlock::ToolUse { id, name, input } = call else {
        return Ok(None);
    };

    let Some(confirmer) = confirmer else {
        return Ok(None);
    };

    let input_display = serde_json::to_string(input).unwrap_or_default();
    let result = confirmer
        .lock()
        .unwrap()
        .check(name, &truncate_display(&input_display, 200));

    match result {
        ApprovalDecision::Approved => Ok(None),
        ApprovalDecision::Denied => Ok(Some(ContentBlock::ToolResult {
            tool_use_id: id.clone(),
            content: "Tool execution denied by user".to_string(),
            is_error: true,
        })),
        ApprovalDecision::Quit => Err(ExecutionControl::Quit),
    }
}

pub fn update_plugin_hooks(
    registry: &ToolRegistry,
    call: &ContentBlock,
    hooks: Option<&mut HookEngine>,
) {
    if let Some(engine) = hooks {
        merge_skill_hooks_into(engine, registry, call);
    }
}

/// If `call` is a Skill tool call that returned successfully, parse and merge
/// its declared hooks into the active HookEngine.
pub fn merge_skill_hooks_into(engine: &mut HookEngine, registry: &ToolRegistry, call: &ContentBlock) {
    let ContentBlock::ToolUse { name, input, .. } = call else {
        return;
    };
    if name != "Skill" {
        return;
    }
    let Some(tool) = registry.get(name) else {
        return;
    };
    if let Some(skill_hooks) = tool.skill_hooks_for(input) {
        engine.merge_hooks(skill_hooks);
    }
}

/// Returns true when a ContentBlock::ToolResult has is_error=true.
pub fn block_is_error(block: &ContentBlock) -> bool {
    matches!(block, ContentBlock::ToolResult { is_error: true, .. })
}
