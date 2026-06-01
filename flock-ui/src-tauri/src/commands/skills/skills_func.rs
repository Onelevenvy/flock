use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::SharedDbManager;
use super::utils::{imported_skills_dir, has_skill_md, copy_dir_all};
use sqlx::Row;

const EXTRA_SKILL_DIRS_KEY: &str = "extra_skill_dirs";

/// Serializable skill info for the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub display_name: Option<String>,
    pub description: String,
    pub source: String,
    pub user_invocable: bool,
    pub execution_context: String,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub allowed_tools: Vec<String>,
    pub argument_hint: Option<String>,
    pub when_to_use: Option<String>,
    pub content_length: usize,
    pub content: String,
    pub skill_root: Option<String>,
    pub paths: Vec<String>,
}

impl From<flock_skills::types::SkillMetadata> for SkillInfo {
    fn from(m: flock_skills::types::SkillMetadata) -> Self {
        SkillInfo {
            name: m.name,
            display_name: m.display_name,
            description: m.description,
            source: format!("{:?}", m.source),
            user_invocable: m.user_invocable,
            execution_context: format!("{:?}", m.execution_context),
            model: m.model,
            effort: m.effort.map(|e| format!("{:?}", e)),
            allowed_tools: m.allowed_tools,
            argument_hint: m.argument_hint,
            when_to_use: m.when_to_use,
            content_length: m.content_length,
            content: m.content,
            skill_root: m.skill_root,
            paths: m.paths,
        }
    }
}

// SQL helper functions to operate on the dedicated `imported_skill` table
async fn db_get_imported_skills(db: &SharedDbManager) -> Result<Vec<String>, String> {
    let rows = sqlx::query("SELECT path FROM imported_skill")
        .fetch_all(db.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get("path")).collect())
}

async fn db_add_imported_skill(db: &SharedDbManager, name: &str, path: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO imported_skill (name, path) VALUES (?1, ?2)
         ON CONFLICT(name) DO UPDATE SET path = ?2"
    )
        .bind(name)
        .bind(path)
        .execute(db.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn db_remove_imported_skill(db: &SharedDbManager, path: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM imported_skill WHERE path = ?1")
        .bind(path)
        .execute(db.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Load all filesystem skills (no agent required). MCP-sourced skills are excluded
/// because they need a live McpManager connection.
///
/// Includes extra raw skill directories persisted in the DB.
#[tauri::command]
pub async fn list_skills(db: State<'_, SharedDbManager>) -> Result<Vec<SkillInfo>, String> {
    let cwd = std::env::current_dir().unwrap_or_default();
    let extra = db_get_imported_skills(&db).await?;
    let extra_raw: Vec<PathBuf> = extra.into_iter().map(PathBuf::from).collect();
    let metadata_list =
        flock_skills::loader::load_all_skills(&cwd, &[], false, None, &extra_raw).await;
    Ok(metadata_list.into_iter().map(SkillInfo::from).collect())
}

/// Get the list of imported extra skill directory paths.
#[tauri::command]
pub async fn get_extra_skill_dirs(db: State<'_, SharedDbManager>) -> Result<Vec<String>, String> {
    db_get_imported_skills(&db).await
}

/// Add an extra skill directory. Validates that the path exists and is a directory.
/// Rejects duplicates. Returns the updated list.
#[tauri::command]
pub async fn add_extra_skill_dir(
    db: State<'_, SharedDbManager>,
    path: String,
) -> Result<Vec<String>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("路径不能为空".to_string());
    }
    let p = PathBuf::from(trimmed);
    
    // Resolve imported_skills_dir first
    let imported_dir = imported_skills_dir()
        .ok_or_else(|| "无法获取导入技能目录".to_string())?;

    // If it's a file, check if it's a zip or skill archive
    if p.is_file() {
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext == "zip" || ext == "skill" {
            let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("extracted_skill");
            let dest_dir = imported_dir.join(file_stem);
            
            // Standardize path representation without needing physical existence for canonicalization
            let canonical = dest_dir.to_string_lossy().to_string();

            // 1. Try writing to Database FIRST
            db_add_imported_skill(&db, file_stem, &canonical).await?;

            // 2. Perform File System extraction
            if let Err(err) = (async {
                std::fs::create_dir_all(&dest_dir)?;
                
                // Execute tar -xf <archive> -C <dest_dir>
                let output = std::process::Command::new("tar")
                    .args(&["-xf", trimmed, "-C", &dest_dir.to_string_lossy()])
                    .output()?;
                    
                if !output.status.success() {
                    let err_msg = String::from_utf8_lossy(&output.stderr);
                    return Err(std::io::Error::new(std::io::ErrorKind::Other, err_msg.into_owned()));
                }
                
                // Check if there is SKILL.md
                if !has_skill_md(&dest_dir) {
                    // Try walking down one directory in case the zip contained a single parent folder
                    if let Ok(entries) = std::fs::read_dir(&dest_dir) {
                        let subdirs: Vec<_> = entries
                            .flatten()
                            .filter(|e| e.path().is_dir())
                            .collect();
                        if subdirs.len() == 1 && has_skill_md(&subdirs[0].path()) {
                            // If nested, we keep the database record pointing to the subdir, so update the DB!
                            let final_dir = subdirs[0].path();
                            let final_canonical = final_dir.to_string_lossy().to_string();
                            let folder_name = final_dir.file_name().and_then(|s| s.to_str()).unwrap_or(file_stem);
                            
                            // Delete the old record and add new nested record
                            let _ = db_remove_imported_skill(&db, &canonical).await;
                            db_add_imported_skill(&db, folder_name, &final_canonical).await
                                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                            return Ok(());
                        }
                    }
                    return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "未在压缩包中找到 SKILL.md 文件"));
                }
                Ok(())
            }).await {
                // ROLLBACK: Remove database entry if file extraction failed
                let _ = db_remove_imported_skill(&db, &canonical).await;
                return Err(format!("解压并配置技能失败: {}", err));
            }

            return db_get_imported_skills(&db).await;
        } else {
            return Err("仅支持选择文件夹或 .zip/.skill 格式的压缩包".to_string());
        }
    }

    if !p.is_dir() {
        return Err(format!("路径不存在或不是文件夹: {}", trimmed));
    }
    // Check it contains at least one SKILL.md (directly or in subdirs)
    if !has_skill_md(&p) {
        return Err(format!(
            "该文件夹下没有找到 SKILL.md 文件: {}",
            trimmed
        ));
    }

    let folder_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("imported_skill");
    let dest_dir = imported_dir.join(folder_name);
    let canonical = dest_dir.to_string_lossy().to_string();

    // 1. Try writing to Database FIRST
    db_add_imported_skill(&db, folder_name, &canonical).await?;

    // 2. Perform Folder Copy
    if let Err(err) = (async {
        std::fs::create_dir_all(&imported_dir)?;
        copy_dir_all(&p, &dest_dir)?;
        Ok::<(), std::io::Error>(())
    }).await {
        // ROLLBACK: Remove database entry if folder copy failed
        let _ = db_remove_imported_skill(&db, &canonical).await;
        return Err(format!("拷贝技能文件夹失败: {}", err));
    }

    db_get_imported_skills(&db).await
}

/// Remove an extra skill directory by path. Returns the updated list.
#[tauri::command]
pub async fn remove_extra_skill_dir(
    db: State<'_, SharedDbManager>,
    path: String,
) -> Result<Vec<String>, String> {
    let dirs = db_get_imported_skills(&db).await?;
        
    let p_path = PathBuf::from(&path);
    let p_canon = p_path.canonicalize().unwrap_or(p_path);
    
    let mut to_delete = Vec::new();
    
    for d in dirs {
        let d_path = PathBuf::from(&d);
        let d_canon = d_path.canonicalize().unwrap_or(d_path);
        if p_canon.starts_with(&d_canon) {
            to_delete.push(d); // Store original path to delete from DB and disk
        }
    }
    
    for d in &to_delete {
        db_remove_imported_skill(&db, d).await?;
    }

    // If any deleted directory lies inside imported_skills_dir, delete it from disk
    if let Some(imported_dir) = imported_skills_dir() {
        let imported_canon = imported_dir.canonicalize().unwrap_or(imported_dir);
        for d in to_delete {
            let d_path = PathBuf::from(&d);
            let d_canon = d_path.canonicalize().unwrap_or(d_path);
            if d_canon.starts_with(&imported_canon) && d_canon.exists() {
                let _ = std::fs::remove_dir_all(&d_canon);
            }
        }
    }

    db_get_imported_skills(&db).await
}
