use std::path::PathBuf;
use std::sync::Arc;

use flock_core::config::settings::Config;
use flock_core::model_factory::{create_model, ModelProviderParams};
use flock_tools::mcp::manager::McpManager;
use langgraph::prebuilt::BaseChatModel;
use crate::engine::AgentEngine;
use crate::sinks::OutputSink;
use crate::session::Session;

use crate::agent_setup_helpers::{
    filter_sandbox_tools, setup_mcp, load_and_filter_skills,
    build_effective_system_prompt, register_internal_tools,
};

/// Result of bootstrapping an agent engine with all features initialized.
pub struct AgentBuildResult {
    pub engine: AgentEngine,
    pub provider: Arc<dyn BaseChatModel>,
    pub mcp_managers: Vec<Arc<McpManager>>,
    pub has_mcp: bool,
}

/// Assistant-specific overrides applied on top of global config.
///
/// When an assistant is active:
/// - `system_prompt` replaces the global system prompt (if non-empty)
/// - `model` replaces the global model (if non-empty, format: "provider_id:model_name")
/// - `allowed_tool_providers` = `Some([...])` → only those providers' tools are registered.
///   An empty `Some([])` means NO tools at all (pure chat mode).
/// - `allowed_skill_names` = `Some([...])` → only those skills are passed to SkillTool.
///   An empty `Some([])` means NO skills.
#[derive(Debug, Clone, Default)]
pub struct AssistantOverrides {
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    /// None = no restriction (use all tools). Some(vec) = whitelist (can be empty).
    pub allowed_tool_providers: Option<Vec<String>>,
    /// None = no restriction (use all skills). Some(vec) = whitelist (can be empty).
    pub allowed_skill_names: Option<Vec<String>>,
}

/// Builder for creating a fully-initialized `AgentEngine`.
///
/// Encapsulates the complete initialization pipeline so all consumers
/// (CLI, backend, sub-agents) get consistent behavior:
///
/// - System prompt always includes model identity, working directory, date
/// - Tool usage guidance is always injected
/// - AGENTS.md is loaded from the workspace hierarchy
/// - Skills, MCP, plan mode, spawn are enabled based on `Config` fields
pub struct AgentBuilder {
    config: Config,
    workspace: String,
    output: Arc<dyn OutputSink>,
    provider: Option<Arc<dyn BaseChatModel>>,
    resume_session: Option<Session>,
    extra_skill_dirs: Vec<PathBuf>,
    extra_raw_skill_dirs: Vec<PathBuf>,
    /// Optional assistant overrides – injected by the assistant system.
    assistant_overrides: Option<AssistantOverrides>,
}

impl AgentBuilder {
    pub fn new(config: Config, workspace: impl Into<String>, output: Arc<dyn OutputSink>) -> Self {
        Self {
            config,
            workspace: workspace.into(),
            output,
            provider: None,
            resume_session: None,
            extra_skill_dirs: Vec::new(),
            extra_raw_skill_dirs: Vec::new(),
            assistant_overrides: None,
        }
    }

    /// Use a pre-created provider instead of creating one from config.
    pub fn provider(mut self, provider: Arc<dyn BaseChatModel>) -> Self {
        self.provider = Some(provider);
        self
    }

    /// Resume from a previously saved session.
    pub fn resume(mut self, session: Session) -> Self {
        self.resume_session = Some(session);
        self
    }

    /// Add extra directories to scan for skills (expects `.flock/skills/` inside each).
    pub fn add_skill_paths(mut self, dirs: Vec<PathBuf>) -> Self {
        self.extra_skill_dirs = dirs;
        self
    }

    /// Add extra raw directories to scan for skills directly (no `.flock/skills/` suffix).
    pub fn add_raw_skill_paths(mut self, dirs: Vec<PathBuf>) -> Self {
        self.extra_raw_skill_dirs = dirs;
        self
    }

    /// Apply assistant-specific overrides (system prompt, model, tool/skill allowlist).
    pub fn with_assistant(mut self, overrides: AssistantOverrides) -> Self {
        self.assistant_overrides = Some(overrides);
        self
    }

    /// Read-only access to the config (for session management before build).
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Build the fully-initialized engine.
    pub async fn build(mut self) -> anyhow::Result<AgentBuildResult> {
        let cwd = &self.workspace;
        let cwd_path = std::path::Path::new(cwd);

        if let Some(ref ov) = self.assistant_overrides {
            // Override model if assistant specifies one (format: "provider_id:model_name")
            if let Some(ref model_str) = ov.model {
                if !model_str.is_empty() {
                    if let Err(e) = self.config.apply_assistant_model_override(model_str).await {
                        log::error!("Failed to apply assistant model override: {}", e);
                    } else {
                        log::info!(
                            "Assistant overrides model to: {} (provider: {})",
                            self.config.model,
                            self.config.provider_label
                        );
                    }
                }
            }
        }

        let provider: Arc<dyn BaseChatModel> = if let Some(p) = self.provider {
            p
        } else {
            Arc::from(create_model(ModelProviderParams {
                provider_type: self.config.provider.to_string(),
                model: self.config.model.clone(),
                api_key: self.config.api_key.clone(),
                base_url: if self.config.base_url.is_empty() { None } else { Some(self.config.base_url.clone()) },
                max_tokens: None,
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
                response_format: None,
            }).map_err(|e| anyhow::anyhow!(e))?)
        };

        // log::info!(
        //     "Building agent with provider type: {:?}, model: {}",
        //     self.config.provider,
        //     self.config.model
        // );

        let memory_dir = if self.assistant_overrides.is_some() {
            None
        } else {
            crate::memory::paths::auto_memory_dir(cwd_path)
        };

        let file_cache = if self.config.file_cache.enabled {
            Some(Arc::new(std::sync::RwLock::new(
                flock_tools::file_cache::FileStateCache::new(&self.config.file_cache),
            )))
        } else {
            None
        };

        if let Some(ref cache) = file_cache {
            flock_tools::init_file_cache(Arc::clone(cache));
        }

        let sid = self.resume_session.as_ref()
            .map(|s| s.id.clone())
            .unwrap_or_else(|| "default".to_string());
        flock_tools::init_workspace_dir(&sid, cwd_path.to_path_buf());
        let tool_set = flock_tools::all_tools();
        let mut registry = tool_set.registry;
        let provider_infos = tool_set.provider_infos;

        filter_sandbox_tools(&self.config, &mut registry).await;

        let builtin_names: Vec<String> = registry.tool_names();
        let (mut mcp_managers, mcp_manager) = setup_mcp(
            &self.config, &mut registry, &builtin_names, &self.output,
        ).await;
        let has_mcp = mcp_manager.is_some();

        // --- Load skills (then apply assistant skill allowlist) ---
        let (skills, has_skills) = load_and_filter_skills(
            cwd_path,
            &self.extra_skill_dirs,
            &self.extra_raw_skill_dirs,
            mcp_manager.as_deref(),
            &self.assistant_overrides,
        ).await;


        // Pre-compute whether ToolSearch will be registered so the system
        // prompt can include (or omit) the deferred-tool hint accordingly.
        // Logic mirrors `should_register_meta` inside register_internal_tools.
        let has_tool_search = match &self.assistant_overrides {
            None => true,
            Some(ov) => match &ov.allowed_tool_providers {
                None => true,
                Some(v) => v.iter().any(|t| t == "ToolSearch"),
            },
        };

        // --- Determine the effective system prompt ---
        build_effective_system_prompt(
            &mut self.config,
            &self.assistant_overrides,
            cwd,
            &skills,
            memory_dir.as_deref(),
            has_tool_search,
        );

        // --- Apply tool provider allowlist BEFORE registering internal tools ---
        if let Some(ref ov) = self.assistant_overrides {
            if let Some(ref allowed_providers) = ov.allowed_tool_providers {
                log::info!("Assistant: restricting tools to names: {:?}", allowed_providers);
                let mut whitelist = allowed_providers.clone();
                if !whitelist.contains(&"AskHuman".to_string()) {
                    whitelist.push("AskHuman".to_string());
                }
                registry.retain_by_providers(&whitelist);
            }
        }

        // --- Register internal tools (skill, spawn, plan, tool_search) ---
        let (plan_active_flag, _) = register_internal_tools(
            &mut registry,
            &self.config,
            &self.assistant_overrides,
            has_skills,
            skills,
            provider.clone(),
            cwd,
        );

        let tool_defs_snapshot = registry.to_tool_defs();
        flock_tools::init_tool_defs(tool_defs_snapshot.clone());

        if let Some(db) = &self.config.db_manager {
            if let Err(e) = db.seed_tool_providers(&provider_infos).await {
                log::error!("Failed to seed tool providers: {}", e);
            }
            if let Err(e) = db.upsert_tools(&tool_defs_snapshot, &provider_infos).await {
                log::error!("Failed to seed tools to database: {}", e);
            }
        }

        let mut engine = if let Some(session) = self.resume_session {
            AgentEngine::resume_with_provider(
                provider.clone(),
                self.config,
                registry,
                self.output,
                session,
            ).await
        } else {
            AgentEngine::new_with_provider(provider.clone(), self.config, registry, self.output).await
        };
        engine.set_plan_active_flag(plan_active_flag);

        Ok(AgentBuildResult {
            engine,
            provider,
            mcp_managers,
            has_mcp,
        })
    }
}
