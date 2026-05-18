use crate::workspace;

/// 列出工作空间文件
#[tauri::command]
pub fn list_workspace_files(
    workspace_id: String,
    relative_path: String,
    recursive: bool,
) -> Result<Vec<workspace::FileEntry>, String> {
    workspace::list_files(&workspace_id, &relative_path, recursive).map_err(|e| e.to_string())
}

/// 读取文件内容（预览）
#[tauri::command]
pub fn read_workspace_file(
    workspace_id: String,
    relative_path: String,
) -> Result<String, String> {
    workspace::read_file_content(&workspace_id, &relative_path).map_err(|e| e.to_string())
}

/// 获取工作空间文件的绝对路径
#[tauri::command]
pub fn get_workspace_file_absolute_path(
    workspace_id: String,
    relative_path: String,
) -> Result<String, String> {
    let base = flock_core::config::db_path::workspace_root().join(workspace_id);
    let target = base.join(relative_path);
    Ok(target.to_string_lossy().to_string())
}

/// 在系统默认应用中打开工作空间文件
#[tauri::command]
pub fn open_workspace_file_in_system(
    workspace_id: String,
    relative_path: String,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(workspace_id);
    let target = base.join(relative_path);
    if !target.exists() {
        return Err("文件不存在".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &target.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

