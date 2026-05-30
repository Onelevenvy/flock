use tauri::State;
use crate::SharedDbManager;
use flock_core::db::{UpsertWorkflow, WorkflowRecord};

/// 列出所有工作流
#[tauri::command]
pub async fn list_workflows(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<WorkflowRecord>, String> {
    db.list_workflows().await.map_err(|e| e.to_string())
}

/// 获取单个工作流
#[tauri::command]
pub async fn get_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<Option<WorkflowRecord>, String> {
    db.get_workflow(&id).await.map_err(|e| e.to_string())
}

/// 创建工作流
#[tauri::command]
pub async fn create_workflow(
    db: State<'_, SharedDbManager>,
    input: UpsertWorkflow,
) -> Result<WorkflowRecord, String> {
    db.create_workflow(&input).await.map_err(|e| e.to_string())
}

/// 更新工作流配置（节点、边等）
#[tauri::command]
pub async fn update_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
    input: UpsertWorkflow,
) -> Result<WorkflowRecord, String> {
    db.update_workflow(&id, &input)
        .await
        .map_err(|e| e.to_string())
}

/// 删除工作流
#[tauri::command]
pub async fn delete_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_workflow(&id).await.map_err(|e| e.to_string())
}
