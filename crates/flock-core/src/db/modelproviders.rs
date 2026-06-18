use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::crypto;
use crate::types::tool::I18nString;

/// Model provider stored in the `model_provider` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProvider {
    pub id: String,
    pub provider_name: I18nString,
    pub provider_type: String,
    pub base_url: Option<String>,
    /// Decrypted api_key (not stored directly; encrypted form is in DB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub icon: Option<String>,
    pub description: Option<I18nString>,
    pub test_model: Option<String>,
    pub is_available: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Model stored in the `model` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub provider_id: String,
    pub model_name: String,
    pub categories: Vec<String>,
    pub capabilities: Vec<String>,
    pub is_online: bool,
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

/// Helper: decrypt api_key from a row's encrypted columns.
pub(super) fn decrypt_api_key_from_row(row: &sqlx::sqlite::SqliteRow, salt: &[u8]) -> Option<String> {
    let enc: Option<String> = row.try_get("api_key_encrypted").ok()?;
    let nonce: Option<String> = row.try_get("api_key_nonce").ok()?;
    match (enc, nonce) {
        (Some(ct), Some(n)) => crypto::decrypt_value(&ct, &n, salt).ok(),
        _ => None,
    }
}

/// Helper: parse a JSON array column into Vec<String>.
pub(super) fn parse_json_array(val: Option<String>) -> Vec<String> {
    val.and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

impl super::DbManager {
    /// Seed built-in providers and models. Now supports syncing existing data
    /// while preserving user-set API keys and availability status.
    pub(super) async fn seed_builtin_providers(&self) -> anyhow::Result<()> {
        let builtin = super::modelprovider_seed::builtin_providers();

        for (provider, models) in builtin {
            // 1. Upsert Provider
            // We do NOT update api_key fields here to preserve user-entered keys.
            // We also DO NOT update is_available here (unless we want to force reset,
            // but usually we want to keep user activation status).
            let provider_name_json = serde_json::to_string(&provider.provider_name)?;
            let description_json = provider.description.as_ref()
                .map(|d| serde_json::to_string(d))
                .transpose()?;

            sqlx::query(
                "INSERT INTO model_provider
                    (id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                     icon, description, test_model, is_available, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                    provider_name = EXCLUDED.provider_name,
                    provider_type = EXCLUDED.provider_type,
                    base_url = EXCLUDED.base_url,
                    icon = EXCLUDED.icon,
                    description = EXCLUDED.description,
                    test_model = EXCLUDED.test_model,
                    updated_at = datetime('now')"
            )
                .bind(&provider.id)
                .bind(&provider_name_json)
                .bind(&provider.provider_type)
                .bind(&provider.base_url)
                .bind(&provider.icon)
                .bind(&description_json)
                .bind(&provider.test_model)
                .bind(provider.is_available as i64)
                .execute(self.pool())
                .await?;

            // 2. Sync Models
            let mut current_model_ids = Vec::new();
            for ms in models {
                current_model_ids.push(ms.id.to_string());
                let categories = serde_json::to_string(&ms.categories)?;
                let capabilities = serde_json::to_string(&ms.capabilities)?;

                sqlx::query(
                    "INSERT INTO model
                        (id, provider_id, model_name, categories, capabilities, is_online,
                         created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, datetime('now'), datetime('now'))
                     ON CONFLICT(id) DO UPDATE SET
                        model_name = EXCLUDED.model_name,
                        categories = EXCLUDED.categories,
                        capabilities = EXCLUDED.capabilities,
                        updated_at = datetime('now')"
                )
                    .bind(&ms.id)
                    .bind(&provider.id)
                    .bind(&ms.model_name)
                    .bind(&categories)
                    .bind(&capabilities)
                    .execute(self.pool())
                    .await?;
            }

            // 3. Remove models for this provider that are no longer in the seed list
            if !current_model_ids.is_empty() {
                let placeholders: String = current_model_ids.iter()
                    .enumerate()
                    .map(|(i, _)| format!("?{}", i + 2))
                    .collect::<Vec<_>>()
                    .join(",");

                let query_str = format!(
                    "DELETE FROM model WHERE provider_id = ?1 AND id NOT IN ({})",
                    placeholders
                );

                let mut q = sqlx::query(&query_str).bind(&provider.id);
                for mid in current_model_ids {
                    q = q.bind(mid);
                }
                q.execute(self.pool()).await?;
            }
        }

        Ok(())
    }

    pub async fn list_providers(&self) -> anyhow::Result<Vec<ModelProvider>> {
        let rows = sqlx::query(
            "SELECT id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                    icon, description, test_model, is_available, created_at, updated_at
             FROM model_provider ORDER BY provider_name",
        )
            .fetch_all(self.pool())
            .await?;

        let salt = self.salt();

        let mut providers = Vec::new();
        for r in rows {
            let api_key = decrypt_api_key_from_row(&r, &salt);
            let provider_name_str: String = r.get("provider_name");
            let provider_name: I18nString = serde_json::from_str(&provider_name_str)
                .unwrap_or_else(|_| I18nString::single(provider_name_str));

            let description_str: Option<String> = r.try_get("description").ok();
            let description = description_str.and_then(|s| {
                serde_json::from_str(&s).ok().or_else(|| Some(I18nString::single(s)))
            });

            providers.push(ModelProvider {
                id: r.get("id"),
                provider_name,
                provider_type: r.get("provider_type"),
                base_url: r.try_get("base_url").ok(),
                api_key,
                icon: r.try_get("icon").ok(),
                description,
                test_model: r.try_get("test_model").ok(),
                is_available: r.get::<i64, _>("is_available") != 0,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }
        Ok(providers)
    }

    pub async fn get_provider(&self, id: &str) -> anyhow::Result<Option<ModelProvider>> {
        let r = sqlx::query(
            "SELECT id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                    icon, description, test_model, is_available, created_at, updated_at
             FROM model_provider WHERE id = ?1",
        )
            .bind(id)
            .fetch_optional(self.pool())
            .await?;

        let Some(r) = r else { return Ok(None) };
        let salt = self.salt();
        let api_key = decrypt_api_key_from_row(&r, &salt);

        let provider_name_str: String = r.get("provider_name");
        let provider_name: I18nString = serde_json::from_str(&provider_name_str)
            .unwrap_or_else(|_| I18nString::single(provider_name_str));

        let description_str: Option<String> = r.try_get("description").ok();
        let description = description_str.and_then(|s| {
            serde_json::from_str(&s).ok().or_else(|| Some(I18nString::single(s)))
        });

        Ok(Some(ModelProvider {
            id: r.get("id"),
            provider_name,
            provider_type: r.get("provider_type"),
            base_url: r.try_get("base_url").ok(),
            api_key,
            icon: r.try_get("icon").ok(),
            description,
            test_model: r.try_get("test_model").ok(),
            is_available: r.get::<i64, _>("is_available") != 0,
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    pub async fn upsert_provider(&self, provider: &ModelProvider) -> anyhow::Result<()> {
        let salt = self.salt();

        let (enc_key, nonce) = if let Some(ref key) = provider.api_key {
            if key.is_empty() {
                (Some("$DELETE$".to_string()), Some("$DELETE$".to_string()))
            } else {
                let (ct, n) = crypto::encrypt_value(key, &salt)?;
                (Some(ct), Some(n))
            }
        } else {
            (None, None)
        };

        let provider_name_json = serde_json::to_string(&provider.provider_name)?;
        let description_json = provider.description.as_ref()
            .map(|d| serde_json::to_string(d))
            .transpose()?;

        sqlx::query(
            "INSERT INTO model_provider
                (id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                 icon, description, test_model, is_available, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4,
                     CASE WHEN ?5 = '$DELETE$' THEN NULL ELSE ?5 END,
                     CASE WHEN ?6 = '$DELETE$' THEN NULL ELSE ?6 END,
                     ?7, ?8, ?9, ?10, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                provider_name = ?2, provider_type = ?3, base_url = ?4,
                api_key_encrypted = CASE
                    WHEN ?5 = '$DELETE$' THEN NULL
                    WHEN ?5 IS NOT NULL THEN ?5
                    ELSE api_key_encrypted
                END,
                api_key_nonce = CASE
                    WHEN ?6 = '$DELETE$' THEN NULL
                    WHEN ?6 IS NOT NULL THEN ?6
                    ELSE api_key_nonce
                END,
                icon = ?7, description = ?8, test_model = ?9, is_available = ?10,
                updated_at = datetime('now')",
        )
            .bind(&provider.id)
            .bind(&provider_name_json)
            .bind(&provider.provider_type)
            .bind(&provider.base_url)
            .bind(&enc_key)
            .bind(&nonce)
            .bind(&provider.icon)
            .bind(&description_json)
            .bind(&provider.test_model)
            .bind(provider.is_available as i64)
            .execute(self.pool())
            .await?;

        Ok(())
    }

    pub async fn delete_provider(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM model_provider WHERE id = ?1")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

}
