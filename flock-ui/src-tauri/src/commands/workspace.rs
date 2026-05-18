use crate::workspace;

/// 获取工作空间根目录
#[tauri::command]
pub fn get_workspace_root() -> String {
    flock_core::config::db_path::workspace_root().to_string_lossy().to_string()
}

/// 列出所有工作空间
#[tauri::command]
pub fn list_workspaces() -> Result<Vec<workspace::WorkspaceInfo>, String> {
    workspace::list_workspaces().map_err(|e| e.to_string())
}

/// 创建工作空间
#[tauri::command]
pub fn create_workspace(name: String) -> Result<workspace::WorkspaceInfo, String> {
    workspace::create_workspace(&name).map_err(|e| e.to_string())
}

/// 删除工作空间
#[tauri::command]
pub fn delete_workspace(id: String) -> Result<(), String> {
    workspace::delete_workspace(&id).map_err(|e| e.to_string())
}
