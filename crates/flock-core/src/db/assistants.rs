use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbManager;
use crate::types::tool::I18nString;

/// A single assistant definition stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantRecord {
    pub id: String,
    pub name: I18nString,
    pub icon: String,
    pub description: I18nString,
    /// Format: "provider_id:model_name" or empty to use global model.
    pub model: String,
    pub system_prompt: String,
    /// JSON array of tool provider IDs, e.g. ["builtin-bash", "serpapi"]
    pub tools: Vec<String>,
    /// JSON array of disabled tool provider IDs
    pub disabled_tools: Vec<String>,
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
    pub name: I18nString,
    pub icon: String,
    pub description: I18nString,
    pub model: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub disabled_tools: Vec<String>,
    pub skills: Vec<String>,
    pub is_builtin: bool,
    pub sort_order: i64,
}

impl DbManager {
    /// List all assistants, ordered by is_builtin DESC, sort_order ASC, created_at ASC.
    pub async fn list_assistants(&self) -> anyhow::Result<Vec<AssistantRecord>> {
        let rows = sqlx::query(
            "SELECT id, name, icon, description, model, system_prompt,
                    tools, disabled_tools, skills, is_builtin, sort_order, created_at, updated_at
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
                    tools, disabled_tools, skills, is_builtin, sort_order, created_at, updated_at
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
        let name_json = serde_json::to_string(&input.name)?;
        let description_json = serde_json::to_string(&input.description)?;
        let tools_json = serde_json::to_string(&input.tools)?;
        let disabled_tools_json = serde_json::to_string(&input.disabled_tools)?;
        let skills_json = serde_json::to_string(&input.skills)?;

        sqlx::query(
            "INSERT INTO assistant
             (id, name, icon, description, model, system_prompt, tools, disabled_tools, skills,
              is_builtin, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        )
        .bind(&id)
        .bind(&name_json)
        .bind(&input.icon)
        .bind(&description_json)
        .bind(&input.model)
        .bind(&input.system_prompt)
        .bind(&tools_json)
        .bind(&disabled_tools_json)
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
            disabled_tools: input.disabled_tools.clone(),
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
        let name_json = serde_json::to_string(&input.name)?;
        let description_json = serde_json::to_string(&input.description)?;
        let tools_json = serde_json::to_string(&input.tools)?;
        let disabled_tools_json = serde_json::to_string(&input.disabled_tools)?;
        let skills_json = serde_json::to_string(&input.skills)?;

        let rows_affected = sqlx::query(
            "UPDATE assistant SET
                name = ?1, icon = ?2, description = ?3, model = ?4,
                system_prompt = ?5, tools = ?6, disabled_tools = ?7, skills = ?8,
                sort_order = ?9, updated_at = ?10
             WHERE id = ?11",
        )
        .bind(&name_json)
        .bind(&input.icon)
        .bind(&description_json)
        .bind(&input.model)
        .bind(&input.system_prompt)
        .bind(&tools_json)
        .bind(&disabled_tools_json)
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
            let default_id = asst.name.en.clone();
            let id = asst.id.as_deref().unwrap_or(&default_id);
            let name_json = serde_json::to_string(&asst.name)?;
            let description_json = serde_json::to_string(&asst.description)?;
            let tools_json = serde_json::to_string(&asst.tools)?;
            let disabled_tools_json = serde_json::to_string(&asst.disabled_tools)?;
            let skills_json = serde_json::to_string(&asst.skills)?;
            let now = chrono::Utc::now().to_rfc3339();

            // Insert if not exists; on conflict update only metadata fields.
            // Keep user-edited runtime fields (model/system_prompt/tools/disabled_tools/skills).
            sqlx::query(
                "INSERT INTO assistant
                 (id, name, icon, description, model, system_prompt, tools, disabled_tools, skills,
                  is_builtin, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?11, ?11)
                 ON CONFLICT(id) DO UPDATE SET
                    name        = excluded.name,
                    icon        = excluded.icon,
                    description = excluded.description,
                    sort_order  = excluded.sort_order,
                    updated_at  = excluded.updated_at",
            )
            .bind(id)
            .bind(&name_json)
            .bind(&asst.icon)
            .bind(&description_json)
            .bind(&asst.model)
            .bind(&asst.system_prompt)
            .bind(&tools_json)
            .bind(&disabled_tools_json)
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
    let name_str: String = row.get("name");
    let name: I18nString = serde_json::from_str(&name_str)
        .unwrap_or_else(|_| I18nString::single(name_str));

    let description_str: String = row.get("description");
    let description: I18nString = serde_json::from_str(&description_str)
        .unwrap_or_else(|_| I18nString::single(description_str));

    let tools_json: String = row.get("tools");
    let disabled_tools_json: String = row.get("disabled_tools");
    let skills_json: String = row.get("skills");
    let tools: Vec<String> = serde_json::from_str(&tools_json).unwrap_or_default();
    let disabled_tools: Vec<String> = serde_json::from_str(&disabled_tools_json).unwrap_or_default();
    let skills: Vec<String> = serde_json::from_str(&skills_json).unwrap_or_default();
    let is_builtin: i64 = row.get("is_builtin");

    Ok(AssistantRecord {
        id: row.get("id"),
        name,
        icon: row.get("icon"),
        description,
        model: row.get("model"),
        system_prompt: row.get("system_prompt"),
        tools,
        disabled_tools,
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

/// Default built-in assistants seeded on every startup.
pub fn builtin_assistants() -> Vec<UpsertAssistant> {
    vec![
        UpsertAssistant {
            id: Some("builtin-coder".to_string()),
            name: I18nString::new("代码助手", "Code Assistant"),
            icon: "\u{1f4bb}".to_string(), // 💻
            description: I18nString::new(
                "专注于代码编写、调试和重构，支持多种编程语言。",
                "Specializes in code writing, debugging, and refactoring across multiple programming languages."
            ),
            model: String::new(),
            system_prompt: "You are a professional code assistant. Help users write high-quality code, debug issues, and perform code refactoring. Always provide clear code comments and explanations.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Bash".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 0,
        },
        UpsertAssistant {
            id: Some("builtin-writer".to_string()),
            name: I18nString::new("写作助手", "Writing Assistant"),
            icon: "\u{270d}\u{fe0f}".to_string(), // ✍️
            description: I18nString::new(
                "帮助撰写文章、邮件、报告，提升写作质量。",
                "Helps write articles, emails, and reports to improve writing quality."
            ),
            model: String::new(),
            system_prompt: "You are a professional writing assistant. Help users draft various types of documents, including articles, emails, and reports. Pay attention to the accuracy and fluency of language expression.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
                "Google Translate".to_string(),
                "Baidu Translate".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 1,
        },
        UpsertAssistant {
            id: Some("builtin-analyst".to_string()),
            name: I18nString::new("数据分析师", "Data Analyst"),
            icon: "\u{1f4ca}".to_string(), // 📊
            description: I18nString::new(
                "协助数据分析、可视化建议和统计解读。",
                "Assists with data analysis, visualization suggestions, and statistical interpretation."
            ),
            model: String::new(),
            system_prompt: "You are a professional data analyst assistant. Help users analyze data, provide visualization suggestions, interpret statistical results, and offer insightful, data-driven recommendations.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Bash".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
                "Math Calculator".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 2,
        },
        UpsertAssistant {
            id: Some("builtin-computer-use".to_string()),
            name: I18nString::new("电脑操作助手", "Computer Use Assistant"),
            icon: "\u{1f5a5}".to_string(), // 🖥️
            description: I18nString::new(
                "具备沙盒环境下的电脑操作能力，支持安全的代码执行、网页浏览器、屏幕操控等。",
                "Equipped with computer-use capabilities in a sandbox, supporting safe code execution, web browser, screen control, etc."
            ),
            model: String::new(),
            system_prompt: "You are an assistant capable of interacting with a computer sandbox. You can execute code, open websites, and control the screen to help the user complete desktop tasks.".to_string(),
            tools: vec![
                "Browser".to_string(),
                "CodeExecution".to_string(),
                "ComputerUse".to_string(),
                "RequestHumanAssistance".to_string(),
                "SandboxExec".to_string(),
                "SandboxRead".to_string(),
                "SandboxWrite".to_string(),
                "SandboxEdit".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 3,
        },
    ]
}
