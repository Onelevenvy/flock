use crate::workspace;
use flock_core::db::DbManager;
use flock_tools::daytona::{get_active_sandbox_id, fs::DaytonaFs};
use std::path::PathBuf;

async fn is_sandbox_active(db: &crate::SharedDbManager) -> bool {
    get_active_sandbox_id().await.is_some()
}

/// 列出工作空间文件
#[tauri::command]
pub async fn list_workspace_files(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
    recursive: bool,
) -> Result<Vec<workspace::FileEntry>, String> {
    if is_sandbox_active(&db).await {
        let entries = DaytonaFs::list_files(&db, &relative_path, recursive)
            .await
            .map_err(|e| e.to_string())?;
        
        let mapped_entries = entries.into_iter().map(|e| map_daytona_entry(e)).collect();
        Ok(mapped_entries)
    } else {
        workspace::list_files(&workspace_id, &relative_path, recursive).map_err(|e| e.to_string())
    }
}

fn map_daytona_entry(entry: flock_tools::daytona::fs::DaytonaFileEntry) -> workspace::FileEntry {
    workspace::FileEntry {
        name: entry.name,
        path: entry.path,
        is_dir: entry.is_dir,
        size: entry.size,
        extension: entry.extension,
        children: entry.children.map(|c| c.into_iter().map(map_daytona_entry).collect()),
    }
}

/// 读取文件内容（预览）
#[tauri::command]
pub async fn read_workspace_file(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
) -> Result<String, String> {
    if is_sandbox_active(&db).await {
        DaytonaFs::read_file(&db, &relative_path).await.map_err(|e| e.to_string())
    } else {
        workspace::read_file_content(&workspace_id, &relative_path).map_err(|e| e.to_string())
    }
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
pub async fn create_workspace_file(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    if is_sandbox_active(&db).await {
        DaytonaFs::write_file(&db, &relative_path, &content).await.map_err(|e| e.to_string())
    } else {
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
}

/// 在工作空间中创建文件夹
#[tauri::command]
pub async fn create_workspace_directory(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
) -> Result<(), String> {
    if is_sandbox_active(&db).await {
        DaytonaFs::create_dir(&db, &relative_path).await.map_err(|e| e.to_string())
    } else {
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
}

/// 在工作空间中上传/写入二进制文件
#[tauri::command]
pub async fn upload_workspace_file(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
    content: Vec<u8>,
) -> Result<(), String> {
    if is_sandbox_active(&db).await {
        DaytonaFs::upload_file(&db, &relative_path, &content).await.map_err(|e| e.to_string())
    } else {
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
}

/// 删除工作空间的文件或文件夹
#[tauri::command]
pub async fn delete_workspace_file_or_dir(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
) -> Result<(), String> {
    if is_sandbox_active(&db).await {
        // 1. 删除沙盒远端文件
        DaytonaFs::delete_path(&db, &relative_path).await.map_err(|e| e.to_string())?;

        // 2. 必须同步删掉本地文件，防止本地存留的文件在下一次 sync_up 时反向“诈尸”写回沙盒！
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
    } else {
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
}

/// 下载/导出文件到本地其他目录
#[tauri::command]
pub async fn download_workspace_file(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
    local_dest_path: String,
) -> Result<(), String> {
    if is_sandbox_active(&db).await {
        let content = DaytonaFs::read_file_base64(&db, &relative_path).await.map_err(|e| e.to_string())?;
        use base64::{Engine as _, engine::general_purpose};
        let bytes = general_purpose::STANDARD.decode(content.trim()).map_err(|e| e.to_string())?;
        std::fs::write(&local_dest_path, bytes).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

        if !target.exists() {
            return Err("源文件不存在".to_string());
        }

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
}

/// 以 Base64 格式读取工作区中的二进制文件（通常用于绕过资产安全策略与 CSP 读取图片）
#[tauri::command]
pub async fn read_workspace_file_as_base64(
    db: tauri::State<'_, crate::SharedDbManager>,
    workspace_id: String,
    relative_path: String,
) -> Result<String, String> {
    // 对于截屏等已经在宿主机缓存的文件，直接从宿主机读取
    let is_screenshot = relative_path.starts_with(".flock/sandbox/screenshot");
    
    if is_sandbox_active(&db).await && !is_screenshot {
        DaytonaFs::read_file_base64(&db, &relative_path).await.map_err(|e| e.to_string())
    } else {
        use base64::{Engine as _, engine::general_purpose};
        
        let base = flock_core::config::db_path::workspace_root().join(&workspace_id);
        let target = base.join(&relative_path);

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
}
