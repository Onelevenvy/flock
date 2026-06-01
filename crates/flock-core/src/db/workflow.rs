use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;

use super::DbManager;
use crate::types::tool::I18nString;

/// A workflow record stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRecord {
    pub id: String,
    pub name: I18nString,
    pub description: I18nString,
    /// Full ReactFlow config: { nodes, edges, metadata, ... }
    pub config: JsonValue,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating or updating a workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertWorkflow {
    pub id: Option<String>,
    pub name: I18nString,
    pub description: I18nString,
    pub config: JsonValue,
    pub is_active: bool,
}

impl DbManager {
    /// List all workflows, ordered by updated_at DESC.
    pub async fn list_workflows(&self) -> anyhow::Result<Vec<WorkflowRecord>> {
        let rows = sqlx::query(
            "SELECT id, name, description, config, is_active, created_at, updated_at
             FROM workflow
             ORDER BY updated_at DESC",
        )
        .fetch_all(self.pool())
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(parse_row(&row)?);
        }
        Ok(result)
    }

    /// Get a single workflow by ID.
    pub async fn get_workflow(&self, id: &str) -> anyhow::Result<Option<WorkflowRecord>> {
        let row = sqlx::query(
            "SELECT id, name, description, config, is_active, created_at, updated_at
             FROM workflow WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(self.pool())
        .await?;

        match row {
            Some(r) => Ok(Some(parse_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Create a new workflow. Returns the created record.
    pub async fn create_workflow(&self, input: &UpsertWorkflow) -> anyhow::Result<WorkflowRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = input.id.clone().unwrap_or_else(|| {
            format!("wf_{}", uuid_like())
        });
        let name_json = serde_json::to_string(&input.name)?;
        let description_json = serde_json::to_string(&input.description)?;
        let config_json = serde_json::to_string(&input.config)?;

        sqlx::query(
            "INSERT INTO workflow (id, name, description, config, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        )
        .bind(&id)
        .bind(&name_json)
        .bind(&description_json)
        .bind(&config_json)
        .bind(input.is_active as i64)
        .bind(&now)
        .execute(self.pool())
        .await?;

        Ok(WorkflowRecord {
            id,
            name: input.name.clone(),
            description: input.description.clone(),
            config: input.config.clone(),
            is_active: input.is_active,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// Update an existing workflow. Returns error if not found.
    pub async fn update_workflow(&self, id: &str, input: &UpsertWorkflow) -> anyhow::Result<WorkflowRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        let name_json = serde_json::to_string(&input.name)?;
        let description_json = serde_json::to_string(&input.description)?;
        let config_json = serde_json::to_string(&input.config)?;

        let rows_affected = sqlx::query(
            "UPDATE workflow SET
                name = ?1, description = ?2, config = ?3, is_active = ?4, updated_at = ?5
             WHERE id = ?6",
        )
        .bind(&name_json)
        .bind(&description_json)
        .bind(&config_json)
        .bind(input.is_active as i64)
        .bind(&now)
        .bind(id)
        .execute(self.pool())
        .await?
        .rows_affected();

        if rows_affected == 0 {
            anyhow::bail!("Workflow '{}' not found", id);
        }

        self.get_workflow(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found after update", id))
    }

    /// Delete a workflow by ID.
    pub async fn delete_workflow(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM workflow WHERE id = ?1")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    /// Seed / upsert built-in workflows (called on startup).
    /// Keeps user-modified settings if any.
    pub async fn seed_builtin_workflows(&self, builtins: &[UpsertWorkflow]) -> anyhow::Result<()> {
        for wf in builtins {
            let default_id = format!("wf_{}", uuid_like());
            let id = wf.id.as_deref().unwrap_or(&default_id);
            let name_json = serde_json::to_string(&wf.name)?;
            let description_json = serde_json::to_string(&wf.description)?;
            let config_json = serde_json::to_string(&wf.config)?;
            let now = chrono::Utc::now().to_rfc3339();

            // Insert if not exists; on conflict update name, description, config, etc.
            sqlx::query(
                "INSERT INTO workflow (id, name, description, config, is_active, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    config = excluded.config,
                    updated_at = excluded.updated_at",
            )
            .bind(id)
            .bind(&name_json)
            .bind(&description_json)
            .bind(&config_json)
            .bind(wf.is_active as i64)
            .bind(&now)
            .execute(self.pool())
            .await?;
        }
        Ok(())
    }
}

fn parse_row(row: &sqlx::sqlite::SqliteRow) -> anyhow::Result<WorkflowRecord> {
    let name_str: String = row.get("name");
    let name: I18nString = serde_json::from_str(&name_str)
        .unwrap_or_else(|_| I18nString::single(name_str));

    let description_str: String = row.get("description");
    let description: I18nString = serde_json::from_str(&description_str)
        .unwrap_or_else(|_| I18nString::single(description_str));

    let config_json: String = row.get("config");
    let config: JsonValue = serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
    let is_active: i64 = row.get("is_active");

    Ok(WorkflowRecord {
        id: row.get("id"),
        name,
        description,
        config,
        is_active: is_active != 0,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{:x}{:06x}", ts, (ts ^ (ts >> 16)) & 0xFFFFFF)
}
