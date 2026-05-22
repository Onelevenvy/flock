use std::path::PathBuf;

pub mod adapter;
pub mod file_cache;

pub mod registry;
pub mod mcp;
pub mod builtin;
pub mod math;
pub mod openweather;
pub mod baidu;
pub mod google;
pub mod serper;
pub mod daytona;
pub mod sandbox;

/// Snapshot of all registered tools and their provider metadata.
pub struct ToolSet {
    pub registry: registry::ToolRegistry,
    pub provider_infos: Vec<flock_core::types::tool::ProviderInfo>,
}

/// Build the complete tool set with all providers and tools.
/// Adding a new tool provider? Just add one entry here.
pub fn all_tools() -> ToolSet {
    let mut reg = registry::ToolRegistry::new();
    let mut infos = Vec::new();

    // --- builtin ---
    infos.push(builtin::provider_info());
    reg.register(builtin::read::ReadTool::new());
    reg.register(builtin::write::WriteTool::new());
    reg.register(builtin::edit::EditTool::new());
    reg.register(builtin::bash::BashTool::new());
    reg.register(builtin::grep::GrepTool::new());
    reg.register(builtin::glob::GlobTool::new());

    // --- sandbox ---
    infos.push(sandbox::provider_info());
    reg.register(sandbox::code_execution::CodeExecutionToolImpl::new());
    reg.register(sandbox::browser::BrowserToolImpl::new());
    reg.register(sandbox::computer_use::ComputerUseToolImpl::new());
    reg.register(sandbox::sandbox_exec::SandboxExecToolImpl::new());
    reg.register(sandbox::request_human_assistance::RequestHumanAssistanceToolImpl::new());

    // --- math ---
    infos.push(math::provider_info());
    reg.register(math::MathTool::new());

    // --- openweather ---
    infos.push(openweather::provider_info());
    reg.register(openweather::OpenWeatherTool::new());

    // --- baidu ---
    infos.push(baidu::provider_info());
    reg.register(baidu::BaiduTool::new());

    // --- google ---
    infos.push(google::provider_info());
    reg.register(google::GoogleTool::new());

    // --- serper ---
    infos.push(serper::provider_info());
    reg.register(serper::SerperTool::new());

    ToolSet { registry: reg, provider_infos: infos }
}

use crate::file_cache::FileStateCache;
use flock_core::db::DbManager;
use std::sync::{Arc, OnceLock, RwLock};

static GLOBAL_FILE_CACHE: OnceLock<Arc<RwLock<FileStateCache>>> = OnceLock::new();

/// Initialize the global file cache for tools.
pub fn init_file_cache(cache: Arc<RwLock<FileStateCache>>) {
    let _ = GLOBAL_FILE_CACHE.set(cache);
}

/// Get the global file cache if initialized.
pub fn get_file_cache() -> Option<Arc<RwLock<FileStateCache>>> {
    GLOBAL_FILE_CACHE.get().cloned()
}

static GLOBAL_TOOL_DEFS: OnceLock<Vec<flock_core::types::tool::ToolDef>> = OnceLock::new();

/// Initialize the global tool defs for ToolSearch.
pub fn init_tool_defs(defs: Vec<flock_core::types::tool::ToolDef>) {
    let _ = GLOBAL_TOOL_DEFS.set(defs);
}

/// Get the global tool defs if initialized.
pub fn get_tool_defs() -> Option<Vec<flock_core::types::tool::ToolDef>> {
    GLOBAL_TOOL_DEFS.get().cloned()
}

static GLOBAL_DB_MANAGER: OnceLock<Arc<DbManager>> = OnceLock::new();

/// Initialize the global DB manager for tool credential resolution.
pub fn init_db_manager(db: Arc<DbManager>) {
    let _ = GLOBAL_DB_MANAGER.set(db);
}

/// Get the global DB manager if initialized.
pub fn get_db_manager() -> Option<Arc<DbManager>> {
    GLOBAL_DB_MANAGER.get().cloned()
}

static GLOBAL_APPROVAL_MANAGER: OnceLock<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>> = OnceLock::new();

/// Initialize the global approval manager for tools.
pub fn init_global_approval_manager(mgr: Arc<flock_core::ipc_interface::approval::ToolApprovalManager>) {
    let _ = GLOBAL_APPROVAL_MANAGER.set(mgr);
}

/// Get the global approval manager if initialized.
pub fn get_global_approval_manager() -> Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>> {
    GLOBAL_APPROVAL_MANAGER.get().cloned()
}

static GLOBAL_EMITTER: OnceLock<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>> = OnceLock::new();

/// Initialize the global emitter for tools.
pub fn init_global_emitter(emitter: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>) {
    let _ = GLOBAL_EMITTER.set(emitter);
}

/// Get the global emitter if initialized.
pub fn get_global_emitter() -> Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>> {
    GLOBAL_EMITTER.get().cloned()
}

static GLOBAL_WORKSPACE_DIR: OnceLock<std::sync::RwLock<Option<PathBuf>>> = OnceLock::new();

/// Initialize the active workspace directory for tool calculations.
pub fn init_workspace_dir(dir: PathBuf) {
    if let Some(lock) = GLOBAL_WORKSPACE_DIR.get() {
        if let Ok(mut writer) = lock.write() {
            *writer = Some(dir);
        }
    } else {
        let _ = GLOBAL_WORKSPACE_DIR.set(std::sync::RwLock::new(Some(dir)));
    }
}

/// Get the active workspace directory if set.
pub fn get_workspace_dir() -> Option<PathBuf> {
    GLOBAL_WORKSPACE_DIR.get()
        .and_then(|lock| lock.read().ok())
        .and_then(|reader| reader.clone())
}

/// Send an info message to the client.
pub fn emit_info(message: &str) {
    if let Some(emitter) = get_global_emitter() {
        let _ = emitter.emit(&flock_core::ipc_interface::events::ProtocolEvent::Info {
            msg_id: String::new(),
            message: message.to_string(),
        });
    }
}

/// Resolve decrypted credentials for a tool provider by its ID.
/// Returns `None` if provider not found or has no credentials.
pub async fn resolve_provider_credentials(provider_id: &str) -> Option<String> {
    let db = get_db_manager()?;
    let providers = db.list_tool_providers().await.ok()?;
    let provider = providers.iter().find(|p| p.id == provider_id)?;
    provider.credentials.clone()
}

use async_trait::async_trait;
use serde_json::Value;

use flock_core::config::hooks::HooksConfig;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::skill_types::ContextModifier;
use flock_core::types::tool::{JsonSchema, ToolResult};

/// Truncate a string to at most `max_bytes`, snapping to a char boundary.
pub fn truncate_utf8(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// A tool that the agent can invoke
#[async_trait]
pub trait Tool: Send + Sync {
    /// Tool name (must match API schema)
    fn name(&self) -> &str;

    /// Human-readable description for the LLM
    fn description(&self) -> &str;

    /// JSON Schema for input parameters
    fn input_schema(&self) -> JsonSchema;

    /// Whether this tool is safe to run concurrently
    fn is_concurrency_safe(&self, input: &Value) -> bool;

    /// Execute the tool
    async fn execute(&self, input: Value) -> ToolResult;

    /// Return an optional context modifier based on the tool input.
    /// Called after execute() to collect any engine-level overrides.
    /// Only SkillTool overrides this; all other tools return None.
    fn context_modifier_for(&self, _input: &Value) -> Option<ContextModifier> {
        None
    }

    /// Return any hooks declared in the skill's frontmatter for dynamic registration.
    /// Called after a successful execute() so the orchestration layer can merge
    /// the returned hooks into the active HookEngine.
    /// Only SkillTool overrides this; all other tools return None.
    fn skill_hooks_for(&self, _input: &Value) -> Option<HooksConfig> {
        None
    }

    /// Max result size in chars before truncation
    fn max_result_size(&self) -> usize {
        50_000
    }

    /// Tool category for ipc_interface classification
    fn category(&self) -> ToolCategory;

    /// Whether this tool's schema should be deferred (sent as name-only stub).
    /// Override to `true` for tools with large schemas or infrequent use.
    fn is_deferred(&self) -> bool {
        false
    }

    /// Human-readable description of what the tool will do with the given input
    fn describe(&self, input: &Value) -> String {
        format!(
            "{}: {}",
            self.name(),
            serde_json::to_string(input).unwrap_or_default()
        )
    }

    /// Provider ID for this tool (e.g. 'builtin', 'mcp:github', 'skill')
    fn provider_id(&self) -> &str {
        "builtin"
    }

    /// Display name of the provider
    fn provider_name(&self) -> &str {
        "Built-in Tools"
    }

    /// Whether this provider needs authentication configuration
    fn needs_auth(&self) -> bool {
        false
    }
}

