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
    /// Full ReactFlow config (Draft): { nodes, edges, metadata, ... }
    pub config: JsonValue,
    /// Published version ReactFlow config
    pub published_config: JsonValue,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub active_version: Option<String>,
}

/// A workflow version record stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowVersionRecord {
    pub id: String,
    pub workflow_id: String,
    pub version: String,
    pub description: String,
    pub config: JsonValue,
    pub created_at: String,
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
            "SELECT id, name, description, config, published_config, is_active, created_at, updated_at,
                    (SELECT version FROM workflow_version WHERE workflow_id = workflow.id ORDER BY created_at DESC LIMIT 1) as active_version
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
            "SELECT id, name, description, config, published_config, is_active, created_at, updated_at,
                    (SELECT version FROM workflow_version WHERE workflow_id = workflow.id ORDER BY created_at DESC LIMIT 1) as active_version
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
            "INSERT INTO workflow (id, name, description, config, published_config, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?6, ?6)",
        )
        .bind(&id)
        .bind(&name_json)
        .bind(&description_json)
        .bind(&config_json)
        .bind(input.is_active as i64)
        .bind(&now)
        .execute(self.pool())
        .await?;

        self.get_workflow(&id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found after creation", id))
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

    /// Publish draft config as production version
    pub async fn publish_workflow(&self, id: &str, version: &str, description: Option<&str>) -> anyhow::Result<WorkflowRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        
        let wf = self.get_workflow(id).await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found for publish", id))?;

        let version_id = format!("wfv_{}", uuid_like());
        let desc = description.unwrap_or("");
        let config_str = serde_json::to_string(&wf.config)?;

        sqlx::query(
            "INSERT INTO workflow_version (id, workflow_id, version, description, config, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        )
        .bind(&version_id)
        .bind(id)
        .bind(version)
        .bind(desc)
        .bind(&config_str)
        .bind(&now)
        .execute(self.pool())
        .await?;

        let rows_affected = sqlx::query(
            "UPDATE workflow SET
                published_config = config, updated_at = ?1
             WHERE id = ?2",
        )
        .bind(&now)
        .bind(id)
        .execute(self.pool())
        .await?
        .rows_affected();

        if rows_affected == 0 {
            anyhow::bail!("Workflow '{}' not found for publish", id);
        }

        self.get_workflow(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found after publish", id))
    }

    /// List all versions of a workflow, ordered by created_at DESC.
    pub async fn list_workflow_versions(&self, workflow_id: &str) -> anyhow::Result<Vec<WorkflowVersionRecord>> {
        let rows = sqlx::query(
            "SELECT id, workflow_id, version, description, config, created_at
             FROM workflow_version
             WHERE workflow_id = ?1
             ORDER BY created_at DESC",
        )
        .bind(workflow_id)
        .fetch_all(self.pool())
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            let config_json: String = row.get("config");
            let config: JsonValue = serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
            result.push(WorkflowVersionRecord {
                id: row.get("id"),
                workflow_id: row.get("workflow_id"),
                version: row.get("version"),
                description: row.get("description"),
                config,
                created_at: row.get("created_at"),
            });
        }
        Ok(result)
    }

    /// Rollback workflow draft config to a historical version config (only updates draft config).
    pub async fn rollback_workflow_draft(&self, workflow_id: &str, version_id: &str) -> anyhow::Result<WorkflowRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            "SELECT config FROM workflow_version WHERE id = ?1 AND workflow_id = ?2",
        )
        .bind(version_id)
        .bind(workflow_id)
        .fetch_optional(self.pool())
        .await?;

        let config_json = match row {
            Some(r) => r.get::<String, _>("config"),
            None => anyhow::bail!("Workflow version '{}' not found", version_id),
        };

        sqlx::query(
            "UPDATE workflow SET config = ?1, updated_at = ?2 WHERE id = ?3"
        )
        .bind(&config_json)
        .bind(&now)
        .bind(workflow_id)
        .execute(self.pool())
        .await?;

        self.get_workflow(workflow_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found after rollback", workflow_id))
    }

    /// Switch the workflow's active production version (only updates published_config).
    pub async fn switch_workflow_production(&self, workflow_id: &str, version_id: &str) -> anyhow::Result<WorkflowRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        
        let row = sqlx::query(
            "SELECT config FROM workflow_version WHERE id = ?1 AND workflow_id = ?2",
        )
        .bind(version_id)
        .bind(workflow_id)
        .fetch_optional(self.pool())
        .await?;

        let config_json = match row {
            Some(r) => r.get::<String, _>("config"),
            None => anyhow::bail!("Workflow version '{}' not found", version_id),
        };

        sqlx::query(
            "UPDATE workflow SET published_config = ?1, updated_at = ?2 WHERE id = ?3"
        )
        .bind(&config_json)
        .bind(&now)
        .bind(workflow_id)
        .execute(self.pool())
        .await?;

        self.get_workflow(workflow_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow '{}' not found after switching production", workflow_id))
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

            // Insert if not exists; on conflict update name, description, config, published_config, etc.
            sqlx::query(
                "INSERT INTO workflow (id, name, description, config, published_config, is_active, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    config = excluded.config,
                    published_config = excluded.published_config,
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

            // 自动为内置工作流生成初始发布版本 V1.0.0
            let existing_versions = self.list_workflow_versions(id).await?;
            if existing_versions.is_empty() {
                let version_id = format!("wfv_{}", uuid_like());
                sqlx::query(
                    "INSERT INTO workflow_version (id, workflow_id, version, description, config, created_at)
                     VALUES (?1, ?2, 'V1.0.0', 'System seeded default version', ?3, ?4)"
                )
                .bind(&version_id)
                .bind(id)
                .bind(&config_json)
                .bind(&now)
                .execute(self.pool())
                .await?;
            }
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
    
    let published_config_json: String = row.get("published_config");
    let published_config: JsonValue = serde_json::from_str(&published_config_json).unwrap_or(serde_json::json!({}));
    
    let is_active: i64 = row.get("is_active");
    let active_version: Option<String> = row.try_get("active_version").ok();

    Ok(WorkflowRecord {
        id: row.get("id"),
        name,
        description,
        config,
        published_config,
        is_active: is_active != 0,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        active_version,
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
