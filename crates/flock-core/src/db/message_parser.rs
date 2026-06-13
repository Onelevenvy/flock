use sqlx::Row;
use super::conversations::{ChatMessage, MessageChunk};
use super::DbManager;

impl DbManager {
    /// Load conversation history (messages) for a given session/thread.
    /// Returns parsed ChatMessage chunks suitable for UI display.
    pub async fn load_conversation_messages(&self, conv_id: &str) -> anyhow::Result<Vec<ChatMessage>> {
        let cwd_row: Option<String> = sqlx::query_scalar("SELECT cwd FROM session_metadata WHERE thread_id = ?1")
            .bind(conv_id)
            .fetch_optional(self.pool())
            .await?;
        let cwd_path = cwd_row.filter(|s| !s.is_empty()).map(std::path::PathBuf::from);

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

        // Phase 1: Pre-extract all tool_result content and index by tool_use_id
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

                            // Merge corresponding tool_result into chunk.result for UI rendering
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
                        "image" => {
                            let media_type = obj.get("media_type").and_then(|v| v.as_str()).unwrap_or("image/png").to_string();
                            let data = obj.get("data").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let image_src = if data.starts_with(".flock/attachments/") {
                                if let Some(ref cwd_p) = cwd_path {
                                    let full_path = cwd_p.join(&data);
                                    if let Ok(bytes) = std::fs::read(&full_path) {
                                        use base64::Engine;
                                        let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                        format!("data:{};base64,{}", media_type, base64_str)
                                    } else {
                                        format!("data:{};base64,", media_type)
                                    }
                                } else {
                                    format!("data:{};base64,", media_type)
                                }
                            } else {
                                if data.starts_with("data:") {
                                    data
                                } else {
                                    format!("data:{};base64,{}", media_type, data)
                                }
                            };
                            chunks.push(MessageChunk {
                                kind: "image".to_string(),
                                text: Some(image_src),
                                call_id: None,
                                tool: None,
                                status: None,
                                result: None,
                            });
                        }
                        _ => {}
                    }
                }
            }

            let has_visible_content = chunks
                .iter()
                .any(|c| matches!(c.kind.as_str(), "text" | "thinking" | "tool_request" | "image"));

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
