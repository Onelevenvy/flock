use serde::{de::DeserializeOwned, Serialize};
use sqlx::Row;

use super::DbManager;

impl DbManager {
    /// Read a config value by key, deserializing from JSON.
    pub async fn get_config<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let row = sqlx::query("SELECT value FROM app_config WHERE key = ?1")
            .bind(key)
            .fetch_optional(self.pool())
            .await
            .ok()??;
        let json: String = row.get("value");
        serde_json::from_str(&json).ok()
    }

    /// Write a config value by key, serializing to JSON.
    pub async fn set_config<T: Serialize>(&self, key: &str, value: &T) -> anyhow::Result<()> {
        let json = serde_json::to_string(value)?;
        sqlx::query(
            "INSERT INTO app_config (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        )
            .bind(key)
            .bind(&json)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    /// Seed default app_config entries on every startup using INSERT OR IGNORE
    /// so that existing user-customized values are never overwritten.
    /// This ensures the UI can always read valid config even on a fresh database.
    pub(super) async fn seed_default_app_config(&self) -> anyhow::Result<()> {
        use crate::config::compression::CompressionConfig;
        use crate::config::plan::PlanConfig;
        use crate::config::file_cache::FileCacheConfig;
        use crate::config::hooks::HooksConfig;
        use crate::config::settings::{DefaultConfig, ToolsConfig};

        let entries: Vec<(&str, String)> = vec![
            ("default", serde_json::to_string(&DefaultConfig::default())?),
            ("tools",   serde_json::to_string(&ToolsConfig::default())?),
            ("compact", serde_json::to_string(&CompressionConfig::default())?),
            ("plan",    serde_json::to_string(&PlanConfig::default())?),
            ("file_cache", serde_json::to_string(&FileCacheConfig::default())?),
            ("hooks",   serde_json::to_string(&HooksConfig::default())?),
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
            .execute(self.pool())
            .await?;
        }

        log::debug!("[db] seed_default_app_config: default keys ensured in app_config");
        Ok(())
    }
}
