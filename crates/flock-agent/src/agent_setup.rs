use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use flock_core::config::settings::Config;
use flock_core::model_factory::{create_model, ModelProviderParams};
use flock_tools::mcp::manager::McpManager;
use langgraph_prebuilt::BaseChatModel;
use crate::engine::AgentEngine;
use crate::output::OutputSink;
use crate::session::Session;

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

        // --- Apply assistant overrides to config BEFORE creating the model ---
        if let Some(ref ov) = self.assistant_overrides {
            // Override model if assistant specifies one (format: "provider_id:model_name")
            if let Some(ref model_str) = ov.model {
                if !model_str.is_empty() {
                    // model_str is "provider_id:model_name"
                    let parts: Vec<&str> = model_str.splitn(2, ':').collect();
                    if parts.len() == 2 {
                        self.config.model = parts[1].to_string();
                        log::info!("Assistant overrides model to: {}", self.config.model);
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
            }).map_err(|e| anyhow::anyhow!(e))?)
        };

        log::info!(
            "Building agent with provider type: {:?}, model: {}",
            self.config.provider,
            self.config.model
        );

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

        let tool_set = flock_tools::all_tools();
        let mut registry = tool_set.registry;
        let provider_infos = tool_set.provider_infos;

        let builtin_names: Vec<String> = registry.tool_names();

        let mut mcp_managers: Vec<Arc<McpManager>> = Vec::new();
        let mcp_manager = if !self.config.mcp.servers.is_empty() {
            match McpManager::connect_all(&self.config.mcp.servers).await {
                Ok(mgr) => {
                    let mgr = Arc::new(mgr);
                    flock_tools::mcp::tool_proxy::register_mcp_tools(
                        &mut registry,
                        &mgr,
                        &builtin_names,
                        &self.config.mcp.servers,
                    );
                    mcp_managers.push(mgr.clone());
                    Some(mgr)
                }
                Err(e) => {
                    self.output
                        .emit_error(&format!("MCP initialization error: {e}"));
                    None
                }
            }
        } else {
            None
        };
        let has_mcp = mcp_manager.is_some();

        // --- Load skills (then apply assistant skill allowlist) ---
        let mut skills = flock_skills::loader::load_all_skills(
            cwd_path,
            &self.extra_skill_dirs,
            false,
            mcp_manager.as_deref(),
            &self.extra_raw_skill_dirs,
        )
        .await;

        // Filter skills by assistant allowlist if provided.
        // Some([]) means no skills; None means all skills.
        let has_skills = if let Some(ref ov) = self.assistant_overrides {
            if let Some(ref allowed) = ov.allowed_skill_names {
                if allowed.is_empty() {
                    // No skills for this assistant (pure chat / no skill tool)
                    skills.clear();
                    log::info!("Assistant: no skills bound, skill tool disabled.");
                    false
                } else {
                    let allowed_set: std::collections::HashSet<&str> =
                        allowed.iter().map(|s| s.as_str()).collect();
                    skills.retain(|s| allowed_set.contains(s.name.as_str()));
                    log::info!(
                        "Assistant: filtered skills to {:?}, {} remaining.",
                        allowed,
                        skills.len()
                    );
                    !skills.is_empty()
                }
            } else {
                true // None = all skills
            }
        } else {
            true
        };


        // --- Determine the effective system prompt ---
        // Assistant system_prompt takes priority over the global one.
        let assistant_prompt: Option<&str> = self.assistant_overrides
            .as_ref()
            .and_then(|ov| ov.system_prompt.as_deref())
            .filter(|s| !s.is_empty());

        let base_prompt: Option<&str> = if assistant_prompt.is_some() {
            assistant_prompt
        } else {
            self.config.system_prompt.as_deref()
        };

        let include_tool_guidance = match &self.assistant_overrides {
            None => true,
            Some(ov) => match &ov.allowed_tool_providers {
                None => true,
                Some(providers) => !providers.is_empty(),
            },
        };

        let mut prompt_cache = crate::context::SystemPromptCache::new();
        prompt_cache.include_tool_guidance = include_tool_guidance;
        let system_prompt = crate::context::build_system_prompt(
            &mut prompt_cache,
            base_prompt,
            cwd,
            &self.config.model,
            &skills,
            None,
            memory_dir.as_deref(),
            false,
            self.config.compact.toon,
        );
        self.config.system_prompt = Some(system_prompt);

        // --- Apply tool provider allowlist BEFORE registering internal tools ---
        // Some([]) = no external tools; None = all tools.
        if let Some(ref ov) = self.assistant_overrides {
            if let Some(ref allowed_providers) = ov.allowed_tool_providers {
                log::info!("Assistant: restricting tools to providers: {:?}", allowed_providers);
                registry.retain_by_providers(allowed_providers);
            }
        }

        // --- Decide whether to register spawn / plan / tool_search meta-tools ---
        //
        // Rule:
        //   • No assistant active (original agent)  → always register (unchanged behavior)
        //   • Assistant active + tools = []          → skip ALL meta-tools (pure chat mode)
        //   • Assistant active + tools = [...]       → register (user explicitly chose tools)
        let should_register_meta = match &self.assistant_overrides {
            None => true, // normal agent: register everything (original behavior)
            Some(ov) => match &ov.allowed_tool_providers {
                None => true,               // assistant doesn't restrict tools
                Some(v) => !v.is_empty(),   // empty list = no tools at all
            },
        };

        // --- Register internal tools (skill, spawn, plan) ---
        let skills_arc = Arc::new(skills);
        if has_skills {
            let skill_checker = flock_skills::permissions::SkillPermissionChecker::new(
                self.config.tools.skills.deny.clone(),
                self.config.tools.skills.allow.clone(),
                self.config.tools.auto_approve,
            );
            registry.register(Box::new(crate::tools::skill::SkillTool::new(
                skills_arc,
                cwd.to_string(),
                skill_checker,
            )));
        }

        let plan_active_flag = Arc::new(AtomicBool::new(false));

        if should_register_meta {
            let spawner = Arc::new(crate::spawner::AgentSpawner::new(
                provider.clone(),
                self.config.clone(),
            ));
            registry.register(Box::new(crate::tools::spawn::SpawnTool::new(spawner)));

            if self.config.plan.enabled {
                registry.register(Box::new(crate::tools::plan::EnterPlanModeTool::new(
                    Arc::clone(&plan_active_flag),
                )));
                registry.register(Box::new(crate::tools::plan::ExitPlanModeTool::new(
                    Arc::clone(&plan_active_flag),
                )));
            }

            registry.register(flock_tools::builtin::tool_search::ToolSearchTool::new());
        }

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
