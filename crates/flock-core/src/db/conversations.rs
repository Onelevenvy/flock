use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationInfo {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub model: Option<String>,
    pub message_count: usize,
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
            "SELECT thread_id, model, summary, msg_count, updated_at, workspace_id
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
            });
        }

        Ok(conversations)
    }

    /// Create a new conversation entry in session_metadata.
    pub async fn create_conversation(
        &self,
        workspace_id: &str,
        title: &str,
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
             (thread_id, provider, cwd, model, summary, messages, msg_count, created_at, updated_at, workspace_id)
             VALUES (?1, '', '', '', ?2, '[]', 0, ?3, ?3, ?4)",
        )
        .bind(&id)
        .bind(&display_title)
        .bind(&now_str)
        .bind(workspace_id)
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

    /// Load conversation history (messages) for a given session/thread.
    /// Returns parsed ChatMessage chunks suitable for UI display.
    pub async fn load_conversation_messages(&self, conv_id: &str) -> anyhow::Result<Vec<ChatMessage>> {
        let row = sqlx::query("SELECT messages FROM session_metadata WHERE thread_id = ?1")
            .bind(conv_id)
            .fetch_optional(self.pool())
            .await?;

        let row = match row {
            Some(r) => r,
            None => return Ok(vec![]),
        };

        let messages_json: String = row.get("messages");
        let session_messages: Vec<serde_json::Value> =
            serde_json::from_str(&messages_json).unwrap_or_default();

        // 1. 第一阶段扫描：预提取所有的 tool_result 内容并通过 tool_use_id 进行索引建立
        let mut tool_results = std::collections::HashMap::new();
        for msg in &session_messages {
            if let Some(msg_obj) = msg.as_object() {
                if let Some(content) = msg_obj.get("content").and_then(|v| v.as_array()) {
                    for part in content {
                        if let Some(part_obj) = part.as_object() {
                            let p_type = part_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if p_type == "tool_result" {
                                if let (Some(tool_use_id), Some(content_val)) = (
                                    part_obj.get("tool_use_id").and_then(|v| v.as_str()),
                                    part_obj.get("content").and_then(|v| v.as_str()),
                                ) {
                                    tool_results.insert(tool_use_id.to_string(), content_val.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        let mut messages = Vec::new();

        for (idx, msg) in session_messages.into_iter().enumerate() {
            let msg_obj = match msg.as_object() {
                Some(o) => o,
                None => continue,
            };

            let role_raw = msg_obj.get("role").and_then(|v| v.as_str()).unwrap_or("");
            let role = match role_raw {
                "human" | "user" => "user",
                "ai" | "assistant" => "assistant",
                _ => role_raw,
            };

            let content = msg_obj
                .get("content")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let mut chunks = Vec::new();
            for part in content {
                if let Some(obj) = part.as_object() {
                    let p_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    match p_type {
                        "text" => {
                            chunks.push(MessageChunk {
                                kind: "text".to_string(),
                                text: obj.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                call_id: None,
                                tool: None,
                                status: None,
                                result: None,
                            });
                        }
                        "thinking" => {
                            chunks.push(MessageChunk {
                                kind: "thinking".to_string(),
                                text: obj
                                    .get("thinking")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                call_id: None,
                                tool: None,
                                status: None,
                                result: None,
                            });
                        }
                        "tool_use" => {
                            let name = obj
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string();
                            let args = obj
                                .get("input")
                                .cloned()
                                .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

                            let tool_info = serde_json::json!({
                                "name": name,
                                "args": args,
                                "category": "exec",
                                "description": ""
                            });

                            let cid = obj
                                .get("id")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());

                            // 将对应的 tool_result 合并进 chunk.result 供前端渲染及回放提取
                            let result_content = cid.as_ref().and_then(|id| tool_results.get(id).cloned());

                            chunks.push(MessageChunk {
                                kind: "tool_request".to_string(),
                                text: None,
                                call_id: cid,
                                tool: Some(tool_info),
                                status: Some("done".to_string()),
                                result: result_content,
                            });
                        }
                        "tool_result" => {
                            chunks.push(MessageChunk {
                                kind: "tool_result".to_string(),
                                text: None,
                                call_id: obj
                                    .get("tool_use_id")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                tool: None,
                                status: Some("done".to_string()),
                                result: obj
                                    .get("content")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                            });
                        }
                        _ => {}
                    }
                }
            }

            let has_visible_content = chunks
                .iter()
                .any(|c| matches!(c.kind.as_str(), "text" | "thinking" | "tool_request"));

            if !has_visible_content || role == "tool" {
                continue;
            }

            let timestamp = msg_obj
                .get("timestamp")
                .and_then(|v| v.as_str())
                .map(parse_rfc3339_to_secs)
                .unwrap_or(0);

            messages.push(ChatMessage {
                id: format!("{}_{}", conv_id, idx),
                role: role.to_string(),
                chunks,
                timestamp,
            });
        }

        Ok(messages)
    }
}

/// Parse an RFC 3339 timestamp string to seconds since epoch.
pub fn parse_rfc3339_to_secs(ts: &str) -> u64 {
    if ts.is_empty() {
        return 0;
    }
    let ts_clean = ts.split('+').next().unwrap_or(ts);
    let ts_clean = ts_clean.split('Z').next().unwrap_or(ts_clean);
    if let Some(dt) = chrono::NaiveDateTime::parse_from_str(ts_clean, "%Y-%m-%dT%H:%M:%S").ok() {
        dt.and_utc().timestamp() as u64
    } else if let Some(dt) = chrono::NaiveDateTime::parse_from_str(ts_clean, "%Y-%m-%dT%H:%M:%S%.f").ok() {
        dt.and_utc().timestamp() as u64
    } else {
        0
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
