use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use flock_core::config::settings::Config;
use flock_skills::types::SkillMetadata;
use flock_tools::mcp::manager::McpManager;
use flock_tools::registry::ToolRegistry;
use langgraph::prebuilt::BaseChatModel;

use super::agent_setup::AssistantOverrides;
use super::sinks::OutputSink;

/// Remove sandbox tools when sandbox is not configured.
///
/// When sandbox IS configured, both builtin and sandbox tools coexist.
/// The assistant's `allowed_tool_providers` whitelist determines which
/// set is actually exposed to the model for a given agent instance.
/// We never remove builtin tools globally — a "plain" assistant that only
/// lists builtin tool names in its allowlist should still find them even
/// when the global sandbox is configured.
pub async fn filter_sandbox_tools(config: &Config, registry: &mut ToolRegistry) {
    let is_sandbox_configured = if let Some(db) = &config.db_manager {
        flock_tools::daytona::get_sandbox_config(db).await.is_some()
    } else {
        false
    };

    if !is_sandbox_configured {
        // Sandbox not configured — remove sandbox-only tools that require a
        // live Daytona container to function.
        registry.remove("CodeExecution");
        registry.remove("Browser");
        registry.remove("ComputerUse");
        registry.remove("SandboxExec");
        registry.remove("SandboxRead");
        registry.remove("SandboxWrite");
        registry.remove("SandboxEdit");
        registry.remove("RequestHumanAssistance");
    }
    // When sandbox IS configured we keep everything; the assistant allowlist
    // (retain_by_providers) will narrow down the visible tool set per agent.
}

/// Connect to MCP servers and register their tools. Returns (managers, manager_option).
pub async fn setup_mcp(
    config: &Config,
    registry: &mut ToolRegistry,
    builtin_names: &[String],
    output: &Arc<dyn OutputSink>,
) -> (Vec<Arc<McpManager>>, Option<Arc<McpManager>>) {
    let mut mcp_managers: Vec<Arc<McpManager>> = Vec::new();
    let mcp_manager = if !config.mcp.servers.is_empty() {
        match McpManager::connect_all(&config.mcp.servers).await {
            Ok(mgr) => {
                let mgr = Arc::new(mgr);
                flock_tools::mcp::tool_proxy::register_mcp_tools(
                    registry,
                    &mgr,
                    builtin_names,
                    &config.mcp.servers,
                );
                mcp_managers.push(mgr.clone());
                Some(mgr)
            }
            Err(e) => {
                output.emit_error(&format!("MCP initialization error: {e}"));
                None
            }
        }
    } else {
        None
    };
    (mcp_managers, mcp_manager)
}

/// Load skills and apply assistant allowlist filtering.
/// Returns (skills, has_skills).
pub async fn load_and_filter_skills(
    cwd_path: &Path,
    extra_skill_dirs: &[PathBuf],
    extra_raw_skill_dirs: &[PathBuf],
    mcp_manager: Option<&McpManager>,
    assistant_overrides: &Option<AssistantOverrides>,
) -> (Vec<SkillMetadata>, bool) {
    let mut skills = flock_skills::loader::load_all_skills(
        cwd_path,
        extra_skill_dirs,
        false,
        mcp_manager,
        extra_raw_skill_dirs,
    )
    .await;

    let has_skills = if let Some(ov) = assistant_overrides {
        if let Some(ref allowed) = ov.allowed_skill_names {
            if allowed.is_empty() {
                skills.clear();
                // log::info!("Assistant: no skills bound, skill tool disabled.");
                false
            } else {
                let allowed_set: std::collections::HashSet<&str> =
                    allowed.iter().map(|s| s.as_str()).collect();
                skills.retain(|s| allowed_set.contains(s.name.as_str()));
                // log::info!(
                    // "Assistant: filtered skills to {:?}, {} remaining.",
                    // allowed,
                    // skills.len()
                // );
                !skills.is_empty()
            }
        } else {
            true
        }
    } else {
        true
    };

    (skills, has_skills)
}

/// Build the effective system prompt, applying assistant overrides.
///
/// `has_tool_search` controls whether the ToolSearch deferred-tool hint is
/// included in the tool guidance section. Pass `false` for assistants that
/// do not have ToolSearch registered (e.g. pure-chat or narrow-tool assistants).
pub fn build_effective_system_prompt(
    config: &mut Config,
    assistant_overrides: &Option<AssistantOverrides>,
    cwd: &str,
    skills: &[SkillMetadata],
    memory_dir: Option<&Path>,
    has_tool_search: bool,
) {
    let assistant_prompt: Option<&str> = assistant_overrides
        .as_ref()
        .and_then(|ov| ov.system_prompt.as_deref())
        .filter(|s| !s.is_empty());

    let base_prompt: Option<&str> = if assistant_prompt.is_some() {
        assistant_prompt
    } else {
        config.system_prompt.as_deref()
    };

    let include_tool_guidance = match assistant_overrides {
        None => true,
        Some(ov) => match &ov.allowed_tool_providers {
            None => true,
            Some(providers) => !providers.is_empty(),
        },
    };

    let mut prompt_cache = crate::context::SystemPromptCache::new();
    prompt_cache.include_tool_guidance = include_tool_guidance;
    prompt_cache.inject_agents_md = assistant_overrides.is_none();
    prompt_cache.include_tool_search_hint = has_tool_search;
    let system_prompt = crate::context::build_system_prompt(
        &mut prompt_cache,
        base_prompt,
        cwd,
        &config.model,
        &[], // static system prompt omits skills for cache efficiency
        None,
        None, // static system prompt omits memory
        false,
        config.compact.toon,
    );
    config.system_prompt = Some(system_prompt);

    let dynamic_reminder = crate::context::build_dynamic_context_reminder(
        memory_dir,
        skills,
        None,
    );
    config.dynamic_context_reminder = Some(dynamic_reminder);
}

/// Register internal meta-tools: skill, spawn, plan, tool_search.
/// Returns `(plan_active_flag, has_tool_search)`.
pub fn register_internal_tools(
    registry: &mut ToolRegistry,
    config: &Config,
    assistant_overrides: &Option<AssistantOverrides>,
    has_skills: bool,
    skills: Vec<SkillMetadata>,
    provider: Arc<dyn BaseChatModel>,
    cwd: &str,
) -> (Arc<AtomicBool>, bool) {
    let (should_spawn, should_plan, should_tool_search) = match assistant_overrides {
        None => (true, config.plan.enabled, true),
        Some(ov) => match &ov.allowed_tool_providers {
            None => (true, config.plan.enabled, true),
            Some(v) => (
                v.iter().any(|t| t == "Spawn"),
                config.plan.enabled && (v.iter().any(|t| t == "EnterPlanMode") || v.iter().any(|t| t == "ExitPlanMode")),
                v.iter().any(|t| t == "ToolSearch"),
            ),
        },
    };

    let skills_arc = Arc::new(skills);
    if has_skills {
        let skill_checker = flock_skills::permissions::SkillPermissionChecker::new(
            config.tools.skills.deny.clone(),
            config.tools.skills.allow.clone(),
            config.tools.auto_approve,
        );
        registry.register(Box::new(crate::tools::skill::SkillTool::new(
            skills_arc,
            cwd.to_string(),
            skill_checker,
        )));
    }

    let plan_active_flag = Arc::new(AtomicBool::new(false));

    if should_spawn {
        let spawner = Arc::new(crate::spawner::AgentSpawner::new(
            provider.clone(),
            config.clone(),
        ));
        registry.register(Box::new(crate::tools::spawn::SpawnTool::new(spawner)));
    }

    if should_plan {
        registry.register(Box::new(crate::tools::plan::EnterPlanModeTool::new(
            Arc::clone(&plan_active_flag),
        )));
        registry.register(Box::new(crate::tools::plan::ExitPlanModeTool::new(
            Arc::clone(&plan_active_flag),
        )));
    }

    if should_tool_search {
        registry.register(flock_tools::builtin::tool_search::ToolSearchTool::new());
    }

    (plan_active_flag, should_tool_search)
}
