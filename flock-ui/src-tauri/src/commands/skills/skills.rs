use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::SharedDbManager;

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

    let mut dirs: Vec<String> = db
        .get_config(EXTRA_SKILL_DIRS_KEY)
        .await
        .unwrap_or_default();
    let canonical = p
        .canonicalize()
        .map(|c| c.to_string_lossy().into_owned())
        .unwrap_or_else(|_| trimmed.to_string());
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
    dirs.retain(|d| d != &path);
    db.set_config(EXTRA_SKILL_DIRS_KEY, &dirs)
        .await
        .map_err(|e| e.to_string())?;
    Ok(dirs)
}

/// Check if a directory contains SKILL.md files (directly or in immediate subdirectories).
fn has_skill_md(dir: &std::path::Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name == "SKILL.md" {
                return true;
            }
            if entry.path().is_dir() {
                if entry.path().join("SKILL.md").exists() {
                    return true;
                }
            }
        }
    }
    false
}
