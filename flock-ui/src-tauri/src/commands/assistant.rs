use tauri::State;

use crate::SharedDbManager;
use flock_core::db::{AssistantRecord, UpsertAssistant};

/// 列出所有助手（内置 + 用户创建）
#[tauri::command]
pub async fn list_assistants(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<AssistantRecord>, String> {
    db.list_assistants().await.map_err(|e| e.to_string())
}

/// 创建新助手
#[tauri::command]
pub async fn create_assistant(
    db: State<'_, SharedDbManager>,
    input: UpsertAssistant,
) -> Result<AssistantRecord, String> {
    db.create_assistant(&input).await.map_err(|e| e.to_string())
}

/// 更新助手
#[tauri::command]
pub async fn update_assistant(
    db: State<'_, SharedDbManager>,
    id: String,
    input: UpsertAssistant,
) -> Result<AssistantRecord, String> {
    db.update_assistant(&id, &input).await.map_err(|e| e.to_string())
}

/// 删除助手（内置助手不可删除，由 DB 层保证）
#[tauri::command]
pub async fn delete_assistant(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_assistant(&id).await.map_err(|e| e.to_string())
}
