use tauri::State;
use flock_core::types::message::{ContentBlock, Message, Role};

use crate::workspace;
use crate::SharedDbManager;

#[derive(serde::Deserialize)]
pub struct FrontendMessageChunk {
    kind: String,
    text: Option<String>,
    call_id: Option<String>,
    tool: Option<serde_json::Value>,
    result: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct FrontendChatMessage {
    role: String,
    chunks: Vec<FrontendMessageChunk>,
    timestamp: Option<i64>,
}

/// 保存对话前端消息（ChatMessage[]），同步持久化到 SQLite 数据库中，保持与 workflow_messages 类似的统一机制
#[tauri::command]
pub async fn save_conversation_messages(
    db: State<'_, SharedDbManager>,
    conv_id: String,
    messages: Vec<FrontendChatMessage>,
) -> Result<(), String> {
    let cwd_row: Option<String> = sqlx::query_scalar("SELECT cwd FROM session_metadata WHERE thread_id = ?1")
        .bind(&conv_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| e.to_string())?;
    let cwd_path = cwd_row.filter(|s| !s.is_empty()).map(std::path::PathBuf::from);

    let mut db_messages: Vec<Message> = Vec::new();

    for m in messages {
        let role = match m.role.as_str() {
            "user" => Role::User,
            "assistant" => Role::Assistant,
            "system" => Role::System,
            "tool" => Role::Tool,
            _ => Role::User,
        };

        let mut content_blocks = Vec::new();
        let mut tool_results_to_append = Vec::new();

        for chunk in m.chunks {
            match chunk.kind.as_str() {
                "text" => {
                    if let Some(txt) = chunk.text {
                        content_blocks.push(ContentBlock::Text { text: txt });
                    }
                }
                "thinking" => {
                    if let Some(thinking) = chunk.text {
                        content_blocks.push(ContentBlock::Thinking { thinking });
                    }
                }
                "image" => {
                    if let Some(ref data) = chunk.text {
                        if data.starts_with(".flock/attachments/") {
                            content_blocks.push(ContentBlock::Image {
                                media_type: "image/png".to_string(),
                                data: data.clone(),
                            });
                        } else if let Some(ref cwd_p) = cwd_path {
                            let (media_type, base64_data) = if data.starts_with("data:") {
                                if let Some(comma_idx) = data.find(',') {
                                    let header = &data[..comma_idx];
                                    let base64_part = &data[comma_idx + 1..];
                                    let mime = header.strip_prefix("data:")
                                        .and_then(|h| h.strip_suffix(";base64"))
                                        .unwrap_or("image/png");
                                    (mime.to_string(), base64_part.to_string())
                                } else {
                                    ("image/png".to_string(), data.clone())
                                }
                            } else {
                                ("image/png".to_string(), data.clone())
                            };

                            if let Ok(bytes) = base64::Engine::decode(
                                &base64::engine::general_purpose::STANDARD,
                                base64_data.trim(),
                            ) {
                                let ext = match media_type.as_str() {
                                    "image/jpeg" | "image/jpg" => "jpg",
                                    "image/gif" => "gif",
                                    "image/webp" => "webp",
                                    _ => "png",
                                };
                                let unique_filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
                                let relative_dir = std::path::Path::new(".flock")
                                    .join("attachments")
                                    .join(&conv_id);
                                let absolute_dir = cwd_p.join(&relative_dir);

                                if let Err(e) = std::fs::create_dir_all(&absolute_dir) {
                                    log::error!("Failed to create attachments dir: {:?}", e);
                                }
                                let absolute_file = absolute_dir.join(&unique_filename);
                                if let Err(e) = std::fs::write(&absolute_file, &bytes) {
                                    log::error!("Failed to write image attachment to disk: {:?}", e);
                                }

                                let db_relative_path = relative_dir.join(&unique_filename)
                                    .to_string_lossy()
                                    .to_string();

                                content_blocks.push(ContentBlock::Image {
                                    media_type,
                                    data: db_relative_path,
                                });
                            }
                        } else {
                            content_blocks.push(ContentBlock::Image {
                                media_type: "image/png".to_string(),
                                data: data.clone(),
                            });
                        }
                    }
                }
                "tool_request" => {
                    if let Some(ref cid) = chunk.call_id {
                        let name = chunk.tool.as_ref()
                            .and_then(|t| t.get("name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let input = chunk.tool.as_ref()
                            .and_then(|t| t.get("args"))
                            .cloned()
                            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

                        content_blocks.push(ContentBlock::ToolUse {
                            id: cid.clone(),
                            name,
                            input,
                        });

                        if let Some(res) = chunk.result {
                            tool_results_to_append.push(ContentBlock::ToolResult {
                                tool_use_id: cid.clone(),
                                content: res,
                                is_error: false,
                            });
                        }
                    }
                }
                _ => {}
            }
        }

        let timestamp = m.timestamp.map(|t| {
            chrono::DateTime::from_timestamp(t / 1000, ((t % 1000) * 1_000_000) as u32)
                .unwrap_or_else(|| chrono::Utc::now())
        });

        db_messages.push(Message {
            role,
            content: content_blocks,
            timestamp,
        });

        if !tool_results_to_append.is_empty() {
            db_messages.push(Message {
                role: Role::Tool,
                content: tool_results_to_append,
                timestamp,
            });
        }
    }

    let messages_json = serde_json::to_string(&db_messages).map_err(|e| e.to_string())?;
    let updated_at = chrono::Utc::now().to_rfc3339();
    let msg_count = db_messages.len();

    sqlx::query(
        "UPDATE session_metadata SET messages = ?1, msg_count = ?2, updated_at = ?3 WHERE thread_id = ?4"
    )
    .bind(&messages_json)
    .bind(msg_count as i64)
    .bind(&updated_at)
    .bind(&conv_id)
    .execute(db.pool())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 列出工作空间下的对话
#[tauri::command]
pub async fn list_conversations(
    db: State<'_, SharedDbManager>,
    workspace_id: String,
) -> Result<Vec<flock_core::db::ConversationInfo>, String> {
    workspace::list_conversations(&db, &workspace_id).await.map_err(|e| e.to_string())
}

/// 创建对话
#[tauri::command]
pub async fn create_conversation(
    db: State<'_, SharedDbManager>,
    workspace_id: String,
    title: String,
    assistant_id: Option<String>,
) -> Result<workspace::ConversationInfo, String> {
    workspace::create_conversation(&db, &workspace_id, &title, assistant_id).await.map_err(|e| e.to_string())
}

/// 更新对话标题
#[tauri::command]
pub async fn update_conversation_title(
    db: State<'_, SharedDbManager>,
    _workspace_id: String,
    conv_id: String,
    title: String,
) -> Result<(), String> {
    workspace::update_conversation_title(&db, &conv_id, &title)
        .await
        .map_err(|e| e.to_string())
}

/// 删除对话
#[tauri::command]
pub async fn delete_conversation(
    db: State<'_, SharedDbManager>,
    _workspace_id: String,
    conv_id: String,
) -> Result<(), String> {
    workspace::delete_conversation(&db, &conv_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_conversation_history(
    db: State<'_, SharedDbManager>,
    _workspace_id: String,
    conv_id: String,
) -> Result<Vec<flock_core::db::ChatMessage>, String> {
    workspace::load_conversation_history(&db, &conv_id).await.map_err(|e| e.to_string())
}
