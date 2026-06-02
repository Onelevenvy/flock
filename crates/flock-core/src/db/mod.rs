pub mod assistants;
pub mod assistants_seed;
pub mod conversations;
pub mod message_parser;
pub mod mcpserver;
pub mod migrations;
pub mod models;
pub mod modelproviders;
pub mod modelprovider_seed;
pub mod model_providers;
pub mod sessions;
pub mod toolproviders;
pub mod cron;
pub mod app_config;
pub mod workflow;
pub mod workflow_seed;
pub mod cron_seed;


use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;

use crate::config::db_path::resolve_db_path;
use crate::crypto;

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

// Re-export workflow types.
pub use workflow::{WorkflowRecord, UpsertWorkflow, WorkflowVersionRecord};

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
        mgr.seed_builtin_assistants(&assistants_seed::builtin_assistants()).await?;
        mgr.seed_builtin_workflows(&workflow_seed::builtin_workflows()).await?;
        mgr.seed_builtin_cron_jobs(&cron_seed::builtin_cron_jobs()).await?;
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
}
