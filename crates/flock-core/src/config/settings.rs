use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::config::auth::{AuthConfig, OAuthManager};
use crate::config::compat::ProviderCompat;
use crate::config::compression::CompressionConfig;
use crate::config::debug::DebugConfig;
use crate::config::file_cache::FileCacheConfig;
use crate::config::hooks::HooksConfig;
use crate::config::plan::PlanConfig;
use crate::db::DbManager;
use crate::types::llm::ThinkingConfig;

// ---------------------------------------------------------------------------
// Provider-specific sub-configurations (defined here to avoid circular deps)
// ---------------------------------------------------------------------------

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
    /// For stdio transport: the command to run
    pub command: Option<String>,
    /// For stdio transport: arguments to the command
    pub args: Option<Vec<String>>,
    /// Environment variables to set for this server (stdio)
    pub env: Option<HashMap<String, String>>,
    /// For SSE/HTTP transport: the URL
    pub url: Option<String>,
    /// HTTP headers for SSE/HTTP transports
    pub headers: Option<HashMap<String, String>>,
    /// Whether tools from this server should be deferred (name-only stub sent to LLM).
    /// Defaults to true when omitted — MCP tools are deferred by default to reduce
    /// input token usage. Set to `false` to send full schemas eagerly.
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
    /// Underlying built-in provider type for a custom provider alias.
    pub provider: Option<String>,
    /// Optional default model for this provider entry.
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    /// Enable prompt caching (Anthropic only, default: true)
    pub prompt_caching: Option<bool>,
    /// Provider compatibility overrides
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
    /// Skill-level deny/allow rules. Merged by concatenation across global + project configs.
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

// --- Default value functions ---

fn default_provider() -> String {
    "anthropic".to_string()
}
fn default_max_tokens() -> u32 {
    8192
}
fn default_allow_list() -> Vec<String> {
    vec!["Read".into(), "Grep".into(), "Glob".into()]
}
fn default_true() -> bool {
    true
}
fn default_session_dir() -> String {
    ".flock/sessions".to_string()
}
fn default_max_sessions() -> usize {
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
    pub debug: DebugConfig,
    pub db_path: PathBuf,
    pub db_manager: Option<Arc<DbManager>>,
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
            debug: self.debug.clone(),
            db_path: self.db_path.clone(),
            db_manager: self.db_manager.clone(),
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

#[derive(Debug, Clone)]
struct ResolvedProviderConfig {
    requested_name: String,
    provider_type: ProviderType,
    effective_config: ProviderConfig,
}

/// CLI arguments needed for config resolution
pub struct CliArgs {
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
    pub max_turns: Option<usize>,
    pub system_prompt: Option<String>,
    pub auto_approve: bool,
    pub project_dir: Option<PathBuf>,
}

impl Config {
    /// Resolve config with database support (creates its own DbManager).
    ///
    /// First run: seeds hardcoded defaults to DB.
    /// Subsequent: loads from DB only.
    pub async fn resolve_with_db(cli: &CliArgs) -> anyhow::Result<Self> {
        let db = DbManager::init().await?;
        Self::resolve_from_db(cli, Arc::new(db)).await
    }

    /// Resolve config using an existing DbManager (for Tauri managed state).
    ///
    /// This is the single entry point for all config resolution.
    /// - First run: seeds hardcoded defaults into DB
    /// - Subsequent: loads everything from DB
    /// - `active_model` in app_config overrides default model/provider
    /// - Providers come from `model_provider` table (encrypted keys)
    pub async fn resolve_from_db(
        cli: &CliArgs,
        db: Arc<DbManager>,
    ) -> anyhow::Result<Self> {
        let db_path = db.db_path().to_path_buf();

        // Check if DB already has config (not first run)
        let existing_default: Option<DefaultConfig> = db.get_config("default").await;

        if existing_default.is_none() {
            // First run: seed hardcoded defaults into DB
            seed_default_config(&db).await?;
        }

        // Load all config sections from DB
        let default_cfg: DefaultConfig = db.get_config("default").await.unwrap_or_default();
        let tools: ToolsConfig = db.get_config("tools").await.unwrap_or_default();
        let session: SessionConfig = db.get_config("session").await.unwrap_or_default();
        let compact: CompressionConfig = db.get_config("compact").await.unwrap_or_default();
        let plan: PlanConfig = db.get_config("plan").await.unwrap_or_default();
        let file_cache: FileCacheConfig = db.get_config("file_cache").await.unwrap_or_default();
        let hooks: HooksConfig = db.get_config("hooks").await.unwrap_or_default();
        let mcp: McpConfig = db.load_mcp_servers_as_config().await.unwrap_or_default();
        let debug: DebugConfig = db.get_config("debug").await.unwrap_or_default();
        let bedrock: Option<BedrockConfig> = db.get_config("bedrock").await;
        let vertex: Option<VertexConfig> = db.get_config("vertex").await;

        // Check active_model (set by UI) to override default provider/model
        let active_model: Option<serde_json::Value> = db.get_config("active_model").await;
        let (active_provider, active_model_name) = if let Some(am) = active_model {
            let p = am.get("provider_id").and_then(|v| v.as_str()).map(|s| s.to_string());
            let m = am.get("model_name").and_then(|v| v.as_str()).map(|s| s.to_string());
            (p, m)
        } else {
            (None, None)
        };

        // Determine provider: CLI > active_model > default
        let provider_str = cli.provider.as_deref()
            .or(active_provider.as_deref())
            .unwrap_or(&default_cfg.provider);

        // Build providers HashMap from model_provider table (with decrypted keys)
        let providers = build_providers_from_db(&db).await?;

        let resolved_provider = resolve_provider_alias(&providers, provider_str)?;
        let provider_label = resolved_provider.requested_name.clone();
        let provider = resolved_provider.provider_type;
        let provider_config = resolved_provider.effective_config;

        // Fetch model meta if an active model is set
        let mut model_meta_base_url = None;
        let mut model_meta_api_key = None;
        if let Some(m_name) = &active_model_name {
            if let Ok(Some(m)) = db.get_model(&provider_label, m_name).await {
                if let Some(meta) = m.meta {
                    if let Some(bu) = meta.get("base_url").and_then(|v| v.as_str()) {
                        model_meta_base_url = Some(bu.to_string());
                    }
                    if let Some(enc) = meta.get("api_key_encrypted").and_then(|v| v.as_str()) {
                        if let Some(nonce) = meta.get("api_key_nonce").and_then(|v| v.as_str()) {
                            // Decrypt it
                            if let Ok(salt) = db.get_or_create_salt().await {
                                if let Ok(decrypted) = crate::crypto::decrypt_value(enc, nonce, &salt) {
                                    model_meta_api_key = Some(decrypted);
                                }
                            }
                        }
                    }
                }
            }
        }

        let base_url = cli
            .base_url
            .clone()
            .or(model_meta_base_url)
            .or_else(|| provider_config.base_url.clone())
            .unwrap_or_else(|| match provider {
                ProviderType::Anthropic => "https://api.anthropic.com".into(),
                ProviderType::OpenAI => "https://api.openai.com".into(),
                ProviderType::Bedrock | ProviderType::Vertex => String::new(),
            });

        // Determine model: CLI > active_model > provider config > default
        let model = cli
            .model
            .clone()
            .or(active_model_name.clone())
            .or(provider_config.model.clone())
            .or(default_cfg.model.clone())
            .unwrap_or_else(|| match provider {
                ProviderType::Anthropic => "claude-sonnet-4-20250514".into(),
                ProviderType::OpenAI => "gpt-4o".into(),
                ProviderType::Bedrock => "anthropic.claude-sonnet-4-20250514-v1:0".into(),
                ProviderType::Vertex => "claude-sonnet-4@20250514".into(),
            });

        let max_tokens = cli.max_tokens.unwrap_or(default_cfg.max_tokens);
        let max_turns = cli.max_turns.or(default_cfg.max_turns);
        let system_prompt = cli
            .system_prompt
            .clone()
            .or(default_cfg.system_prompt.clone());

        let api_key = resolve_db_api_key(&db, cli, &provider_config, provider, &provider_label, model_meta_api_key).await?;

        let mut tools = tools;
        if cli.auto_approve {
            tools.auto_approve = true;
        }

        let prompt_caching = provider_config
            .prompt_caching
            .unwrap_or(matches!(provider, ProviderType::Anthropic));

        let compat_defaults = match provider {
            ProviderType::Anthropic => ProviderCompat::anthropic_defaults(),
            ProviderType::OpenAI => ProviderCompat::openai_defaults(),
            ProviderType::Bedrock => ProviderCompat::bedrock_defaults(),
            ProviderType::Vertex => ProviderCompat::anthropic_defaults(),
        };
        let user_compat = provider_config.compat.clone().unwrap_or_default();
        let compat = ProviderCompat::merge(compat_defaults, user_compat);

        Ok(Config {
            provider_label,
            provider,
            api_key,
            base_url,
            model,
            max_tokens,
            max_turns,
            system_prompt,
            thinking: None,
            prompt_caching,
            compat,
            tools,
            session,
            compact,
            plan,
            file_cache,
            hooks,
            bedrock,
            vertex,
            mcp,
            debug,
            db_path,
            db_manager: Some(db),
        })
    }
}

fn parse_builtin_provider(s: &str) -> Option<ProviderType> {
    match s {
        "anthropic" => Some(ProviderType::Anthropic),
        "openai" => Some(ProviderType::OpenAI),
        "bedrock" => Some(ProviderType::Bedrock),
        "vertex" => Some(ProviderType::Vertex),
        _ => None,
    }
}

fn merge_provider_configs(base: ProviderConfig, overlay: ProviderConfig) -> ProviderConfig {
    ProviderConfig {
        provider: overlay.provider.or(base.provider),
        model: overlay.model.or(base.model),
        api_key: overlay.api_key.or(base.api_key),
        base_url: overlay.base_url.or(base.base_url),
        prompt_caching: overlay.prompt_caching.or(base.prompt_caching),
        compat: match (base.compat, overlay.compat) {
            (Some(base), Some(overlay)) => Some(ProviderCompat::merge(base, overlay)),
            (Some(base), None) => Some(base),
            (None, Some(overlay)) => Some(overlay),
            (None, None) => None,
        },
    }
}

fn resolve_provider_alias(
    providers: &HashMap<String, ProviderConfig>,
    requested: &str,
) -> anyhow::Result<ResolvedProviderConfig> {
    if let Some(provider_type) = parse_builtin_provider(requested) {
        return Ok(ResolvedProviderConfig {
            requested_name: requested.to_string(),
            provider_type,
            effective_config: providers.get(requested).cloned().unwrap_or_default(),
        });
    }

    let alias_config = providers.get(requested).cloned().ok_or_else(|| {
        anyhow::anyhow!(
            "Unknown provider: '{}'. Expected a built-in provider (anthropic, openai, bedrock, vertex) \
             or a custom alias defined in [providers.{}].",
            requested,
            requested
        )
    })?;

    let underlying = alias_config.provider.clone().ok_or_else(|| {
        anyhow::anyhow!(
            "Provider alias '{}' requires a 'provider' field in [providers.{}] \
             that maps to a built-in type (anthropic, openai, bedrock, vertex).",
            requested,
            requested
        )
    })?;

    let provider_type = parse_builtin_provider(&underlying).ok_or_else(|| {
        anyhow::anyhow!(
            "Provider alias '{}' maps to '{}', which is not a built-in provider. \
             Use one of: anthropic, openai, bedrock, vertex.",
            requested,
            underlying
        )
    })?;

    Ok(ResolvedProviderConfig {
        requested_name: requested.to_string(),
        provider_type,
        effective_config: merge_provider_configs(
            providers.get(&underlying).cloned().unwrap_or_default(),
            alias_config,
        ),
    })
}

fn resolve_api_key(
    cli_key: Option<&str>,
    config_key: Option<&str>,
    provider: ProviderType,
) -> anyhow::Result<String> {
    // CLI arg takes precedence
    if let Some(key) = cli_key {
        return Ok(key.to_string());
    }

    // Config file value
    if let Some(key) = config_key {
        return Ok(key.to_string());
    }

    // Env var fallback chain
    if let Ok(key) = std::env::var("API_KEY") {
        return Ok(key);
    }

    match provider {
        ProviderType::Anthropic => {
            if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
                return Ok(key);
            }
        }
        ProviderType::OpenAI => {
            if let Ok(key) = std::env::var("OPENAI_API_KEY") {
                return Ok(key);
            }
        }
        // Bedrock uses AWS credentials, Vertex uses GCP credentials
        // They don't need a traditional API key
        ProviderType::Bedrock | ProviderType::Vertex => {
            return Ok(String::new());
        }
    }

    // Try OAuth credentials as last resort
    let oauth = OAuthManager::new(AuthConfig::default());
    if oauth.has_credentials() {
        return Ok(String::new()); // Will be resolved at runtime via OAuth
    }

    anyhow::bail!(
        "No API key found. Provide via --api-key, config file, environment variable \
         (API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY), or run 'flock --login'."
    )
}

// --- App directories ---

/// Platform-aware app config root.
///
/// - Linux:   `~/.config/flock`
/// - macOS:   `~/Library/Application Support/flock`
/// - Windows: `%APPDATA%\flock`
pub fn app_config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("flock"))
}

// --- DB-backed config helpers ---

/// Resolve API key with DB as an additional source.
/// Priority: CLI > DB (encrypted) > config file > env var > OAuth
async fn resolve_db_api_key(
    db: &DbManager,
    cli: &CliArgs,
    provider_config: &ProviderConfig,
    provider: ProviderType,
    provider_label: &str,
    model_meta_api_key: Option<String>,
) -> anyhow::Result<String> {
    // CLI arg takes precedence
    if let Some(key) = &cli.api_key {
        if !key.is_empty() {
            return Ok(key.clone());
        }
    }

    // Model-level credentials take next precedence
    if let Some(key) = model_meta_api_key {
        if !key.is_empty() {
            return Ok(key);
        }
    }

    // Try to get from DB: find the provider's encrypted api_key
    // Use provider_label (e.g. "siliconflow") instead of provider type (e.g. "openai")
    if let Ok(Some(prov)) = db.get_provider(provider_label).await {
        if let Some(key) = prov.api_key {
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }

    // Fallback to built-in provider type if label lookup failed
    if provider_label != &provider.to_string() {
        if let Ok(Some(prov)) = db.get_provider(&provider.to_string()).await {
            if let Some(key) = prov.api_key {
                if !key.is_empty() {
                    return Ok(key);
                }
            }
        }
    }

    // Fall through to standard resolution
    resolve_api_key(
        cli.api_key.as_deref(),
        provider_config.api_key.as_deref(),
        provider,
    )
}

/// Seed hardcoded default config sections into DB on first run.
async fn seed_default_config(db: &DbManager) -> anyhow::Result<()> {
    db.set_config("default", &DefaultConfig::default()).await?;
    db.set_config("tools", &ToolsConfig::default()).await?;
    db.set_config("session", &SessionConfig::default()).await?;
    db.set_config("compact", &CompressionConfig::default()).await?;
    db.set_config("plan", &PlanConfig::default()).await?;
    db.set_config("file_cache", &FileCacheConfig::default()).await?;
    db.set_config("hooks", &HooksConfig::default()).await?;
    db.set_config("debug", &DebugConfig::default()).await?;
    Ok(())
}

/// Build a `HashMap<String, ProviderConfig>` from the `model_provider` table.
/// API keys are decrypted by `get_provider()`.
async fn build_providers_from_db(
    db: &DbManager,
) -> anyhow::Result<HashMap<String, ProviderConfig>> {
    let providers = db.list_providers().await?;
    let mut map = HashMap::new();

    for p in providers {
        let provider_type_str = if p.provider_type == p.id {
            // Built-in provider (anthropic, openai, etc.) — no alias needed
            None
        } else {
            // Custom alias — store underlying type in `provider` field
            Some(p.provider_type.clone())
        };

        map.insert(
            p.id.clone(),
            ProviderConfig {
                provider: provider_type_str,
                model: None, // models are resolved separately, not stored in provider config
                api_key: p.api_key,
                base_url: p.base_url,
                prompt_caching: None,
                compat: None,
            },
        );
    }

    Ok(map)
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

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // parse_builtin_provider tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_provider_type_from_str_anthropic() {
        let result = parse_builtin_provider("anthropic");
        assert_eq!(result, Some(ProviderType::Anthropic));
    }

    #[test]
    fn test_provider_type_from_str_openai() {
        let result = parse_builtin_provider("openai");
        assert_eq!(result, Some(ProviderType::OpenAI));
    }

    #[test]
    fn test_provider_type_from_str_bedrock() {
        let result = parse_builtin_provider("bedrock");
        assert_eq!(result, Some(ProviderType::Bedrock));
    }

    #[test]
    fn test_provider_type_from_str_vertex() {
        let result = parse_builtin_provider("vertex");
        assert_eq!(result, Some(ProviderType::Vertex));
    }

    #[test]
    fn test_provider_type_from_str_invalid() {
        let result = parse_builtin_provider("invalid");
        assert_eq!(result, None);
    }

    #[test]
    fn test_provider_alias_resolves_to_builtin_provider() {
        let mut providers = HashMap::new();
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                model: Some("custom-model-v1".to_string()),
                api_key: Some("alias-key".to_string()),
                base_url: Some("https://my-service.example.com/v1".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        assert_eq!(resolved.requested_name, "my-service");
        assert_eq!(resolved.provider_type, ProviderType::OpenAI);
        assert_eq!(
            resolved.effective_config.model.as_deref(),
            Some("custom-model-v1")
        );
        assert_eq!(
            resolved.effective_config.api_key.as_deref(),
            Some("alias-key")
        );
        assert_eq!(
            resolved.effective_config.base_url.as_deref(),
            Some("https://my-service.example.com/v1")
        );
    }

    #[test]
    fn test_provider_alias_overlays_builtin_provider_defaults() {
        let mut providers = HashMap::new();
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                api_key: Some("builtin-key".to_string()),
                model: Some("gpt-4o".to_string()),
                ..Default::default()
            },
        );
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                base_url: Some("https://my-service.example.com/v1".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        assert_eq!(resolved.provider_type, ProviderType::OpenAI);
        assert_eq!(
            resolved.effective_config.api_key.as_deref(),
            Some("builtin-key")
        );
        assert_eq!(resolved.effective_config.model.as_deref(), Some("gpt-4o"));
        assert_eq!(
            resolved.effective_config.base_url.as_deref(),
            Some("https://my-service.example.com/v1")
        );
    }

    #[test]
    fn test_provider_alias_requires_underlying_provider_type() {
        let mut providers = HashMap::new();
        providers.insert("my-service".to_string(), ProviderConfig::default());

        let result = resolve_provider_alias(&providers, "my-service");
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("my-service"));
        assert!(msg.contains("provider"));
        assert!(msg.contains("built-in type"));
    }

    // -------------------------------------------------------------------------
    // resolve_api_key tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_api_key_from_cli_arg() {
        // CLI key takes highest priority regardless of other sources.
        let result =
            resolve_api_key(Some("cli-key"), Some("config-key"), ProviderType::Anthropic).unwrap();
        assert_eq!(result, "cli-key");
    }

    #[test]
    fn test_api_key_from_config() {
        // When CLI key is absent, config file key should be used.
        let result = resolve_api_key(None, Some("config-key"), ProviderType::Anthropic).unwrap();
        assert_eq!(result, "config-key");
    }

    #[test]
    fn test_api_key_missing_returns_error() {
        // Remove all env vars that could supply a key so the function must fail.
        // Note: single-threaded tests share the process environment; clearing here
        // is safe for unit test purposes.
        // SAFETY: single-threaded test context; no other threads read these vars.
        unsafe {
            std::env::remove_var("API_KEY");
            std::env::remove_var("ANTHROPIC_API_KEY");
        }

        // Only fails if OAuth credentials file is also absent, which is true in CI.
        // We accept either an error OR an empty key (Bedrock/Vertex path), but for
        // Anthropic with no key at all the function should return an error.
        let result = resolve_api_key(None, None, ProviderType::Anthropic);

        // The result is either an error (no OAuth file) or Ok (OAuth file found).
        // We can only assert the error path reliably when the OAuth file is absent.
        if let Err(e) = result {
            let msg = e.to_string();
            assert!(msg.contains("No API key found"));
        }
        // If OAuth credentials exist on the test machine, the function returns Ok("").
        // Both outcomes are correct; the important invariant is no panic.
    }

    #[test]
    fn test_api_key_bedrock_returns_empty_without_key() {
        // Bedrock uses AWS credentials, so an empty key is the expected success value.
        let result = resolve_api_key(None, None, ProviderType::Bedrock).unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn test_api_key_vertex_returns_empty_without_key() {
        // Vertex uses GCP credentials, so an empty key is the expected success value.
        let result = resolve_api_key(None, None, ProviderType::Vertex).unwrap();
        assert_eq!(result, "");
    }

    // -------------------------------------------------------------------------
    // merge_provider_configs tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_merge_provider_configs_overlay_overrides_base() {
        let base = ProviderConfig {
            api_key: Some("base-key".to_string()),
            base_url: Some("https://base.example.com".to_string()),
            model: Some("base-model".to_string()),
            ..Default::default()
        };
        let overlay = ProviderConfig {
            api_key: Some("overlay-key".to_string()),
            model: Some("overlay-model".to_string()),
            ..Default::default()
        };

        let merged = merge_provider_configs(base, overlay);
        assert_eq!(merged.api_key.as_deref(), Some("overlay-key"));
        assert_eq!(merged.model.as_deref(), Some("overlay-model"));
        // base_url not in overlay -> preserved from base
        assert_eq!(merged.base_url.as_deref(), Some("https://base.example.com"));
    }

    #[test]
    fn test_merge_provider_configs_overlay_none_preserves_base() {
        let base = ProviderConfig {
            api_key: Some("base-key".to_string()),
            base_url: Some("https://base.example.com".to_string()),
            model: Some("base-model".to_string()),
            prompt_caching: Some(true),
            provider: Some("openai".to_string()),
            ..Default::default()
        };
        let overlay = ProviderConfig::default();

        let merged = merge_provider_configs(base, overlay);
        assert_eq!(merged.api_key.as_deref(), Some("base-key"));
        assert_eq!(merged.base_url.as_deref(), Some("https://base.example.com"));
        assert_eq!(merged.model.as_deref(), Some("base-model"));
        assert_eq!(merged.prompt_caching, Some(true));
        assert_eq!(merged.provider.as_deref(), Some("openai"));
    }

    #[test]
    fn test_merge_provider_configs_compat_merges_both() {
        let base = ProviderConfig {
            compat: Some(ProviderCompat {
                merge_assistant_messages: Some(true),
                clean_orphan_tool_calls: Some(true),
                ..Default::default()
            }),
            ..Default::default()
        };
        let overlay = ProviderConfig {
            compat: Some(ProviderCompat {
                merge_assistant_messages: Some(false), // override base
                dedup_tool_results: Some(true),        // new field
                ..Default::default()
            }),
            ..Default::default()
        };

        let merged = merge_provider_configs(base, overlay);
        let compat = merged.compat.unwrap();
        // overlay wins
        assert_eq!(compat.merge_assistant_messages, Some(false));
        // base preserved
        assert_eq!(compat.clean_orphan_tool_calls, Some(true));
        // overlay adds new
        assert_eq!(compat.dedup_tool_results, Some(true));
    }

    #[test]
    fn test_merge_provider_configs_both_empty() {
        let merged = merge_provider_configs(ProviderConfig::default(), ProviderConfig::default());
        assert!(merged.api_key.is_none());
        assert!(merged.base_url.is_none());
        assert!(merged.model.is_none());
        assert!(merged.provider.is_none());
        assert!(merged.prompt_caching.is_none());
        assert!(merged.compat.is_none());
    }

    // -------------------------------------------------------------------------
    // resolve_provider_alias: builtin name path tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_resolve_builtin_provider_with_config() {
        let mut providers = HashMap::new();
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                api_key: Some("openai-key".to_string()),
                base_url: Some("https://custom-openai.example.com".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "openai").unwrap();
        assert_eq!(resolved.requested_name, "openai");
        assert_eq!(resolved.provider_type, ProviderType::OpenAI);
        assert_eq!(
            resolved.effective_config.api_key.as_deref(),
            Some("openai-key")
        );
        assert_eq!(
            resolved.effective_config.base_url.as_deref(),
            Some("https://custom-openai.example.com")
        );
    }

    #[test]
    fn test_resolve_builtin_provider_without_config_entry() {
        let providers = HashMap::new();

        let resolved = resolve_provider_alias(&providers, "anthropic").unwrap();
        assert_eq!(resolved.requested_name, "anthropic");
        assert_eq!(resolved.provider_type, ProviderType::Anthropic);
        // No config entry -> all fields default to None
        assert!(resolved.effective_config.api_key.is_none());
        assert!(resolved.effective_config.base_url.is_none());
        assert!(resolved.effective_config.model.is_none());
    }

    // -------------------------------------------------------------------------
    // resolve_provider_alias: error path tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_resolve_alias_maps_to_invalid_builtin_type() {
        let mut providers = HashMap::new();
        providers.insert(
            "my-db".to_string(),
            ProviderConfig {
                provider: Some("mysql".to_string()),
                ..Default::default()
            },
        );

        let result = resolve_provider_alias(&providers, "my-db");
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("my-db"));
        assert!(msg.contains("mysql"));
        assert!(msg.contains("not a built-in provider"));
    }

    #[test]
    fn test_resolve_alias_not_found_in_providers() {
        let providers = HashMap::new();

        let result = resolve_provider_alias(&providers, "nonexistent");
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("nonexistent"));
        assert!(msg.contains("built-in provider"));
        assert!(msg.contains("[providers.nonexistent]"));
    }

    // -------------------------------------------------------------------------
    // provider_label (requested_name) tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_provider_label_is_alias_name_not_underlying_type() {
        let mut providers = HashMap::new();
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                api_key: Some("key".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        // provider_label should be the alias name, not "openai"
        assert_eq!(resolved.requested_name, "my-service");
        assert_eq!(resolved.provider_type, ProviderType::OpenAI);
    }

    #[test]
    fn test_provider_label_is_builtin_name_for_builtin() {
        let providers = HashMap::new();

        for (name, expected_type) in [
            ("anthropic", ProviderType::Anthropic),
            ("openai", ProviderType::OpenAI),
            ("bedrock", ProviderType::Bedrock),
            ("vertex", ProviderType::Vertex),
        ] {
            let resolved = resolve_provider_alias(&providers, name).unwrap();
            assert_eq!(resolved.requested_name, name);
            assert_eq!(resolved.provider_type, expected_type);
        }
    }

    // -------------------------------------------------------------------------
    // model priority: alias model in resolution chain
    // -------------------------------------------------------------------------

    #[test]
    fn test_alias_model_available_in_effective_config() {
        // Verifies that alias.model is carried through effective_config,
        // which feeds into the priority chain: CLI > alias.model > default.model > hardcoded
        let mut providers = HashMap::new();
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                model: Some("alias-model-v1".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        assert_eq!(
            resolved.effective_config.model.as_deref(),
            Some("alias-model-v1")
        );
    }

    #[test]
    fn test_alias_model_inherits_from_underlying_provider() {
        // When alias has no model but underlying provider does,
        // the alias should inherit it via merge_provider_configs
        let mut providers = HashMap::new();
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                model: Some("gpt-4o".to_string()),
                ..Default::default()
            },
        );
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                base_url: Some("https://my-service.example.com".to_string()),
                // no model -> should inherit from openai
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        assert_eq!(resolved.effective_config.model.as_deref(), Some("gpt-4o"));
    }

    #[test]
    fn test_alias_model_overrides_underlying_provider_model() {
        // When both alias and underlying provider define model,
        // alias model should win
        let mut providers = HashMap::new();
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                model: Some("gpt-4o".to_string()),
                ..Default::default()
            },
        );
        providers.insert(
            "my-service".to_string(),
            ProviderConfig {
                provider: Some("openai".to_string()),
                model: Some("custom-model-v2".to_string()),
                ..Default::default()
            },
        );

        let resolved = resolve_provider_alias(&providers, "my-service").unwrap();
        assert_eq!(
            resolved.effective_config.model.as_deref(),
            Some("custom-model-v2")
        );
    }
}
