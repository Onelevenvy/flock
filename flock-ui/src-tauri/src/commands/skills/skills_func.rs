use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::SharedDbManager;
use super::utils::{imported_skills_dir, has_skill_md, copy_dir_all};

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

/// Load all filesystem skills (no agent required). MCP-sourced skills are excluded
/// because they need a live McpManager connection.
///
/// Includes extra raw skill directories persisted in the DB.
#[tauri::command]
pub async fn list_skills(db: State<'_, SharedDbManager>) -> Result<Vec<SkillInfo>, String> {
    let cwd = std::env::current_dir().unwrap_or_default();
    let extra: Vec<String> = db
        .get_config(EXTRA_SKILL_DIRS_KEY)
        .await
        .unwrap_or_default();
    let extra_raw: Vec<PathBuf> = extra.into_iter().map(PathBuf::from).collect();
    let metadata_list =
        flock_skills::loader::load_all_skills(&cwd, &[], false, None, &extra_raw).await;
    Ok(metadata_list.into_iter().map(SkillInfo::from).collect())
}

/// Get the list of imported extra skill directory paths.
#[tauri::command]
pub async fn get_extra_skill_dirs(db: State<'_, SharedDbManager>) -> Result<Vec<String>, String> {
    Ok(db
        .get_config(EXTRA_SKILL_DIRS_KEY)
        .await
        .unwrap_or_default())
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
    
    // If it's a file, check if it's a zip or skill archive
    if p.is_file() {
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext == "zip" || ext == "skill" {
            // Extract to imported_skills_dir
            let imported_dir = imported_skills_dir()
                .ok_or_else(|| "无法获取导入技能目录".to_string())?;
            std::fs::create_dir_all(&imported_dir).map_err(|e| e.to_string())?;
            
            let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("extracted_skill");
            let dest_dir = imported_dir.join(file_stem);
            std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
            
            // Execute tar -xf <archive> -C <dest_dir>
            let output = std::process::Command::new("tar")
                .args(&["-xf", trimmed, "-C", &dest_dir.to_string_lossy()])
                .output()
                .map_err(|e| format!("解压失败 (tar 执行出错): {}", e))?;
                
            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr);
                return Err(format!("解压失败: {}", err_msg));
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
                        let final_dir = subdirs[0].path();
                        let canonical = final_dir.canonicalize()
                            .map(|c| c.to_string_lossy().into_owned())
                            .unwrap_or_else(|_| final_dir.to_string_lossy().to_string());
                        
                        let mut dirs: Vec<String> = db.get_config(EXTRA_SKILL_DIRS_KEY).await.unwrap_or_default();
                        if !dirs.contains(&canonical) {
                            dirs.push(canonical);
                            db.set_config(EXTRA_SKILL_DIRS_KEY, &dirs).await.map_err(|e| e.to_string())?;
                        }
                        return Ok(dirs);
                    }
                }
                return Err("解压成功，但未在压缩包中找到 SKILL.md 文件".to_string());
            }
            
            let canonical = dest_dir.canonicalize()
                .map(|c| c.to_string_lossy().into_owned())
                .unwrap_or_else(|_| dest_dir.to_string_lossy().to_string());
                
            let mut dirs: Vec<String> = db.get_config(EXTRA_SKILL_DIRS_KEY).await.unwrap_or_default();
            if !dirs.contains(&canonical) {
                dirs.push(canonical);
                db.set_config(EXTRA_SKILL_DIRS_KEY, &dirs).await.map_err(|e| e.to_string())?;
            }
            return Ok(dirs);
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

    // Copy directory recursively to imported_skills_dir to keep it self-contained
    let imported_dir = imported_skills_dir()
        .ok_or_else(|| "无法获取导入技能目录".to_string())?;
    std::fs::create_dir_all(&imported_dir).map_err(|e| e.to_string())?;

    let folder_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("imported_skill");
    let dest_dir = imported_dir.join(folder_name);
    
    copy_dir_all(&p, &dest_dir).map_err(|e| format!("拷贝技能文件夹失败: {}", e))?;

    let mut dirs: Vec<String> = db
        .get_config(EXTRA_SKILL_DIRS_KEY)
        .await
        .unwrap_or_default();
    let canonical = dest_dir
        .canonicalize()
        .map(|c| c.to_string_lossy().into_owned())
        .unwrap_or_else(|_| dest_dir.to_string_lossy().to_string());
        
    if dirs.iter().any(|d| d == &canonical) {
        return Err("该路径已经导入过了".to_string());
    }
    dirs.push(canonical);
    db.set_config(EXTRA_SKILL_DIRS_KEY, &dirs)
        .await
        .map_err(|e| e.to_string())?;
    Ok(dirs)
}

/// Remove an extra skill directory by path. Returns the updated list.
#[tauri::command]
pub async fn remove_extra_skill_dir(
    db: State<'_, SharedDbManager>,
    path: String,
) -> Result<Vec<String>, String> {
    let mut dirs: Vec<String> = db
        .get_config(EXTRA_SKILL_DIRS_KEY)
        .await
        .unwrap_or_default();
        
    let p_path = PathBuf::from(&path);
    let p_canon = p_path.canonicalize().unwrap_or(p_path);
    
    let mut to_delete = Vec::new();
    
    dirs.retain(|d| {
        let d_path = PathBuf::from(d);
        let d_canon = d_path.canonicalize().unwrap_or(d_path);
        if p_canon.starts_with(&d_canon) {
            to_delete.push(d_canon);
            false // Remove from db
        } else {
            true // Keep in db
        }
    });
    
    db.set_config(EXTRA_SKILL_DIRS_KEY, &dirs)
        .await
        .map_err(|e| e.to_string())?;

    // If any deleted directory lies inside imported_skills_dir, delete it from disk
    if let Some(imported_dir) = imported_skills_dir() {
        let imported_canon = imported_dir.canonicalize().unwrap_or(imported_dir);
        for d in to_delete {
            if d.starts_with(&imported_canon) && d.exists() {
                let _ = std::fs::remove_dir_all(&d);
            }
        }
    }

    Ok(dirs)
}
