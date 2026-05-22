use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::crypto;
use crate::types::tool::ToolDef;

/// Tool provider stored in the `tool_provider` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProvider {
    pub id: String,
    pub provider_name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    /// Decrypted credentials JSON (not stored directly; encrypted form is in DB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials: Option<String>,
    /// JSON schema describing required credential fields.
    /// If present → provider needs auth; if None → no auth needed.
    pub credentials_schema: Option<String>,
    pub is_available: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Decrypt credentials from a DB row.
pub(super) fn decrypt_credentials_from_row(row: &sqlx::sqlite::SqliteRow, salt: &[u8]) -> Option<String> {
    let enc: Option<String> = row.try_get("credentials_encrypted").ok()?;
    let nonce: Option<String> = row.try_get("credentials_nonce").ok()?;
    match (enc, nonce) {
        (Some(ct), Some(n)) => crypto::decrypt_value(&ct, &n, salt).ok(),
        _ => None,
    }
}

/// Tool stored in the `tool` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub input_schema: String,
    pub provider_id: String,
    pub is_deferred: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&ToolDef> for Tool {
    fn from(def: &ToolDef) -> Self {
        Tool {
            id: format!("tool:{}", def.name.to_lowercase()),
            name: def.name.clone(),
            description: def.description.clone(),
            category: def.category.clone(),
            input_schema: serde_json::to_string(&def.input_schema).unwrap_or_default(),
            provider_id: def.provider_id.clone(),
            is_deferred: def.deferred,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }
}

impl super::DbManager {
    /// Seed tool providers so they appear in the UI even before the agent starts.
    pub async fn seed_tool_providers(&self, provider_infos: &[crate::types::tool::ProviderInfo]) -> anyhow::Result<()> {
        for info in provider_infos {
            let schema_json = info.credentials_schema.as_ref().map(|v| v.to_string());
            // Has schema → needs auth → start unavailable; no schema → auto available.
            let is_available = info.credentials_schema.is_none();
            let provider_name_json = serde_json::to_string(&info.provider_name).unwrap_or_default();
            let description_json = serde_json::to_string(&info.description).unwrap_or_default();
            
            sqlx::query(
                "INSERT INTO tool_provider (id, provider_name, description, credentials_schema, is_available, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                    provider_name = EXCLUDED.provider_name,
                    description = EXCLUDED.description,
                    credentials_schema = COALESCE(EXCLUDED.credentials_schema, credentials_schema),
                    updated_at = datetime('now')"
            )
                .bind(&info.provider_id)
                .bind(&provider_name_json)
                .bind(&description_json)
                .bind(&schema_json)
                .bind(is_available as i64)
                .execute(self.pool())
                .await?;
        }

        Ok(())
    }

    /// Upsert tools into the tool table (dynamically sourced from AgentEngine).
    /// Also ensures each tool's provider exists in the tool_provider table.
    pub async fn upsert_tools(&self, tools: &[crate::types::tool::ToolDef], provider_infos: &[crate::types::tool::ProviderInfo]) -> anyhow::Result<()> {
        // Build a lookup map for provider descriptions.
        let info_map: std::collections::HashMap<&str, &crate::types::tool::ProviderInfo> =
            provider_infos.iter().map(|p| (p.provider_id.as_str(), p)).collect();

        // Collect unique providers and upsert them first.
        let mut seen = std::collections::HashSet::new();
        for def in tools {
            if seen.insert(&def.provider_id) {
                let info = info_map.get(def.provider_id.as_str());
                let provider_name = info
                    .map(|p| serde_json::to_string(&p.provider_name).unwrap_or_default())
                    .unwrap_or_else(|| def.provider_name.clone());
                let desc = info
                    .map(|p| serde_json::to_string(&p.description).unwrap_or_default())
                    .unwrap_or_default();
                let schema_json = info
                    .and_then(|p| p.credentials_schema.as_ref())
                    .map(|v| v.to_string());
                let is_available = info.map(|p| p.credentials_schema.is_none()).unwrap_or(true);
                sqlx::query(
                    "INSERT INTO tool_provider (id, provider_name, description, credentials_schema, is_available, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))
                     ON CONFLICT(id) DO UPDATE SET
                        provider_name = EXCLUDED.provider_name,
                        description = EXCLUDED.description,
                        credentials_schema = COALESCE(EXCLUDED.credentials_schema, credentials_schema),
                        updated_at = datetime('now')"
                )
                    .bind(&def.provider_id)
                    .bind(&provider_name)
                    .bind(&desc)
                    .bind(&schema_json)
                    .bind(is_available as i64)
                    .execute(self.pool())
                    .await?;
            }
        }

        for def in tools {
            let tool = Tool::from(def);
            sqlx::query(
                "INSERT INTO tool
                    (id, name, description, category, input_schema, provider_id, is_deferred, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    input_schema = EXCLUDED.input_schema,
                    provider_id = EXCLUDED.provider_id,
                    is_deferred = EXCLUDED.is_deferred,
                    updated_at = datetime('now')"
            )
                .bind(&tool.id)
                .bind(&tool.name)
                .bind(&tool.description)
                .bind(&tool.category)
                .bind(&tool.input_schema)
                .bind(&tool.provider_id)
                .bind(tool.is_deferred as i64)
                .execute(self.pool())
                .await?;
        }
        Ok(())
    }

    pub async fn list_tool_providers(&self) -> anyhow::Result<Vec<ToolProvider>> {
        let rows = sqlx::query(
            "SELECT id, provider_name, description, icon, credentials_encrypted, credentials_nonce,
                    credentials_schema, is_available, created_at, updated_at
             FROM tool_provider ORDER BY provider_name",
        )
            .fetch_all(self.pool())
            .await?;

        let salt = self.get_or_create_salt().await?;

        let mut providers = Vec::new();
        for r in rows {
            let credentials = decrypt_credentials_from_row(&r, &salt);
            providers.push(ToolProvider {
                id: r.get("id"),
                provider_name: r.get("provider_name"),
                description: r.try_get("description").ok(),
                icon: r.try_get("icon").ok(),
                credentials,
                credentials_schema: r.try_get("credentials_schema").ok(),
                is_available: r.get::<i64, _>("is_available") != 0,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }
        Ok(providers)
    }

    pub async fn list_tools(&self) -> anyhow::Result<Vec<Tool>> {
        let rows = sqlx::query(
            "SELECT id, name, description, category, input_schema, provider_id, is_deferred, created_at, updated_at
             FROM tool ORDER BY name",
        )
            .fetch_all(self.pool())
            .await?;

        let mut tools = Vec::new();
        for r in rows {
            tools.push(Tool {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                category: r.get("category"),
                input_schema: r.get("input_schema"),
                provider_id: r.get("provider_id"),
                is_deferred: r.get::<i64, _>("is_deferred") != 0,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }
        Ok(tools)
    }

    /// Update encrypted credentials for a tool provider.
    pub async fn update_tool_provider_credentials(
        &self,
        provider_id: &str,
        credentials_json: &str,
    ) -> anyhow::Result<()> {
        let salt = self.get_or_create_salt().await?;
        let (enc, nonce) = if credentials_json.is_empty() {
            (None, None)
        } else {
            let (ct, n) = crate::crypto::encrypt_value(credentials_json, &salt)?;
            (Some(ct), Some(n))
        };

        sqlx::query(
            "UPDATE tool_provider SET
                credentials_encrypted = ?2,
                credentials_nonce = ?3,
                updated_at = datetime('now')
             WHERE id = ?1",
        )
            .bind(provider_id)
            .bind(&enc)
            .bind(&nonce)
            .execute(self.pool())
            .await?;

        Ok(())
    }

    /// Update the availability status of a tool provider.
    pub async fn set_tool_provider_available(
        &self,
        provider_id: &str,
        is_available: bool,
    ) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE tool_provider SET is_available = ?2, updated_at = datetime('now') WHERE id = ?1",
        )
            .bind(provider_id)
            .bind(is_available as i64)
            .execute(self.pool())
            .await?;
        Ok(())
    }
}

