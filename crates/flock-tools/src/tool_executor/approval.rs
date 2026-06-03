use flock_core::types::message::ContentBlock;
use flock_core::config::hooks::HookEngine;
use crate::registry::ToolRegistry;

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
