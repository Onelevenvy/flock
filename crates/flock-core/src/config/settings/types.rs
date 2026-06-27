use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

use crate::config::compat::ProviderCompat;
use crate::config::compression::CompressionConfig;
use crate::config::debug::DebugConfig;
use crate::config::file_cache::FileCacheConfig;
use crate::config::hooks::HooksConfig;
use crate::config::plan::PlanConfig;
use crate::db::DbManager;
use crate::types::llm::ThinkingConfig;

/// AWS Bedrock credentials configuration
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct BedrockConfig {
    pub region: Option<String>,
    pub access_key_id: Option<String>,
    pub secret_access_key: Option<String>,
    pub session_token: Option<String>,
    pub profile: Option<String>,
}

/// Google Vertex AI authentication configuration
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct VertexConfig {
    pub project_id: Option<String>,
    pub region: Option<String>,
    pub credentials_file: Option<String>,
    pub service_account_json: Option<String>,
}

/// Transport type for MCP server connections
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum TransportType {
    #[default]
    Stdio,
    Sse,
    StreamableHttp,
}

/// A single MCP server configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct McpServerConfig {
    pub transport: TransportType,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub deferred: Option<bool>,
}

/// Collection of MCP server configurations
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct McpConfig {
    #[serde(default)]
    pub servers: HashMap<String, McpServerConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DefaultConfig {
    #[serde(default = "default_provider")]
    pub provider: String,
    pub model: Option<String>,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default)]
    pub max_turns: Option<usize>,
    pub system_prompt: Option<String>,
}

impl Default for DefaultConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            model: None,
            max_tokens: default_max_tokens(),
            max_turns: None,
            system_prompt: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProviderConfig {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub prompt_caching: Option<bool>,
    pub compat: Option<ProviderCompat>,
}

/// Per-skill deny/allow rule lists.
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct SkillsPermissionConfig {
    #[serde(default)]
    pub deny: Vec<String>,
    #[serde(default)]
    pub allow: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ToolsConfig {
    #[serde(default)]
    pub auto_approve: bool,
    #[serde(default = "default_allow_list")]
    pub allow_list: Vec<String>,
    #[serde(default)]
    pub skills: SkillsPermissionConfig,
}

impl Default for ToolsConfig {
    fn default() -> Self {
        Self {
            auto_approve: false,
            allow_list: default_allow_list(),
            skills: SkillsPermissionConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SessionConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_session_dir")]
    pub directory: String,
    #[serde(default = "default_max_sessions")]
    pub max_sessions: usize,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            enabled: default_true(),
            directory: default_session_dir(),
            max_sessions: default_max_sessions(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct SandboxConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_sandbox_provider")]
    pub provider: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub api_key_encrypted: Option<String>,
    pub api_key_nonce: Option<String>,
    pub e2b_api_key: Option<String>,
    pub e2b_api_key_encrypted: Option<String>,
    pub e2b_api_key_nonce: Option<String>,
    pub e2b_api_url: Option<String>,
    pub snapshot: Option<String>,
}

pub fn default_sandbox_provider() -> Option<String> {
    Some("e2b".to_string())
}


// --- Default value functions ---
pub fn default_provider() -> String {
    "anthropic".to_string()
}
pub fn default_max_tokens() -> u32 {
    8192
}
pub fn default_allow_list() -> Vec<String> {
    vec!["Read".into(), "Grep".into(), "Glob".into()]
}
pub fn default_true() -> bool {
    true
}
pub fn default_session_dir() -> String {
    ".flock/sessions".to_string()
}
pub fn default_max_sessions() -> usize {
    20
}

// --- Resolved runtime config ---
pub struct Config {
    pub provider_label: String,
    pub provider: ProviderType,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub max_turns: Option<usize>,
    pub system_prompt: Option<String>,
    pub thinking: Option<ThinkingConfig>,
    pub prompt_caching: bool,
    pub compat: ProviderCompat,
    pub tools: ToolsConfig,
    pub session: SessionConfig,
    pub compact: CompressionConfig,
    pub plan: PlanConfig,
    pub file_cache: FileCacheConfig,
    pub hooks: HooksConfig,
    pub bedrock: Option<BedrockConfig>,
    pub vertex: Option<VertexConfig>,
    pub mcp: McpConfig,
    pub sandbox: SandboxConfig,
    pub debug: DebugConfig,
    pub db_path: PathBuf,
    pub db_manager: Option<Arc<DbManager>>,
    pub dynamic_context_reminder: Option<String>,
}

impl Clone for Config {
    fn clone(&self) -> Self {
        Self {
            provider_label: self.provider_label.clone(),
            provider: self.provider,
            api_key: self.api_key.clone(),
            base_url: self.base_url.clone(),
            model: self.model.clone(),
            max_tokens: self.max_tokens,
            max_turns: self.max_turns,
            system_prompt: self.system_prompt.clone(),
            thinking: self.thinking.clone(),
            prompt_caching: self.prompt_caching,
            compat: self.compat.clone(),
            tools: self.tools.clone(),
            session: self.session.clone(),
            compact: self.compact.clone(),
            plan: self.plan.clone(),
            file_cache: self.file_cache.clone(),
            hooks: self.hooks.clone(),
            bedrock: self.bedrock.clone(),
            vertex: self.vertex.clone(),
            mcp: self.mcp.clone(),
            sandbox: self.sandbox.clone(),
            debug: self.debug.clone(),
            db_path: self.db_path.clone(),
            db_manager: self.db_manager.clone(),
            dynamic_context_reminder: self.dynamic_context_reminder.clone(),
        }
    }
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("provider_label", &self.provider_label)
            .field("provider", &self.provider)
            .field("model", &self.model)
            .field("db_path", &self.db_path)
            .field("has_db_manager", &self.db_manager.is_some())
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderType {
    Anthropic,
    OpenAI,
    Bedrock,
    Vertex,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::Anthropic => write!(f, "anthropic"),
            ProviderType::OpenAI => write!(f, "openai"),
            ProviderType::Bedrock => write!(f, "bedrock"),
            ProviderType::Vertex => write!(f, "vertex"),
        }
    }
}
