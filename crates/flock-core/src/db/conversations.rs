use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbManager;
use super::message_parser::parse_rfc3339_to_secs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationInfo {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub model: Option<String>,
    pub message_count: usize,
    pub assistant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageChunk {
    pub kind: String, // "text", "thinking", "tool_request", "tool_result"
    pub text: Option<String>,
    pub call_id: Option<String>,
    pub tool: Option<serde_json::Value>,
    pub status: Option<String>,
    pub result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub chunks: Vec<MessageChunk>,
    pub timestamp: u64,
}

impl DbManager {
    /// List session-based conversations for a workspace (from session_metadata table).
    /// Filters by workspace_id (preferred) or cwd (fallback for legacy data).
    pub async fn list_workspace_sessions(&self, workspace_id: &str, workspace_path: &str) -> anyhow::Result<Vec<ConversationInfo>> {
        let rows = sqlx::query(
            "SELECT thread_id, model, summary, msg_count, updated_at, workspace_id, assistant_id
             FROM session_metadata
             WHERE workspace_id = ?1 OR (workspace_id = '' AND cwd = ?2)
             ORDER BY updated_at DESC",
        )
        .bind(workspace_id)
        .bind(workspace_path)
        .fetch_all(self.pool())
        .await
        .unwrap_or_default();

        let mut conversations = Vec::new();
        for row in rows {
            let id: String = row.get("thread_id");
            let summary: String = row.get("summary");
            let title = if summary.is_empty() {
                format!("Session {}", id)
            } else {
                summary
            };

            let msg_count: i64 = row.get("msg_count");
            let updated_at_str: String = row.get("updated_at");
            let updated_at = parse_rfc3339_to_secs(&updated_at_str);

            let ws_id: String = row.try_get::<String, _>("workspace_id")
                .unwrap_or_default();

            conversations.push(ConversationInfo {
                id,
                workspace_id: if ws_id.is_empty() { workspace_id.to_string() } else { ws_id },
                title,
                created_at: updated_at,
                updated_at,
                model: row.try_get::<String, _>("model").ok(),
                message_count: msg_count as usize,
                assistant_id: row.try_get::<String, _>("assistant_id").ok(),
            });
        }

        Ok(conversations)
    }

    /// Create a new conversation entry in session_metadata.
    pub async fn create_conversation(
        &self,
        workspace_id: &str,
        title: &str,
        assistant_id: Option<String>,
    ) -> anyhow::Result<ConversationInfo> {
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();
        let now_secs = now.timestamp() as u64;
        let id = format!("conv_{}", now_secs);

        let display_title = if title.is_empty() {
            format!("对话 {}", &id[5..])
        } else {
            title.to_string()
        };

        sqlx::query(
            "INSERT INTO session_metadata
             (thread_id, provider, cwd, model, summary, messages, msg_count, created_at, updated_at, workspace_id, assistant_id)
             VALUES (?1, '', '', '', ?2, '[]', 0, ?3, ?3, ?4, ?5)",
        )
        .bind(&id)
        .bind(&display_title)
        .bind(&now_str)
        .bind(workspace_id)
        .bind(&assistant_id)
        .execute(self.pool())
        .await?;

        Ok(ConversationInfo {
            id,
            workspace_id: workspace_id.to_string(),
            title: display_title,
            created_at: now_secs,
            updated_at: now_secs,
            model: None,
            message_count: 0,
            assistant_id,
        })
    }

    /// Update a conversation's title.
    pub async fn update_conversation_title(
        &self,
        conv_id: &str,
        title: &str,
    ) -> anyhow::Result<()> {
        let now_str = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE session_metadata SET summary = ?1, updated_at = ?2 WHERE thread_id = ?3",
        )
        .bind(title)
        .bind(&now_str)
        .bind(conv_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Delete a conversation from session_metadata.
    pub async fn delete_conversation(&self, conv_id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM session_metadata WHERE thread_id = ?1")
            .bind(conv_id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

}

impl DbManager {
    /// 检查指定的会话ID在数据库元数据中是否存在
    pub async fn has_conversation(&self, conv_id: &str) -> anyhow::Result<bool> {
        let row = sqlx::query("SELECT 1 FROM session_metadata WHERE thread_id = ?1")
            .bind(conv_id)
            .fetch_optional(self.pool())
            .await?;
        Ok(row.is_some())
    }
}
