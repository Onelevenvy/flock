pub mod assistants;
pub mod conversations;
pub mod mcpserver;
pub mod migrations;
pub mod modelproviders;
pub mod modelprovider_seed;
pub mod sessions;
pub mod toolproviders;
pub mod cron;

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{de::DeserializeOwned, Serialize};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;

use crate::config::db_path::resolve_db_path;
use crate::crypto;

use modelproviders::{decrypt_api_key_from_row, parse_json_array};
use toolproviders::decrypt_credentials_from_row;
// Re-export types from providers module for backward compatibility.
pub use modelproviders::{Model, ModelProvider};

// Re-export session types.
pub use sessions::{Session, SessionManager, SessionMeta};

// Re-export conversation types.
pub use conversations::{ChatMessage, ConversationInfo, MessageChunk};

// Re-export tool types.
pub use toolproviders::{Tool, ToolProvider};

// Re-export MCP server types.
pub use mcpserver::McpServer;

// Re-export assistant types.
pub use assistants::{AssistantRecord, UpsertAssistant};

// Re-export cron types.
pub use cron::{CronJobRecord, UpsertCronJob};

/// Database manager: handles migrations, config KV, and provider/model CRUD.
pub struct DbManager {
    pool: SqlitePool,
    db_path: PathBuf,
}

impl DbManager {
    /// Initialize the database: resolve path, create pool, run migrations.
    pub async fn init() -> Result<Self> {
        let db_path = resolve_db_path();
        Self::init_at(db_path).await
    }

    /// Initialize at a specific path (used by tests or explicit overrides).
    pub async fn init_at(db_path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create DB directory: {}", parent.display()))?;
        }

        let conn_str = format!("sqlite:{}?mode=rwc", db_path.display());
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&conn_str)
            .await
            .with_context(|| format!("Failed to open DB at {}", db_path.display()))?;

        // Enable WAL mode for concurrent read/write
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await?;

        let mgr = Self { pool, db_path };
        mgr.run_migrations().await?;
        mgr.seed_builtin_providers().await?;
        mgr.seed_builtin_assistants(&builtin_assistants()).await?;
        mgr.seed_default_app_config().await?;
        Ok(mgr)
    }

    /// Run pending migrations.
    async fn run_migrations(&self) -> Result<()> {
        // Create the flock_migrations tracking table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS flock_migrations (
                version     INTEGER PRIMARY KEY,
                name        TEXT NOT NULL,
                applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
            .execute(&self.pool)
            .await?;

        // Get the current max applied version
        let max_version: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM flock_migrations")
            .fetch_one(&self.pool)
            .await?;

        // Apply pending migrations
        for &(version, name, sql) in migrations::MIGRATIONS {
            if version <= max_version {
                continue;
            }
            sqlx::query(sql)
                .execute(&self.pool)
                .await
                .with_context(|| format!("Migration {} ({}) failed", version, name))?;

            sqlx::query("INSERT INTO flock_migrations (version, name) VALUES (?1, ?2)")
                .bind(version)
                .bind(name)
                .execute(&self.pool)
                .await?;

            log::info!("Applied migration {}: {}", version, name);
        }

        Ok(())
    }

    /// Seed built-in providers and models. Now supports syncing existing data
    /// while preserving user-set API keys and availability status.
    async fn seed_builtin_providers(&self) -> Result<()> {
        let builtin = modelprovider_seed::builtin_providers();

        for (provider, models) in builtin {
            // 1. Upsert Provider
            // We do NOT update api_key fields here to preserve user-entered keys.
            // We also DO NOT update is_available here (unless we want to force reset,
            // but usually we want to keep user activation status).
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
                .bind(&provider.provider_name)
                .bind(&provider.provider_type)
                .bind(&provider.base_url)
                .bind(&provider.icon)
                .bind(&provider.description)
                .bind(&provider.test_model)
                .bind(provider.is_available as i64)
                .execute(&self.pool)
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
                    .bind(ms.id)
                    .bind(&provider.id)
                    .bind(ms.model_name)
                    .bind(&categories)
                    .bind(&capabilities)
                    .execute(&self.pool)
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
                q.execute(&self.pool).await?;
            }
        }

        Ok(())
    }

    /// Seed tool providers so they appear in the UI even before the agent starts.
    pub async fn seed_tool_providers(&self, provider_infos: &[crate::types::tool::ProviderInfo]) -> Result<()> {
        for info in provider_infos {
            let schema_json = info.credentials_schema.as_ref().map(|v| v.to_string());
            // Has schema → needs auth → start unavailable; no schema → auto available.
            let is_available = info.credentials_schema.is_none();
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
                .bind(&info.provider_name)
                .bind(&info.description)
                .bind(&schema_json)
                .bind(is_available as i64)
                .execute(&self.pool)
                .await?;
        }

        Ok(())
    }

    /// Upsert tools into the tool table (dynamically sourced from AgentEngine).
    /// Also ensures each tool's provider exists in the tool_provider table.
    pub async fn upsert_tools(&self, tools: &[crate::types::tool::ToolDef], provider_infos: &[crate::types::tool::ProviderInfo]) -> Result<()> {
        // Build a lookup map for provider descriptions.
        let info_map: std::collections::HashMap<&str, &crate::types::tool::ProviderInfo> =
            provider_infos.iter().map(|p| (p.provider_id.as_str(), p)).collect();

        // Collect unique providers and upsert them first.
        let mut seen = std::collections::HashSet::new();
        for def in tools {
            if seen.insert(&def.provider_id) {
                let info = info_map.get(def.provider_id.as_str());
                let desc = info.map(|p| p.description.as_str()).unwrap_or("");
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
                    .bind(&def.provider_name)
                    .bind(desc)
                    .bind(&schema_json)
                    .bind(is_available as i64)
                    .execute(&self.pool)
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
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    // ---- Tool Provider / Tool queries ----

    pub async fn list_tool_providers(&self) -> Result<Vec<ToolProvider>> {
        let rows = sqlx::query(
            "SELECT id, provider_name, description, icon, credentials_encrypted, credentials_nonce,
                    credentials_schema, is_available, created_at, updated_at
             FROM tool_provider ORDER BY provider_name",
        )
            .fetch_all(&self.pool)
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

    pub async fn list_tools(&self) -> Result<Vec<Tool>> {
        let rows = sqlx::query(
            "SELECT id, name, description, category, input_schema, provider_id, is_deferred, created_at, updated_at
             FROM tool ORDER BY name",
        )
            .fetch_all(&self.pool)
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
    ) -> Result<()> {
        let salt = self.get_or_create_salt().await?;
        let (enc, nonce) = if credentials_json.is_empty() {
            (None, None)
        } else {
            let (ct, n) = crypto::encrypt_value(credentials_json, &salt)?;
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
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Update the availability status of a tool provider.
    pub async fn set_tool_provider_available(
        &self,
        provider_id: &str,
        is_available: bool,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE tool_provider SET is_available = ?2, updated_at = datetime('now') WHERE id = ?1",
        )
            .bind(provider_id)
            .bind(is_available as i64)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ---- Config KV ----

    /// Read a config value by key, deserializing from JSON.
    pub async fn get_config<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let row = sqlx::query("SELECT value FROM app_config WHERE key = ?1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .ok()??;
        let json: String = row.get("value");
        serde_json::from_str(&json).ok()
    }

    /// Write a config value by key, serializing to JSON.
    pub async fn set_config<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let json = serde_json::to_string(value)?;
        sqlx::query(
            "INSERT INTO app_config (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        )
            .bind(key)
            .bind(&json)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Seed default app_config entries on every startup using INSERT OR IGNORE
    /// so that existing user-customized values are never overwritten.
    /// This ensures the UI can always read valid config even on a fresh database.
    async fn seed_default_app_config(&self) -> Result<()> {
        use crate::config::compression::CompressionConfig;
        use crate::config::plan::PlanConfig;
        use crate::config::debug::DebugConfig;
        use crate::config::file_cache::FileCacheConfig;
        use crate::config::hooks::HooksConfig;
        use crate::config::settings::{DefaultConfig, SessionConfig, ToolsConfig};

        let entries: Vec<(&str, String)> = vec![
            ("default", serde_json::to_string(&DefaultConfig::default())?),
            ("tools",   serde_json::to_string(&ToolsConfig::default())?),
            ("compact", serde_json::to_string(&CompressionConfig::default())?),
            ("session", serde_json::to_string(&SessionConfig::default())?),
            ("plan",    serde_json::to_string(&PlanConfig::default())?),
            ("file_cache", serde_json::to_string(&FileCacheConfig::default())?),
            ("hooks",   serde_json::to_string(&HooksConfig::default())?),
            ("debug",   serde_json::to_string(&DebugConfig::default())?),
            ("max_running_sessions", serde_json::to_string(&4)?),
            ("max_cached_sessions", serde_json::to_string(&10)?),
            ("enable_title_summary", serde_json::to_string(&false)?),
        ];

        for (key, json) in entries {
            sqlx::query(
                "INSERT OR IGNORE INTO app_config (key, value, updated_at)
                 VALUES (?1, ?2, datetime('now'))",
            )
            .bind(key)
            .bind(json)
            .execute(&self.pool)
            .await?;
        }

        log::debug!("[db] seed_default_app_config: default keys ensured in app_config");
        Ok(())
    }

    // ---- Encryption Meta ----

    /// Get or create the encryption salt. Returns the salt bytes.
    pub async fn get_or_create_salt(&self) -> Result<Vec<u8>> {
        let row = sqlx::query("SELECT key_salt FROM encryption_meta WHERE id = 1")
            .fetch_optional(&self.pool)
            .await?;

        if let Some(r) = row {
            let salt_b64: String = r.get("key_salt");
            let salt = base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                &salt_b64,
            )
                .context("Invalid salt in DB")?;
            return Ok(salt);
        }

        // Generate new salt
        let salt = crypto::generate_salt()?;
        let salt_b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &salt,
        );

        sqlx::query(
            "INSERT INTO encryption_meta (id, key_salt, key_version) VALUES (1, ?1, 1)
             ON CONFLICT(id) DO UPDATE SET key_salt = ?1",
        )
            .bind(&salt_b64)
            .execute(&self.pool)
            .await?;

        Ok(salt.to_vec())
    }

    // ---- Provider CRUD ----

    pub async fn list_providers(&self) -> Result<Vec<ModelProvider>> {
        let rows = sqlx::query(
            "SELECT id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                    icon, description, test_model, is_available, created_at, updated_at
             FROM model_provider ORDER BY provider_name",
        )
            .fetch_all(&self.pool)
            .await?;

        let salt = self.get_or_create_salt().await?;

        let mut providers = Vec::new();
        for r in rows {
            let api_key = decrypt_api_key_from_row(&r, &salt);
            providers.push(ModelProvider {
                id: r.get("id"),
                provider_name: r.get("provider_name"),
                provider_type: r.get("provider_type"),
                base_url: r.try_get("base_url").ok(),
                api_key,
                icon: r.try_get("icon").ok(),
                description: r.try_get("description").ok(),
                test_model: r.try_get("test_model").ok(),
                is_available: r.get::<i64, _>("is_available") != 0,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }
        Ok(providers)
    }

    pub async fn get_provider(&self, id: &str) -> Result<Option<ModelProvider>> {
        let r = sqlx::query(
            "SELECT id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                    icon, description, test_model, is_available, created_at, updated_at
             FROM model_provider WHERE id = ?1",
        )
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        let Some(r) = r else { return Ok(None) };
        let salt = self.get_or_create_salt().await?;
        let api_key = decrypt_api_key_from_row(&r, &salt);

        Ok(Some(ModelProvider {
            id: r.get("id"),
            provider_name: r.get("provider_name"),
            provider_type: r.get("provider_type"),
            base_url: r.try_get("base_url").ok(),
            api_key,
            icon: r.try_get("icon").ok(),
            description: r.try_get("description").ok(),
            test_model: r.try_get("test_model").ok(),
            is_available: r.get::<i64, _>("is_available") != 0,
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    pub async fn upsert_provider(&self, provider: &ModelProvider) -> Result<()> {
        let salt = self.get_or_create_salt().await?;

        let (enc_key, nonce) = if let Some(ref key) = provider.api_key {
            if key.is_empty() {
                (None, None)
            } else {
                let (ct, n) = crypto::encrypt_value(key, &salt)?;
                (Some(ct), Some(n))
            }
        } else {
            (None, None)
        };

        sqlx::query(
            "INSERT INTO model_provider
                (id, provider_name, provider_type, base_url, api_key_encrypted, api_key_nonce,
                 icon, description, test_model, is_available, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                provider_name = ?2, provider_type = ?3, base_url = ?4,
                api_key_encrypted = COALESCE(?5, api_key_encrypted),
                api_key_nonce = COALESCE(?6, api_key_nonce),
                icon = ?7, description = ?8, test_model = ?9, is_available = ?10,
                updated_at = datetime('now')",
        )
            .bind(&provider.id)
            .bind(&provider.provider_name)
            .bind(&provider.provider_type)
            .bind(&provider.base_url)
            .bind(&enc_key)
            .bind(&nonce)
            .bind(&provider.icon)
            .bind(&provider.description)
            .bind(&provider.test_model)
            .bind(provider.is_available as i64)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn delete_provider(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM model_provider WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ---- Model CRUD ----

    pub async fn list_models(&self, provider_id: &str) -> Result<Vec<Model>> {
        let rows = sqlx::query(
            "SELECT id, provider_id, model_name, categories, capabilities, is_online, meta,
                    created_at, updated_at
             FROM model WHERE provider_id = ?1 ORDER BY model_name",
        )
            .bind(provider_id)
            .fetch_all(&self.pool)
            .await?;

        let mut models = Vec::new();
        for r in rows {
            models.push(Model {
                id: r.get("id"),
                provider_id: r.get("provider_id"),
                model_name: r.get("model_name"),
                categories: parse_json_array(r.try_get("categories").ok()),
                capabilities: parse_json_array(r.try_get("capabilities").ok()),
                is_online: r.get::<i64, _>("is_online") != 0,
                meta: r
                    .try_get::<String, _>("meta")
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }
        Ok(models)
    }

    pub async fn get_model(&self, provider_id: &str, model_name: &str) -> Result<Option<Model>> {
        let r = sqlx::query(
            "SELECT id, provider_id, model_name, categories, capabilities, is_online, meta,
                    created_at, updated_at
             FROM model WHERE provider_id = ?1 AND model_name = ?2",
        )
            .bind(provider_id)
            .bind(model_name)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(r) = r {
            Ok(Some(Model {
                id: r.get("id"),
                provider_id: r.get("provider_id"),
                model_name: r.get("model_name"),
                categories: modelproviders::parse_json_array(r.try_get("categories").ok()),
                capabilities: modelproviders::parse_json_array(r.try_get("capabilities").ok()),
                is_online: r.get::<i64, _>("is_online") != 0,
                meta: r
                    .try_get::<String, _>("meta")
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn upsert_model(&self, model: &Model) -> Result<()> {
        let categories = serde_json::to_string(&model.categories)?;
        let capabilities = serde_json::to_string(&model.capabilities)?;
        let meta = model.meta.as_ref().map(|v| v.to_string());

        sqlx::query(
            "INSERT INTO model
                (id, provider_id, model_name, categories, capabilities, is_online, meta,
                 created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                provider_id = ?2, model_name = ?3, categories = ?4,
                capabilities = ?5, is_online = ?6, meta = ?7,
                updated_at = datetime('now')",
        )
            .bind(&model.id)
            .bind(&model.provider_id)
            .bind(&model.model_name)
            .bind(&categories)
            .bind(&capabilities)
            .bind(model.is_online as i64)
            .bind(&meta)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn delete_model(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM model WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ---- Accessors ----

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    // ---- Session Manager ----

    /// Create a SessionManager backed by this DbManager's pool.
    pub fn session_manager(&self, max_sessions: usize) -> SessionManager {
        SessionManager::new(self.pool.clone(), max_sessions)
    }

    // ---- MCP Server CRUD ----

    pub async fn list_mcp_servers(&self) -> Result<Vec<McpServer>> {
        let rows = sqlx::query(
            "SELECT id, name, transport, command, args, env, url, headers,
                    deferred, is_connected, last_error, tool_count, enabled,
                    created_at, updated_at
             FROM mcp_server ORDER BY name",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.iter().map(mcpserver::mcp_server_from_row).collect())
    }

    pub async fn get_mcp_server(&self, id: &str) -> Result<Option<McpServer>> {
        let r = sqlx::query(
            "SELECT id, name, transport, command, args, env, url, headers,
                    deferred, is_connected, last_error, tool_count, enabled,
                    created_at, updated_at
             FROM mcp_server WHERE id = ?1",
        )
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(r.map(|row| mcpserver::mcp_server_from_row(&row)))
    }

    pub async fn upsert_mcp_server(&self, server: &McpServer) -> Result<()> {
        sqlx::query(
            "INSERT INTO mcp_server
                (id, name, transport, command, args, env, url, headers,
                 deferred, is_connected, last_error, tool_count, enabled,
                 created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                     datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                name = ?2, transport = ?3, command = ?4, args = ?5,
                env = ?6, url = ?7, headers = ?8, deferred = ?9,
                is_connected = ?10, last_error = ?11, tool_count = ?12,
                enabled = ?13, updated_at = datetime('now')",
        )
            .bind(&server.id)
            .bind(&server.name)
            .bind(&server.transport)
            .bind(&server.command)
            .bind(&server.args)
            .bind(&server.env)
            .bind(&server.url)
            .bind(&server.headers)
            .bind(server.deferred as i64)
            .bind(server.is_connected as i64)
            .bind(&server.last_error)
            .bind(server.tool_count)
            .bind(server.enabled as i64)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_mcp_server(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM mcp_server WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_mcp_server_connected(
        &self,
        id: &str,
        is_connected: bool,
        tool_count: i64,
        last_error: Option<&str>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE mcp_server SET is_connected = ?2, tool_count = ?3,
                last_error = ?4, updated_at = datetime('now')
             WHERE id = ?1",
        )
            .bind(id)
            .bind(is_connected as i64)
            .bind(tool_count)
            .bind(last_error)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_mcp_server_enabled(&self, id: &str, enabled: bool) -> Result<()> {
        // Update mcp_server table
        sqlx::query(
            "UPDATE mcp_server SET enabled = ?2, updated_at = datetime('now') WHERE id = ?1",
        )
            .bind(id)
            .bind(enabled as i64)
            .execute(&self.pool)
            .await?;

        // Sync tool_provider.is_available for this MCP server's tools.
        // The tool_provider id follows the pattern "mcp:{server_name}".
        if let Some(server) = self.get_mcp_server(id).await? {
            let provider_id = format!("mcp:{}", server.name);
            sqlx::query(
                "UPDATE tool_provider SET is_available = ?2, updated_at = datetime('now') WHERE id = ?1",
            )
                .bind(&provider_id)
                .bind(enabled as i64)
                .execute(&self.pool)
                .await?;
        }

        Ok(())
    }

    /// Build a `McpConfig` from all enabled MCP server rows (for agent startup).
    pub async fn load_mcp_servers_as_config(&self) -> Result<crate::config::settings::McpConfig> {
        use std::collections::HashMap;
        let servers = self.list_mcp_servers().await?;
        let mut map = HashMap::new();
        for s in servers {
            if s.enabled {
                map.insert(s.name.clone(), s.to_mcp_server_config());
            }
        }
        Ok(crate::config::settings::McpConfig { servers: map })
    }
}

/// Default built-in assistants seeded on every startup.
fn builtin_assistants() -> Vec<assistants::UpsertAssistant> {
    vec![
        assistants::UpsertAssistant {
            id: Some("builtin-coder".to_string()),
            name: "代码助手".to_string(),
            icon: "\u{1f4bb}".to_string(), // 💻
            description: "专注于代码编写、调试和重构，支持多种编程语言".to_string(),
            model: String::new(),
            system_prompt: "你是一个专业的代码助手。帮助用户编写高质量代码、调试问题、进行代码重构。请始终提供清晰的代码注释和解释。".to_string(),
            tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 0,
        },
        assistants::UpsertAssistant {
            id: Some("builtin-writer".to_string()),
            name: "写作助手".to_string(),
            icon: "\u{270d}\u{fe0f}".to_string(), // ✍️
            description: "帮助撰写文章、邮件、报告，提升写作质量".to_string(),
            model: String::new(),
            system_prompt: "你是一个专业的写作助手。帮助用户撰写各类文档，包括文章、邮件、报告等。注重语言表达的准确性和流畅性。".to_string(),
            tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 1,
        },
        assistants::UpsertAssistant {
            id: Some("builtin-analyst".to_string()),
            name: "数据分析师".to_string(),
            icon: "\u{1f4ca}".to_string(), // 📊
            description: "协助数据分析、可视化建议和统计解读".to_string(),
            model: String::new(),
            system_prompt: "你是一个专业的数据分析师助手。帮助用户分析数据、提供可视化建议、解读统计结果，并给出有洞察力的数据驱动建议。".to_string(),
            tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 2,
        },
    ]
}
