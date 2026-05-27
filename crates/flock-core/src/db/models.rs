use sqlx::Row;

use super::modelproviders::{Model, parse_json_array};

impl super::DbManager {
    pub async fn list_models(&self, provider_id: &str) -> anyhow::Result<Vec<Model>> {
        let rows = sqlx::query(
            "SELECT id, provider_id, model_name, categories, capabilities, is_online, meta,
                    created_at, updated_at
             FROM model WHERE provider_id = ?1 ORDER BY model_name",
        )
            .bind(provider_id)
            .fetch_all(self.pool())
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

    pub async fn get_model(&self, provider_id: &str, model_name: &str) -> anyhow::Result<Option<Model>> {
        let r = sqlx::query(
            "SELECT id, provider_id, model_name, categories, capabilities, is_online, meta,
                    created_at, updated_at
             FROM model WHERE provider_id = ?1 AND model_name = ?2",
        )
            .bind(provider_id)
            .bind(model_name)
            .fetch_optional(self.pool())
            .await?;

        if let Some(r) = r {
            Ok(Some(Model {
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
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn upsert_model(&self, model: &Model) -> anyhow::Result<()> {
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
            .execute(self.pool())
            .await?;

        Ok(())
    }

    pub async fn delete_model(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM model WHERE id = ?1")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }
}
