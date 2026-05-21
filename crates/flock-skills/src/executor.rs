use crate::context_modifier::effort_to_string;
use crate::shell::{execute_shell_commands, ShellExecutionError};
use crate::substitution::substitute_arguments;
use crate::types::{ExecutionContext, SkillMetadata};
use flock_core::types::spawner::{ForkOverrides, Spawner, SubAgentConfig};

/// Prepare skill content for inline execution.
///
/// Steps:
/// 1. If the skill has a known `skill_root`, prepend a base-directory header.
/// 2. Perform variable substitution (arguments + env vars).
/// 3. Execute any embedded shell commands (skipped for MCP skills).
///
/// The `session_id` is `None` in Phase 3; it will be wired in Phase 6.
pub async fn prepare_inline_content(
    skill: &SkillMetadata,
    args: Option<&str>,
    session_id: Option<&str>,
    cwd: &str,
) -> Result<String, ShellExecutionError> {
    // Prepend base directory header so the model can resolve relative paths
    // (e.g. `./schemas/foo.json`). Matches TS `processPromptSlashCommand`.
    let base = match skill.skill_root.as_deref() {
        Some(root) => {
            let normalized = normalize_path_separators(root);
            format!(
                "Base directory for this skill: {normalized}\n\n{}",
                skill.content
            )
        }
        None => skill.content.clone(),
    };

    let substituted = substitute_arguments(
        &base,
        args,
        &skill.argument_names,
        skill.skill_root.as_deref(),
        session_id,
    );

    execute_shell_commands(&substituted, skill.loaded_from, cwd).await
}

/// Normalize path separators to forward slashes.
/// On non-Windows platforms this is a no-op; included for portability.
fn normalize_path_separators(path: &str) -> String {
    if cfg!(windows) {
        path.replace('\\', "/")
    } else {
        path.to_owned()
    }
}

/// Check whether a skill can be executed in inline mode.
///
/// Returns an error if the skill requires fork execution context.
/// Retained for test compatibility — SkillTool no longer calls this directly;
/// it uses an inline/fork match branch instead.
pub fn check_execution_context(skill: &SkillMetadata) -> Result<(), String> {
    if skill.execution_context == ExecutionContext::Fork {
        return Err(format!(
            "Skill '{}' requires fork execution context, \
             which requires fork support. This function only validates inline context.",
            skill.name
        ));
    }
    Ok(())
}

/// Execute a fork skill by spawning an independent sub-agent.
///
/// Steps:
/// 1. Prepare skill content (variable substitution + shell execution).
/// 2. Build a SubAgentConfig from skill metadata overrides.
/// 3. Spawn the sub-agent and wait for its result.
/// 4. Return the sub-agent's output text, or an error string on failure.
pub async fn execute_fork(
    skill: &SkillMetadata,
    args: Option<&str>,
    session_id: Option<&str>,
    cwd: &str,
    spawner: &dyn Spawner,
) -> Result<String, String> {
    // Prepare content (substitution + shell) — same pipeline as inline mode
    let prompt = prepare_inline_content(skill, args, session_id, cwd)
        .await
        .map_err(|e: ShellExecutionError| e.to_string())?;

    let sub_config = SubAgentConfig {
        name: skill.name.clone(),
        prompt,
        max_turns: 10,
        max_tokens: 16384,
        system_prompt: None,
    };

    let overrides = ForkOverrides {
        model: skill.model.clone(),
        effort: skill.effort.map(effort_to_string),
        allowed_tools: skill.allowed_tools.clone(),
    };

    let result = spawner.spawn_fork(sub_config, overrides).await;
    if result.is_error {
        Err(result.text)
    } else {
        Ok(result.text)
    }
}

