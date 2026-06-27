use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

/// 获取当前启用的沙盒配置。若未启用或未配置，则返回 None。
pub async fn get_sandbox_config(db: &DbManager) -> Option<SandboxConfig> {
    let mut cfg: SandboxConfig = db.get_config("sandbox").await?;
    
    // Decrypt Daytona key
    if let (Some(ct), Some(n)) = (&cfg.api_key_encrypted, &cfg.api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.api_key = Some(decrypted);
            }
        }
    }
    
    // Decrypt E2B key
    if let (Some(ct), Some(n)) = (&cfg.e2b_api_key_encrypted, &cfg.e2b_api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.e2b_api_key = Some(decrypted);
            }
        }
    }

    if !cfg.enabled {
        return None;
    }

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    match provider {
        "e2b" => {
            if cfg.e2b_api_key.is_some() {
                Some(cfg)
            } else {
                None
            }
        }
        "daytona" => {
            if cfg.api_url.is_some() && cfg.api_key.is_some() {
                Some(cfg)
            } else {
                None
            }
        }
        "local" => Some(cfg),
        _ => None,
    }
}

/// 从用户配置的 api_url 中提取 Daytona REST API base URL。
///
/// Daytona 官方云端 (app.daytona.io) 的 API 路径以 `/sandbox`, `/snapshots` 开头，
/// 不含 `/api` 前缀。但用户配置的 api_url 通常是 `https://app.daytona.io/api`，
/// 因此我们需要去掉末尾的 `/api`。
///
/// 对于自建 Daytona 实例，保持 api_url 不变。
pub fn get_api_base(api_url: &str) -> String {
    let trimmed = api_url.trim_end_matches('/');
    if trimmed.ends_with("/api") {
        trimmed[..trimmed.len() - 4].to_string()
    } else {
        trimmed.to_string()
    }
}
