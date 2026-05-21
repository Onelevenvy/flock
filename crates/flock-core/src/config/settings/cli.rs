use std::path::PathBuf;
use crate::config::auth::{AuthConfig, OAuthManager};
use crate::config::settings::types::ProviderType;

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

pub fn resolve_api_key(
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

/// Platform-aware app config root.
///
/// - Linux:   `~/.config/flock`
/// - macOS:   `~/Library/Application Support/flock`
/// - Windows: `%APPDATA%\flock`
pub fn app_config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("flock"))
}
