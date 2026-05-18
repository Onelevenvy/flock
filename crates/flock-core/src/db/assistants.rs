use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbManager;

/// A single assistant definition stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantRecord {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    /// Format: "provider_id:model_name" or empty to use global model.
    pub model: String,
    pub system_prompt: String,
    /// JSON array of tool provider IDs, e.g. ["builtin-bash", "serpapi"]
    pub tools: Vec<String>,
    /// JSON array of skill names
    pub skills: Vec<String>,
    pub is_builtin: bool,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating or updating an assistant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertAssistant {
    pub id: Option<String>,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub model: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub skills: Vec<String>,
    pub is_builtin: bool,
    pub sort_order: i64,
}

impl DbManager {
    /// List all assistants, ordered by is_builtin DESC, sort_order ASC, created_at ASC.
    pub async fn list_assistants(&self) -> anyhow::Result<Vec<AssistantRecord>> {
        let rows = sqlx::query(
            "SELECT id, name, icon, description, model, system_prompt,
                    tools, skills, is_builtin, sort_order, created_at, updated_at
             FROM assistant
             ORDER BY is_builtin DESC, sort_order ASC, created_at ASC",
        )
        .fetch_all(self.pool())
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(parse_row(&row)?);
        }
        Ok(result)
    }

    /// Get a single assistant by ID.
    pub async fn get_assistant(&self, id: &str) -> anyhow::Result<Option<AssistantRecord>> {
        let row = sqlx::query(
            "SELECT id, name, icon, description, model, system_prompt,
                    tools, skills, is_builtin, sort_order, created_at, updated_at
             FROM assistant WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(self.pool())
        .await?;

        match row {
            Some(r) => Ok(Some(parse_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Create a new assistant. Returns the created record.
    pub async fn create_assistant(&self, input: &UpsertAssistant) -> anyhow::Result<AssistantRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = input.id.clone().unwrap_or_else(|| {
            format!("asst_{}", uuid_like())
        });
        let tools_json = serde_json::to_string(&input.tools)?;
        let skills_json = serde_json::to_string(&input.skills)?;

        sqlx::query(
            "INSERT INTO assistant
             (id, name, icon, description, model, system_prompt, tools, skills,
              is_builtin, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.icon)
        .bind(&input.description)
        .bind(&input.model)
        .bind(&input.system_prompt)
        .bind(&tools_json)
        .bind(&skills_json)
        .bind(input.is_builtin as i64)
        .bind(input.sort_order)
        .bind(&now)
        .execute(self.pool())
        .await?;

        Ok(AssistantRecord {
            id,
            name: input.name.clone(),
            icon: input.icon.clone(),
            description: input.description.clone(),
            model: input.model.clone(),
            system_prompt: input.system_prompt.clone(),
            tools: input.tools.clone(),
            skills: input.skills.clone(),
            is_builtin: input.is_builtin,
            sort_order: input.sort_order,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// Update an existing assistant. Returns error if not found.
    pub async fn update_assistant(&self, id: &str, input: &UpsertAssistant) -> anyhow::Result<AssistantRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        let tools_json = serde_json::to_string(&input.tools)?;
        let skills_json = serde_json::to_string(&input.skills)?;

        let rows_affected = sqlx::query(
            "UPDATE assistant SET
                name = ?1, icon = ?2, description = ?3, model = ?4,
                system_prompt = ?5, tools = ?6, skills = ?7,
                sort_order = ?8, updated_at = ?9
             WHERE id = ?10",
        )
        .bind(&input.name)
        .bind(&input.icon)
        .bind(&input.description)
        .bind(&input.model)
        .bind(&input.system_prompt)
        .bind(&tools_json)
        .bind(&skills_json)
        .bind(input.sort_order)
        .bind(&now)
        .bind(id)
        .execute(self.pool())
        .await?
        .rows_affected();

        if rows_affected == 0 {
            anyhow::bail!("Assistant '{}' not found", id);
        }

        self.get_assistant(id).await?.ok_or_else(|| anyhow::anyhow!("Assistant '{}' not found after update", id))
    }

    /// Delete an assistant. Builtin assistants are not deletable via this path;
    /// callers should check is_builtin before calling.
    pub async fn delete_assistant(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM assistant WHERE id = ?1 AND is_builtin = 0")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    /// Seed / upsert built-in assistants (called on startup).
    /// Existing built-in assistants are updated by name; user modifications to
    /// system_prompt / model / tools / skills are preserved via a selective update.
    pub async fn seed_builtin_assistants(&self, builtins: &[UpsertAssistant]) -> anyhow::Result<()> {
        for (order, asst) in builtins.iter().enumerate() {
            let id = asst.id.as_deref().unwrap_or(&asst.name);
            let tools_json = serde_json::to_string(&asst.tools)?;
            let skills_json = serde_json::to_string(&asst.skills)?;
            let now = chrono::Utc::now().to_rfc3339();

            // Insert if not exists; on conflict update only name/icon/description/sort_order
            sqlx::query(
                "INSERT INTO assistant
                 (id, name, icon, description, model, system_prompt, tools, skills,
                  is_builtin, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                    name        = excluded.name,
                    icon        = excluded.icon,
                    description = excluded.description,
                    sort_order  = excluded.sort_order,
                    updated_at  = excluded.updated_at",
            )
            .bind(id)
            .bind(&asst.name)
            .bind(&asst.icon)
            .bind(&asst.description)
            .bind(&asst.model)
            .bind(&asst.system_prompt)
            .bind(&tools_json)
            .bind(&skills_json)
            .bind(order as i64)
            .bind(&now)
            .execute(self.pool())
            .await?;
        }
        Ok(())
    }
}

fn parse_row(row: &sqlx::sqlite::SqliteRow) -> anyhow::Result<AssistantRecord> {
    let tools_json: String = row.get("tools");
    let skills_json: String = row.get("skills");
    let tools: Vec<String> = serde_json::from_str(&tools_json).unwrap_or_default();
    let skills: Vec<String> = serde_json::from_str(&skills_json).unwrap_or_default();
    let is_builtin: i64 = row.get("is_builtin");

    Ok(AssistantRecord {
        id: row.get("id"),
        name: row.get("name"),
        icon: row.get("icon"),
        description: row.get("description"),
        model: row.get("model"),
        system_prompt: row.get("system_prompt"),
        tools,
        skills,
        is_builtin: is_builtin != 0,
        sort_order: row.get("sort_order"),
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
