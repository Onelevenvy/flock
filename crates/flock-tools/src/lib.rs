use std::path::PathBuf;

pub mod adapter;
pub mod file_cache;
pub mod tool_executor;

pub mod sandbox_core;
pub mod registry;
pub mod tools;


pub use tools::{baidu, builtin, google, math, mcp, openweather, sandbox, serper};

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
    reg.register(builtin::ask_human::AskHumanToolImpl::new());

    // --- sandbox ---
    infos.push(sandbox::provider_info());
    reg.register(sandbox::code_execution::CodeExecutionToolImpl::new());
    reg.register(sandbox::browser::BrowserToolImpl::new());
    reg.register(sandbox::computer_use::ComputerUseToolImpl::new());
    reg.register(sandbox::sandbox_exec::SandboxExecToolImpl::new());
    reg.register(sandbox::request_human_assistance::RequestHumanAssistanceToolImpl::new());
    reg.register(sandbox::fs_tools::SandboxReadToolImpl::new());
    reg.register(sandbox::fs_tools::SandboxWriteToolImpl::new());
    reg.register(sandbox::fs_tools::SandboxEditToolImpl::new());

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

pub struct ToolContext {
    pub session_id: String,
    pub workspace_dir: std::path::PathBuf,
    pub db_manager: Option<Arc<flock_core::db::DbManager>>,
    pub file_cache: Option<Arc<std::sync::RwLock<FileStateCache>>>,
    pub protocol_emitter: Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
    pub approval_manager: Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>>,
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

tokio::task_local! {
    pub static ACTIVE_TOOL_CONTEXT: ToolContext;
}

/// Helper function to retrieve the active task-local ToolContext.
pub fn with_active_context<F, R>(f: F) -> R
where
    F: FnOnce(&ToolContext) -> R,
{
    ACTIVE_TOOL_CONTEXT.try_with(|ctx| f(ctx)).unwrap_or_else(|_| {
        panic!("ACTIVE_TOOL_CONTEXT is not set in the current task environment! Please run inside the task-local scope.");
    })
}

/// Helper function to safely try getting the ACTIVE_TOOL_CONTEXT.
pub fn try_with_active_context<F, R>(f: F) -> Option<R>
where
    F: FnOnce(&ToolContext) -> R,
{
    ACTIVE_TOOL_CONTEXT.try_with(|ctx| f(ctx)).ok()
}

/// Get the active file cache from the task-local context.
pub fn get_file_cache() -> Option<Arc<RwLock<FileStateCache>>> {
    try_with_active_context(|ctx| ctx.file_cache.clone()).flatten()
}

/// Get the active DB manager from the task-local context.
pub fn get_db_manager() -> Option<Arc<DbManager>> {
    try_with_active_context(|ctx| ctx.db_manager.clone()).flatten()
}

/// Resolve decrypted credentials for a tool provider by its ID.
/// Returns `None` if provider not found or has no credentials.
pub async fn resolve_provider_credentials(provider_id: &str) -> Option<String> {
    let db = get_db_manager()?;
    let providers = db.list_tool_providers().await.ok()?;
    let provider = providers.iter().find(|p| p.id == provider_id)?;
    provider.credentials.clone()
}

/// Emit an informational log message (stderr, for internal sandbox status logs).
pub fn emit_info(msg: &str) {
    eprintln!("[flock-tools] {}", msg);
}

/// Returns the current thread/task-local workspace directory.
pub fn get_workspace_dir() -> Option<std::path::PathBuf> {
    try_with_active_context(|ctx| ctx.workspace_dir.clone())
}

/// Get the global protocol emitter if initialized (now fetched from task-local).
pub fn get_global_emitter() -> Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>> {
    try_with_active_context(|ctx| ctx.protocol_emitter.clone()).flatten()
}

/// Get the global approval manager if initialized (now fetched from task-local).
pub fn get_global_approval_manager() -> Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>> {
    try_with_active_context(|ctx| ctx.approval_manager.clone()).flatten()
}

#[derive(serde::Deserialize)]
struct YamlProviderInfo {
    identity: YamlProviderIdentity,
    #[serde(default)]
    credentials_schema: Option<serde_json::Value>,
    #[serde(default)]
    test_input: Option<serde_json::Value>,
    #[serde(default)]
    tools: Option<serde_json::Value>,
}

#[derive(serde::Deserialize)]
struct YamlProviderIdentity {
    id: String,
    name: flock_core::types::tool::I18nString,
    description: flock_core::types::tool::I18nString,
    icon: Option<String>,
}

pub fn parse_provider_info_from_yaml(yaml_str: &str, icon_svg: Option<&str>) -> flock_core::types::tool::ProviderInfo {
    let parsed: YamlProviderInfo = serde_yaml::from_str(yaml_str)
        .unwrap_or_else(|e| panic!("Failed to parse provider YAML. Error: {}\nYAML:\n{}", e, yaml_str));

    let icon = icon_svg.map(|svg| {
        use base64::{engine::general_purpose, Engine as _};
        format!("data:image/svg+xml;base64,{}", general_purpose::STANDARD.encode(svg))
    }).or(parsed.identity.icon);

    flock_core::types::tool::ProviderInfo {
        provider_id: parsed.identity.id,
        provider_name: parsed.identity.name,
        description: parsed.identity.description,
        icon,
        credentials_schema: parsed.credentials_schema,
        test_input: parsed.test_input,
        tools: parsed.tools,
    }
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
    async fn execute(&self, input: Value, ctx: &ToolContext) -> ToolResult;

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

