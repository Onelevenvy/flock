use tauri::State;
use crate::SharedDbManager;
use flock_core::db::{UpsertWorkflow, WorkflowRecord, WorkflowVersionRecord};

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

/// 发布工作流 (发布草稿版配置为正式版本)
#[tauri::command]
pub async fn publish_workflow(
    db: State<'_, SharedDbManager>,
    id: String,
    version: String,
    description: Option<String>,
) -> Result<WorkflowRecord, String> {
    db.publish_workflow(&id, &version, description.as_deref()).await.map_err(|e| e.to_string())
}

/// 获取某个工作流的所有历史版本
#[tauri::command]
pub async fn list_workflow_versions(
    db: State<'_, SharedDbManager>,
    workflow_id: String,
) -> Result<Vec<WorkflowVersionRecord>, String> {
    db.list_workflow_versions(&workflow_id).await.map_err(|e| e.to_string())
}

/// 将当前草稿配置回退到历史版本配置
#[tauri::command]
pub async fn rollback_workflow_draft(
    db: State<'_, SharedDbManager>,
    workflow_id: String,
    version_id: String,
) -> Result<WorkflowRecord, String> {
    db.rollback_workflow_draft(&workflow_id, &version_id).await.map_err(|e| e.to_string())
}

/// 切换当前已发布（在线）的版本配置为指定历史版本配置
#[tauri::command]
pub async fn switch_workflow_production(
    db: State<'_, SharedDbManager>,
    workflow_id: String,
    version_id: String,
) -> Result<WorkflowRecord, String> {
    db.switch_workflow_production(&workflow_id, &version_id).await.map_err(|e| e.to_string())
}
