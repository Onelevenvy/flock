use tauri::State;

use crate::workspace;
use crate::SharedDbManager;

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
) -> Result<workspace::ConversationInfo, String> {
    workspace::create_conversation(&db, &workspace_id, &title).await.map_err(|e| e.to_string())
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
