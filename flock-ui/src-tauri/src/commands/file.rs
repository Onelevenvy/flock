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

/// 打开外部 URL
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 在工作空间中创建文件
#[tauri::command]
pub fn create_workspace_file(
    workspace_id: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    // 防逃逸校验
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    let canonical_base = std::fs::canonicalize(&base).unwrap_or(base.clone());
    if let Some(parent) = target.parent() {
        if parent.exists() {
            let canonical_parent = std::fs::canonicalize(parent).unwrap_or(parent.to_path_buf());
            if !canonical_parent.starts_with(&canonical_base) {
                return Err("非法路径访问".to_string());
            }
        }
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 在工作空间中创建文件夹
#[tauri::command]
pub fn create_workspace_directory(
    workspace_id: String,
    relative_path: String,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    // 防逃逸校验
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    let canonical_base = std::fs::canonicalize(&base).unwrap_or(base.clone());
    if let Some(parent) = target.parent() {
        if parent.exists() {
            let canonical_parent = std::fs::canonicalize(parent).unwrap_or(parent.to_path_buf());
            if !canonical_parent.starts_with(&canonical_base) {
                return Err("非法路径访问".to_string());
            }
        }
    }

    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(())
}

/// 在工作空间中上传/写入二进制文件
#[tauri::command]
pub fn upload_workspace_file(
    workspace_id: String,
    relative_path: String,
    content: Vec<u8>,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    // 防逃逸校验
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    let canonical_base = std::fs::canonicalize(&base).unwrap_or(base.clone());
    if let Some(parent) = target.parent() {
        if parent.exists() {
            let canonical_parent = std::fs::canonicalize(parent).unwrap_or(parent.to_path_buf());
            if !canonical_parent.starts_with(&canonical_base) {
                return Err("非法路径访问".to_string());
            }
        }
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 删除工作空间的文件或文件夹
#[tauri::command]
pub fn delete_workspace_file_or_dir(
    workspace_id: String,
    relative_path: String,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    // 防逃逸校验
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    let canonical_base = std::fs::canonicalize(&base).unwrap_or(base.clone());
    if target.exists() {
        let canonical_target = std::fs::canonicalize(&target).unwrap_or(target.clone());
        if !canonical_target.starts_with(&canonical_base) {
            return Err("非法路径访问".to_string());
        }

        if target.is_dir() {
            std::fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            std::fs::remove_file(&target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 下载/导出文件到本地其他目录
#[tauri::command]
pub fn download_workspace_file(
    workspace_id: String,
    relative_path: String,
    local_dest_path: String,
) -> Result<(), String> {
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    if !target.exists() {
        return Err("源文件不存在".to_string());
    }

    // 防逃逸校验（源文件必须在工作空间内）
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    let canonical_base = std::fs::canonicalize(&base).unwrap_or(base.clone());
    let canonical_target = std::fs::canonicalize(&target).unwrap_or(target.clone());
    if !canonical_target.starts_with(&canonical_base) {
        return Err("非法路径访问".to_string());
    }

    std::fs::copy(&target, &local_dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// 以 Base64 格式读取工作区中的二进制文件（通常用于绕过资产安全策略与 CSP 读取图片）
#[tauri::command]
pub fn read_workspace_file_as_base64(
    workspace_id: String,
    relative_path: String,
) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
    let target = base.join(&relative_path);

    // 防逃逸校验
    if relative_path.contains("..") {
        return Err("非法路径访问".to_string());
    }
    
    let base_exists = base.exists();
    let canonical_base = if base_exists {
        std::fs::canonicalize(&base).unwrap_or(base.clone())
    } else {
        base.clone()
    };
    
    if target.exists() {
        let canonical_target = std::fs::canonicalize(&target).unwrap_or(target.clone());
        if base_exists && !canonical_target.starts_with(&canonical_base) {
            return Err("非法路径访问".to_string());
        }

        let bytes = std::fs::read(&target).map_err(|e| e.to_string())?;
        let base64_str = general_purpose::STANDARD.encode(bytes);
        Ok(base64_str)
    } else {
        Err("文件不存在".to_string())
    }
}



