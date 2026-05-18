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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ExecutionContext, LoadChannel, SkillMetadata, SkillSource};

    fn make_skill(content: &str, skill_root: Option<&str>) -> SkillMetadata {
        SkillMetadata {
            name: "test".to_string(),
            display_name: None,
            description: String::new(),
            has_user_specified_description: false,
            allowed_tools: Vec::new(),
            argument_hint: None,
            argument_names: Vec::new(),
            when_to_use: None,
            version: None,
            model: None,
            disable_model_invocation: false,
            user_invocable: true,
            execution_context: ExecutionContext::Inline,
            agent: None,
            effort: None,
            shell: None,
            paths: Vec::new(),
            hooks_raw: None,
            source: SkillSource::User,
            loaded_from: LoadChannel::Skills,
            content: content.to_string(),
            content_length: content.len(),
            skill_root: skill_root.map(str::to_owned),
        }
    }

    #[tokio::test]
    async fn test_prepare_inline_no_args() {
        let skill = make_skill("Do the thing.", None);
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "Do the thing.");
    }

    #[tokio::test]
    async fn test_prepare_inline_with_base_directory_header() {
        let skill = make_skill("Content here.", Some("/my/skill/dir"));
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert!(
            result.starts_with("Base directory for this skill: /my/skill/dir\n\n"),
            "expected base directory header, got: {result}"
        );
        assert!(result.contains("Content here."));
    }

    #[tokio::test]
    async fn test_prepare_inline_substitutes_arguments() {
        let skill = make_skill("Target: $ARGUMENTS", None);
        let result = prepare_inline_content(&skill, Some("foo"), None, "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "Target: foo");
    }

    #[tokio::test]
    async fn test_prepare_inline_substitutes_skill_dir() {
        let skill = make_skill("Dir: ${flock_SKILL_DIR}", Some("/skills/mine"));
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        // Header + substituted dir
        assert!(result.contains("Dir: /skills/mine"));
    }

    #[tokio::test]
    async fn test_prepare_inline_substitutes_session_id() {
        let skill = make_skill("Session: ${flock_SESSION_ID}", None);
        let result = prepare_inline_content(&skill, None, Some("sess-abc"), "/tmp")
            .await
            .unwrap();
        assert!(result.contains("Session: sess-abc"));
    }

    #[test]
    fn test_check_execution_context_inline_ok() {
        let skill = make_skill("", None);
        assert!(check_execution_context(&skill).is_ok());
    }

    #[test]
    fn test_check_execution_context_fork_err() {
        let mut skill = make_skill("", None);
        skill.execution_context = ExecutionContext::Fork;
        let err = check_execution_context(&skill).unwrap_err();
        assert!(err.contains("fork execution context"));
    }
}

// ---------------------------------------------------------------------------
// Supplemental tests (tester role — covers test-plan.md cases not in impl tests)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod supplemental_tests {
    use super::*;
    use crate::types::{ExecutionContext, LoadChannel, SkillMetadata, SkillSource};

    fn make_skill_full(
        name: &str,
        content: &str,
        skill_root: Option<&str>,
        argument_names: Vec<String>,
        context: ExecutionContext,
    ) -> SkillMetadata {
        SkillMetadata {
            name: name.to_string(),
            display_name: None,
            description: String::new(),
            has_user_specified_description: false,
            allowed_tools: Vec::new(),
            argument_hint: None,
            argument_names,
            when_to_use: None,
            version: None,
            model: None,
            disable_model_invocation: false,
            user_invocable: true,
            execution_context: context,
            agent: None,
            effort: None,
            shell: None,
            paths: Vec::new(),
            hooks_raw: None,
            source: SkillSource::User,
            loaded_from: LoadChannel::Skills,
            content: content.to_string(),
            content_length: content.len(),
            skill_root: skill_root.map(str::to_owned),
        }
    }

    // TC-10.1: basic prepare_inline_content call
    #[tokio::test]
    async fn tc_10_1_prepare_inline_substitutes_arguments() {
        let skill = make_skill_full(
            "s",
            "Search $ARGUMENTS",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, Some("rust"), None, "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "Search rust");
    }

    // TC-10.2: no args, no placeholder → content unchanged
    #[tokio::test]
    async fn tc_10_2_no_args_no_placeholder_unchanged() {
        let skill = make_skill_full("s", "Just content.", None, vec![], ExecutionContext::Inline);
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "Just content.");
    }

    // TC-10.3: skill_root causes base directory header to be prepended
    #[tokio::test]
    async fn tc_10_3_skill_root_prepends_header() {
        let skill = make_skill_full(
            "s",
            "${flock_SKILL_DIR}/script.sh",
            Some("/path/to/skill"),
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert!(
            result.starts_with("Base directory for this skill: /path/to/skill"),
            "expected header, got: {result}"
        );
        assert!(result.contains("/path/to/skill/script.sh"));
    }

    // TC-10.x: session_id substitution wired through
    #[tokio::test]
    async fn tc_10_x_session_id_substituted() {
        let skill = make_skill_full(
            "s",
            "${flock_SESSION_ID}",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, None, Some("sess-xyz"), "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "sess-xyz");
    }

    // TC-10.x: argument_names from metadata are used
    #[tokio::test]
    async fn tc_10_x_argument_names_from_metadata() {
        let names = vec!["query".to_string()];
        let skill = make_skill_full(
            "s",
            "Find $query in codebase",
            None,
            names,
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, Some("main function"), None, "/tmp")
            .await
            .unwrap();
        assert_eq!(result, "Find main in codebase");
    }

    // TC-10.x: fork context check
    #[test]
    fn tc_10_x_check_context_fork_returns_err() {
        let skill = make_skill_full("fork-skill", "body", None, vec![], ExecutionContext::Fork);
        let result = check_execution_context(&skill);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("fork-skill"));
        assert!(msg.contains("fork execution context"));
    }

    // TC-10.x: inline context check returns Ok
    #[test]
    fn tc_10_x_check_context_inline_returns_ok() {
        let skill = make_skill_full(
            "inline-skill",
            "body",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        assert!(check_execution_context(&skill).is_ok());
    }

    // -----------------------------------------------------------------------
    // Phase 4 additions: shell integration in prepare_inline_content
    // -----------------------------------------------------------------------

    // TC-10.4: Block shell 命令被执行替换
    #[tokio::test]
    #[cfg(not(windows))] // Uses Unix shell syntax in ```! blocks
    async fn tc_10_4_block_shell_executed_in_prepare() {
        let skill = make_skill_full(
            "s",
            "Result:\n```!\necho shell_output\n```\nDone.",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert!(
            result.contains("shell_output"),
            "block shell output missing: {result}"
        );
        assert!(
            !result.contains("```!"),
            "block syntax should be replaced: {result}"
        );
    }

    // TC-10.5: Inline shell 命令被执行替换
    #[tokio::test]
    #[cfg(not(windows))] // Uses Unix shell syntax (!` inline)
    async fn tc_10_5_inline_shell_executed_in_prepare() {
        let skill = make_skill_full(
            "s",
            "Dir: !`echo /inline_dir`",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        assert!(
            result.contains("/inline_dir"),
            "inline shell output missing: {result}"
        );
        assert!(
            !result.contains("!`"),
            "inline syntax should be replaced: {result}"
        );
    }

    // TC-10.6: MCP skill 跳过 shell — content 中的 shell 语法原样保留
    #[tokio::test]
    async fn tc_10_6_mcp_skill_shell_skipped() {
        let mut skill = make_skill_full(
            "s",
            "run !`pwd` here",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        skill.loaded_from = LoadChannel::Mcp;
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        // MCP skill: shell command NOT executed, syntax remains
        assert_eq!(
            result, "run !`pwd` here",
            "MCP skill should preserve shell syntax: {result}"
        );
    }

    // TC-10.7: 变量替换 + shell 顺序 — 先变量替换再 shell 执行
    #[tokio::test]
    #[cfg(not(windows))] // Uses Unix shell syntax and /tmp path
    async fn tc_10_7_variable_substitution_before_shell() {
        // $ARGUMENTS is substituted first, then the resulting content is shell-executed
        // We verify by having a non-shell placeholder that gets substituted
        let skill = make_skill_full(
            "s",
            "Text: $ARGUMENTS !`echo done`",
            None,
            vec![],
            ExecutionContext::Inline,
        );
        let result = prepare_inline_content(&skill, Some("hello"), None, "/tmp")
            .await
            .unwrap();
        assert!(
            result.contains("hello"),
            "variable substitution should have happened: {result}"
        );
        assert!(
            result.contains("done"),
            "shell should have executed: {result}"
        );
    }

    // TC-10.8: cwd 参数传递给 execute_shell_commands
    #[tokio::test]
    #[cfg(not(windows))] // Uses pwd command (Unix only)
    async fn tc_10_8_cwd_passed_to_shell() {
        let skill = make_skill_full("s", "!`pwd`", None, vec![], ExecutionContext::Inline);
        let result = prepare_inline_content(&skill, None, None, "/tmp")
            .await
            .unwrap();
        // /tmp or /private/tmp on macOS
        assert!(
            result.contains("tmp"),
            "cwd should be reflected in pwd output: {result}"
        );
    }
}

// ---------------------------------------------------------------------------
// Phase 7 tests — execute_fork() with MockSpawner
// ---------------------------------------------------------------------------

#[cfg(test)]
mod phase7_tests {
    use std::sync::Mutex;

    use async_trait::async_trait;

    use super::execute_fork;
    use crate::types::{EffortLevel, ExecutionContext, LoadChannel, SkillMetadata, SkillSource};
    use flock_core::types::message::TokenUsage;
    use flock_core::types::spawner::{ForkOverrides, Spawner, SubAgentConfig, SubAgentResult};

    // ---------------------------------------------------------------------------
    // MockSpawner — captures args passed to spawn_fork, returns preset result
    // ---------------------------------------------------------------------------

    struct MockSpawner {
        /// Preset is_error value for the returned SubAgentResult.
        is_error: bool,
        /// Preset text value for the returned SubAgentResult.
        text: String,
        /// Captures the SubAgentConfig passed to spawn_fork.
        captured_config: Mutex<Option<SubAgentConfig>>,
        /// Captures the ForkOverrides passed to spawn_fork.
        captured_overrides: Mutex<Option<ForkOverrides>>,
    }

    impl MockSpawner {
        fn success(text: &str) -> Self {
            Self {
                is_error: false,
                text: text.to_string(),
                captured_config: Mutex::new(None),
                captured_overrides: Mutex::new(None),
            }
        }

        fn error(text: &str) -> Self {
            Self {
                is_error: true,
                text: text.to_string(),
                captured_config: Mutex::new(None),
                captured_overrides: Mutex::new(None),
            }
        }

        fn take_config(&self) -> SubAgentConfig {
            self.captured_config
                .lock()
                .unwrap()
                .take()
                .expect("spawn_fork was not called")
        }

        fn take_overrides(&self) -> ForkOverrides {
            self.captured_overrides
                .lock()
                .unwrap()
                .take()
                .expect("spawn_fork was not called")
        }
    }

    #[async_trait]
    impl Spawner for MockSpawner {
        async fn spawn_fork(
            &self,
            config: SubAgentConfig,
            overrides: ForkOverrides,
        ) -> SubAgentResult {
            *self.captured_config.lock().unwrap() = Some(config.clone());
            *self.captured_overrides.lock().unwrap() = Some(overrides.clone());
            SubAgentResult {
                name: config.name.clone(),
                text: self.text.clone(),
                usage: TokenUsage::default(),
                turns: 1,
                is_error: self.is_error,
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    fn make_fork_skill(name: &str, content: &str) -> SkillMetadata {
        SkillMetadata {
            name: name.to_string(),
            display_name: None,
            description: String::new(),
            has_user_specified_description: false,
            allowed_tools: Vec::new(),
            argument_hint: None,
            argument_names: Vec::new(),
            when_to_use: None,
            version: None,
            model: None,
            disable_model_invocation: false,
            user_invocable: true,
            execution_context: ExecutionContext::Fork,
            agent: None,
            effort: None,
            shell: None,
            paths: Vec::new(),
            hooks_raw: None,
            source: SkillSource::User,
            loaded_from: LoadChannel::Skills,
            content: content.to_string(),
            content_length: content.len(),
            skill_root: None,
        }
    }

    // ---------------------------------------------------------------------------
    // TC-7.10: execute_fork success — returns Ok with sub-agent text
    // ---------------------------------------------------------------------------
    #[tokio::test]
    async fn tc_7_10_fork_success_returns_ok() {
        let skill = make_fork_skill("my-fork", "Do the task.");
        let spawner = MockSpawner::success("agent completed task");
        let result = execute_fork(&skill, None, None, "/tmp", &spawner).await;
        assert!(result.is_ok(), "expected Ok, got: {result:?}");
        assert_eq!(result.unwrap(), "agent completed task");
    }

    // TC-7.11: execute_fork sub-agent error — returns Err with error text
    #[tokio::test]
    async fn tc_7_11_fork_sub_agent_error_returns_err() {
        let skill = make_fork_skill("failing-fork", "Do something.");
        let spawner = MockSpawner::error("sub-agent crashed");
        let result = execute_fork(&skill, None, None, "/tmp", &spawner).await;
        assert!(result.is_err(), "expected Err, got: {result:?}");
        assert_eq!(result.unwrap_err(), "sub-agent crashed");
    }

    // TC-7.13: model from SkillMetadata propagates to ForkOverrides
    #[tokio::test]
    async fn tc_7_13_model_propagated_to_fork_overrides() {
        let mut skill = make_fork_skill("model-fork", "content");
        skill.model = Some("claude-sonnet-4-6".to_string());
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let overrides = spawner.take_overrides();
        assert_eq!(overrides.model.as_deref(), Some("claude-sonnet-4-6"));
    }

    // TC-7.14: effort from SkillMetadata propagates to ForkOverrides as string
    #[tokio::test]
    async fn tc_7_14_effort_propagated_to_fork_overrides() {
        let mut skill = make_fork_skill("effort-fork", "content");
        skill.effort = Some(EffortLevel::High);
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let overrides = spawner.take_overrides();
        assert_eq!(overrides.effort.as_deref(), Some("high"));
    }

    // TC-7.15: allowed_tools from SkillMetadata propagates to ForkOverrides
    #[tokio::test]
    async fn tc_7_15_allowed_tools_propagated_to_fork_overrides() {
        let mut skill = make_fork_skill("tools-fork", "content");
        skill.allowed_tools = vec!["Bash".to_string(), "Read".to_string()];
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let overrides = spawner.take_overrides();
        assert_eq!(overrides.allowed_tools, vec!["Bash", "Read"]);
    }

    // TC-7.16: prompt passed to SubAgentConfig equals prepare_inline_content output
    #[tokio::test]
    async fn tc_7_16_prompt_is_prepared_content() {
        let mut skill = make_fork_skill("prompt-fork", "Search $ARGUMENTS");
        skill.argument_names = vec![]; // use $ARGUMENTS placeholder
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, Some("rust"), None, "/tmp", &spawner)
            .await
            .unwrap();
        let config = spawner.take_config();
        // Variable substitution should have replaced $ARGUMENTS with "rust"
        assert_eq!(
            config.prompt, "Search rust",
            "prompt should contain substituted content"
        );
    }

    // TC-7.17: SubAgentConfig.name equals skill.name
    #[tokio::test]
    async fn tc_7_17_sub_agent_config_name_equals_skill_name() {
        let skill = make_fork_skill("my-skill-name", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let config = spawner.take_config();
        assert_eq!(config.name, "my-skill-name");
    }

    // TC-7.40: empty skill content produces empty prompt (no parse error)
    #[tokio::test]
    async fn tc_7_40_empty_content_no_error() {
        let skill = make_fork_skill("empty-fork", "");
        let spawner = MockSpawner::success("ok");
        let result = execute_fork(&skill, None, None, "/tmp", &spawner).await;
        assert!(
            result.is_ok(),
            "empty content should not cause error: {result:?}"
        );
        let config = spawner.take_config();
        assert_eq!(config.prompt, "");
    }

    // TC-7.41: MCP fork skill behaves the same as regular fork skill
    #[tokio::test]
    async fn tc_7_41_mcp_fork_skill_allowed() {
        let mut skill = make_fork_skill("mcp-fork", "content");
        skill.source = SkillSource::Mcp;
        skill.loaded_from = LoadChannel::Mcp;
        let spawner = MockSpawner::success("mcp result");
        let result = execute_fork(&skill, None, None, "/tmp", &spawner).await;
        assert!(
            result.is_ok(),
            "MCP fork skill should be allowed: {result:?}"
        );
    }

    // TC-7.42: no model/effort → ForkOverrides fields are None/empty
    #[tokio::test]
    async fn tc_7_42_no_model_no_effort_fork_overrides_empty() {
        let skill = make_fork_skill("plain-fork", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let overrides = spawner.take_overrides();
        assert!(overrides.model.is_none(), "model should be None");
        assert!(overrides.effort.is_none(), "effort should be None");
        assert!(
            overrides.allowed_tools.is_empty(),
            "allowed_tools should be empty"
        );
    }

    // TC-7.43 (allowed_tools empty): empty allowed_tools passes through
    #[tokio::test]
    async fn tc_7_43_empty_allowed_tools_passthrough() {
        let skill = make_fork_skill("no-tools-fork", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let overrides = spawner.take_overrides();
        assert!(overrides.allowed_tools.is_empty());
    }

    // TC-7.44: sub-agent result text propagated to Ok return value
    #[tokio::test]
    async fn tc_7_44_result_text_propagated() {
        let skill = make_fork_skill("text-fork", "content");
        let spawner = MockSpawner::success("the final answer");
        let result = execute_fork(&skill, None, None, "/tmp", &spawner).await;
        assert_eq!(result.unwrap(), "the final answer");
    }

    // TC-7.45: SubAgentConfig.max_turns defaults to 10
    #[tokio::test]
    async fn tc_7_45_max_turns_default_is_10() {
        let skill = make_fork_skill("turns-fork", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let config = spawner.take_config();
        assert_eq!(config.max_turns, 10);
    }

    // TC-7.46: SubAgentConfig.max_tokens defaults to 16384
    #[tokio::test]
    async fn tc_7_46_max_tokens_default_is_16384() {
        let skill = make_fork_skill("tokens-fork", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let config = spawner.take_config();
        assert_eq!(config.max_tokens, 16384);
    }

    // TC-7.47: SubAgentConfig.system_prompt defaults to None
    #[tokio::test]
    async fn tc_7_47_system_prompt_default_is_none() {
        let skill = make_fork_skill("sysprompt-fork", "content");
        let spawner = MockSpawner::success("ok");
        execute_fork(&skill, None, None, "/tmp", &spawner)
            .await
            .unwrap();
        let config = spawner.take_config();
        assert!(
            config.system_prompt.is_none(),
            "system_prompt should default to None"
        );
    }

    // All effort levels convert to their string representations
    #[test]
    fn tc_7_effort_all_variants_to_string() {
        use crate::context_modifier::effort_to_string;
        assert_eq!(effort_to_string(EffortLevel::Low), "low");
        assert_eq!(effort_to_string(EffortLevel::Medium), "medium");
        assert_eq!(effort_to_string(EffortLevel::High), "high");
        assert_eq!(effort_to_string(EffortLevel::Max), "max");
    }
}
