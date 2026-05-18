use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

use crate::types::message::{Message, TokenUsage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub provider: String,
    pub model: String,
    pub cwd: String,
    pub total_usage: TokenUsage,
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub model: String,
    /// First user message, truncated to 80 chars
    pub summary: String,
    pub message_count: usize,
}

/// Session manager backed by the shared DbManager pool.
///
/// Reads session metadata from the `session_metadata` table, which is
/// created by the migration system in `super::migrations`.
pub struct SessionManager {
    pool: SqlitePool,
    max_sessions: usize,
}

impl SessionManager {
    /// Create a new SessionManager using an existing pool (from DbManager).
    pub fn new(pool: SqlitePool, max_sessions: usize) -> Self {
        Self { pool, max_sessions }
    }

    /// Create a new session metadata entry (called before the first graph run).
    pub async fn create(
        &self,
        provider: &str,
        model: &str,
        cwd: &str,
        session_id: &str,
    ) -> anyhow::Result<Session> {
        self.create_with_workspace(provider, model, cwd, session_id, "").await
    }

    /// Create a new session with an explicit workspace_id.
    pub async fn create_with_workspace(
        &self,
        provider: &str,
        model: &str,
        cwd: &str,
        session_id: &str,
        workspace_id: &str,
    ) -> anyhow::Result<Session> {
        let now = Utc::now();
        let now_str = now.to_rfc3339();

        sqlx::query(
            "INSERT OR IGNORE INTO session_metadata
             (thread_id, provider, cwd, model, summary, messages, msg_count, created_at, updated_at, workspace_id)
             VALUES (?1, ?2, ?3, ?4, '', '[]', 0, ?5, ?5, ?6)",
        )
        .bind(session_id)
        .bind(provider)
        .bind(cwd)
        .bind(model)
        .bind(&now_str)
        .bind(workspace_id)
        .execute(&self.pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create session: {}", e))?;

        Ok(Session {
            id: session_id.to_string(),
            created_at: now,
            updated_at: now,
            provider: provider.to_string(),
            model: model.to_string(),
            cwd: cwd.to_string(),
            total_usage: TokenUsage::default(),
            messages: Vec::new(),
        })
    }

    /// Persist session metadata (messages, usage, timestamps) after a graph run.
    /// Returns Ok(Some(new_title)) if the summary/title was updated (e.g. from placeholder to fallback), or Ok(None) otherwise.
    pub async fn save_metadata(&self, session: &Session) -> anyhow::Result<Option<String>> {
        let default_sum = extract_summary(&session.messages);
        let msg_count = session.messages.len();
        let messages_json = serde_json::to_string(&session.messages)?;
        let updated_at = Utc::now().to_rfc3339();

        // 1. Fetch existing summary from database to see if it has been customized
        let existing_summary: Option<String> = sqlx::query_scalar(
            "SELECT summary FROM session_metadata WHERE thread_id = ?1"
        )
        .bind(&session.id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None);

        let existing_summary = existing_summary.unwrap_or_default();

        let is_placeholder = |s: &str| {
            if let Some(rest) = s.strip_prefix("对话 ") {
                if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                    return true;
                }
            }
            if s.starts_with("Session ") && s.len() > "Session ".len() {
                return true;
            }
            false
        };

        // 2. Preserve custom summaries (either AI-generated or manually edited)
        let final_summary = if !existing_summary.is_empty() && existing_summary != default_sum && !is_placeholder(&existing_summary) {
            existing_summary.clone()
        } else {
            default_sum.clone()
        };

        let title_updated = final_summary != existing_summary && !final_summary.is_empty();

        sqlx::query(
            "UPDATE session_metadata
             SET messages = ?1, msg_count = ?2, updated_at = ?3, summary = ?4, model = ?5
             WHERE thread_id = ?6",
        )
        .bind(&messages_json)
        .bind(msg_count as i64)
        .bind(&updated_at)
        .bind(&final_summary)
        .bind(&session.model)
        .bind(&session.id)
        .execute(&self.pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to save session metadata: {}", e))?;

        Ok(if title_updated { Some(final_summary) } else { None })
    }

    /// List all sessions, ordered by updated_at descending.
    pub async fn list(&self) -> anyhow::Result<Vec<SessionMeta>> {
        let rows = sqlx::query(
            "SELECT thread_id, model, summary, msg_count, created_at, updated_at
             FROM session_metadata
             ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to list sessions: {}", e))?;

        let mut sessions = Vec::with_capacity(rows.len());
        for row in rows {
            let thread_id: String = row.get("thread_id");
            let model: String = row.get("model");
            let summary: String = row.get("summary");
            let msg_count: i64 = row.get("msg_count");
            let created_at_str: String = row.get("created_at");
            let updated_at_str: String = row.get("updated_at");

            let created_at = DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            sessions.push(SessionMeta {
                id: thread_id,
                created_at,
                updated_at,
                model,
                summary,
                message_count: msg_count as usize,
            });
        }
        Ok(sessions)
    }

    /// Load a session by ID (or "latest").
    pub async fn load(&self, id_or_latest: &str) -> anyhow::Result<Session> {
        let row = if id_or_latest == "latest" {
            sqlx::query(
                "SELECT thread_id, provider, cwd, model, messages, created_at, updated_at
                 FROM session_metadata
                 ORDER BY updated_at DESC
                 LIMIT 1",
            )
            .fetch_optional(&self.pool)
            .await
        } else {
            sqlx::query(
                "SELECT thread_id, provider, cwd, model, messages, created_at, updated_at
                 FROM session_metadata
                 WHERE thread_id = ?1",
            )
            .bind(id_or_latest)
            .fetch_optional(&self.pool)
            .await
        }
        .map_err(|e| anyhow::anyhow!("Failed to load session: {}", e))?;

        let row = row.ok_or_else(|| anyhow::anyhow!("Session '{}' not found", id_or_latest))?;

        let thread_id: String = row.get("thread_id");
        let provider: String = row.get("provider");
        let cwd: String = row.get("cwd");
        let model: String = row.get("model");
        let messages_json: String = row.get("messages");
        let created_at_str: String = row.get("created_at");
        let updated_at_str: String = row.get("updated_at");

        let messages: Vec<Message> = serde_json::from_str(&messages_json).unwrap_or_default();
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let total_usage = TokenUsage::default();

        Ok(Session {
            id: thread_id,
            created_at,
            updated_at,
            provider,
            model,
            cwd,
            total_usage,
            messages,
        })
    }

    /// Delete a session's metadata.
    pub async fn delete(&self, session_id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM session_metadata WHERE thread_id = ?1")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to delete session: {}", e))?;
        Ok(())
    }

    /// Remove oldest sessions beyond max_sessions.
    pub async fn cleanup_old(&self) -> anyhow::Result<()> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM session_metadata")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        if count <= self.max_sessions as i64 {
            return Ok(());
        }

        let to_remove = count - self.max_sessions as i64;
        sqlx::query(
            "DELETE FROM session_metadata WHERE thread_id IN (
                SELECT thread_id FROM session_metadata ORDER BY created_at ASC LIMIT ?1
            )",
        )
        .bind(to_remove)
        .execute(&self.pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to cleanup old sessions: {}", e))?;

        Ok(())
    }

    /// Get the pool reference (for use by conversations module).
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Get max_sessions setting.
    pub fn max_sessions(&self) -> usize {
        self.max_sessions
    }
}

/// Extract a summary from the first user message, truncated to 80 chars.
fn extract_summary(messages: &[Message]) -> String {
    messages
        .iter()
        .find(|m| m.role == crate::types::message::Role::User)
        .and_then(|m| {
            m.content.iter().find_map(|c| {
                if let crate::types::message::ContentBlock::Text { text } = c {
                    Some(truncate_str(text, 80))
                } else {
                    None
                }
            })
        })
        .unwrap_or_default()
}

fn truncate_str(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max - 3).collect();
        format!("{}...", truncated)
    }
}
