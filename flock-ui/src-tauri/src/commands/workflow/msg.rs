use tauri::State;
use crate::SharedDbManager;

/// 保存工作流前端原生消息（WorkflowExecutionMessage[]），精确还原历史聊天界面
#[tauri::command]
pub async fn save_workflow_messages(
    db: State<'_, SharedDbManager>,
    thread_id: String,
    messages_json: String,
) -> Result<(), String> {
    // 用特殊 marker 包装，便于 load 时区分 agent 消息格式
    let wrapped = format!("{{\"__wf_native__\":true,\"msgs\":{}}}", messages_json);
    let updated_at = chrono::Utc::now().to_rfc3339();
    let affected = sqlx::query(
        "UPDATE session_metadata SET messages = ?1, updated_at = ?2 WHERE thread_id = ?3"
    )
    .bind(&wrapped)
    .bind(&updated_at)
    .bind(&thread_id)
    .execute(db.pool())
    .await
    .map_err(|e| e.to_string())?
    .rows_affected();

    if affected == 0 {
        // 记录不存在时 INSERT（极少情况，保险起见）
        sqlx::query(
            "INSERT OR IGNORE INTO session_metadata \
             (thread_id, provider, cwd, model, summary, messages, msg_count, created_at, updated_at, workspace_id) \
             VALUES (?1, '', '', '', '', ?2, 1, ?3, ?3, '')"
        )
        .bind(&thread_id)
        .bind(&wrapped)
        .bind(&updated_at)
        .execute(db.pool())
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 加载工作流前端原生消息格式，不存在时返回 null
#[tauri::command]
pub async fn load_workflow_messages(
    db: State<'_, SharedDbManager>,
    thread_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let row: Option<String> = sqlx::query_scalar(
        "SELECT messages FROM session_metadata WHERE thread_id = ?1"
    )
    .bind(&thread_id)
    .fetch_optional(db.pool())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(s) = row {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            if v.get("__wf_native__").and_then(|b| b.as_bool()) == Some(true) {
                return Ok(v.get("msgs").cloned());
            }
        }
    }
    Ok(None)
}
