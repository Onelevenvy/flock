use std::collections::HashMap;
use std::sync::Arc;

use crate::config::compat::ProviderCompat;
use crate::config::compression::CompressionConfig;
use crate::config::debug::DebugConfig;
use crate::config::file_cache::FileCacheConfig;
use crate::config::hooks::HooksConfig;
use crate::config::plan::PlanConfig;
use crate::db::DbManager;
use crate::config::settings::types::{
    Config, ProviderType, ProviderConfig, BedrockConfig, VertexConfig, McpConfig,
    DefaultConfig, ToolsConfig, SessionConfig, SandboxConfig,
};
use crate::config::settings::cli::{CliArgs, resolve_api_key};

#[derive(Debug, Clone)]
pub struct ResolvedProviderConfig {
    pub requested_name: String,
    pub provider_type: ProviderType,
    pub effective_config: ProviderConfig,
}

impl Config {
    /// Resolve config with database support (creates its own DbManager).
    pub async fn resolve_with_db(cli: &CliArgs) -> anyhow::Result<Self> {
        let db = DbManager::init().await?;
        Self::resolve_from_db(cli, Arc::new(db)).await
    }

    /// Resolve config using an existing DbManager (for Tauri managed state).
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
        let session = SessionConfig::default();
        let compact: CompressionConfig = db.get_config("compact").await.unwrap_or_default();
        let plan: PlanConfig = db.get_config("plan").await.unwrap_or_default();
        let file_cache: FileCacheConfig = db.get_config("file_cache").await.unwrap_or_default();
        let hooks: HooksConfig = db.get_config("hooks").await.unwrap_or_default();
        let mcp: McpConfig = db.load_mcp_servers_as_config().await.unwrap_or_default();
        let debug = DebugConfig::default();
        let bedrock: Option<BedrockConfig> = db.get_config("bedrock").await;
        let vertex: Option<VertexConfig> = db.get_config("vertex").await;
        let mut sandbox: SandboxConfig = db.get_config("sandbox").await.unwrap_or_default();
        if let (Some(ct), Some(n)) = (&sandbox.api_key_encrypted, &sandbox.api_key_nonce) {
            if let Ok(salt) = db.get_or_create_salt().await {
                if let Ok(decrypted) = crate::crypto::decrypt_value(ct, n, &salt) {
                    sandbox.api_key = Some(decrypted);
                }
            }
        }

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
            sandbox,
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

async fn resolve_db_api_key(
    db: &DbManager,
    cli: &CliArgs,
    provider_config: &ProviderConfig,
    provider: ProviderType,
    provider_label: &str,
    model_meta_api_key: Option<String>,
) -> anyhow::Result<String> {
    if let Some(key) = &cli.api_key {
        if !key.is_empty() {
            return Ok(key.clone());
        }
    }

    if let Some(key) = model_meta_api_key {
        if !key.is_empty() {
            return Ok(key);
        }
    }

    if let Ok(Some(prov)) = db.get_provider(provider_label).await {
        if let Some(key) = prov.api_key {
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }

    if provider_label != &provider.to_string() {
        if let Ok(Some(prov)) = db.get_provider(&provider.to_string()).await {
            if let Some(key) = prov.api_key {
                if !key.is_empty() {
                    return Ok(key);
                }
            }
        }
    }

    resolve_api_key(
        cli.api_key.as_deref(),
        provider_config.api_key.as_deref(),
        provider,
    )
}

async fn seed_default_config(db: &DbManager) -> anyhow::Result<()> {
    db.set_config("default", &DefaultConfig::default()).await?;
    db.set_config("tools", &ToolsConfig::default()).await?;
    db.set_config("compact", &CompressionConfig::default()).await?;
    db.set_config("plan", &PlanConfig::default()).await?;
    db.set_config("file_cache", &FileCacheConfig::default()).await?;
    db.set_config("hooks", &HooksConfig::default()).await?;
    db.set_config("sandbox", &SandboxConfig::default()).await?;
    Ok(())
}

async fn build_providers_from_db(
    db: &DbManager,
) -> anyhow::Result<HashMap<String, ProviderConfig>> {
    let providers = db.list_providers().await?;
    let mut map = HashMap::new();

    for p in providers {
        let provider_type_str = if p.provider_type == p.id {
            None
        } else {
            Some(p.provider_type.clone())
        };

        map.insert(
            p.id.clone(),
            ProviderConfig {
                provider: provider_type_str,
                model: None,
                api_key: p.api_key,
                base_url: p.base_url,
                prompt_caching: None,
                compat: None,
            },
        );
    }

    map.insert(
        "anthropic".to_string(),
        ProviderConfig {
            provider: None,
            model: None,
            api_key: None,
            base_url: None,
            prompt_caching: None,
            compat: None,
        },
    );
    map.insert(
        "openai".to_string(),
        ProviderConfig {
            provider: None,
            model: None,
            api_key: None,
            base_url: None,
            prompt_caching: None,
            compat: None,
        },
    );

    Ok(map)
}
