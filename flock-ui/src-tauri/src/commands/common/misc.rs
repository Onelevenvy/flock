use std::path::PathBuf;
use serde_json::Value as JsonValue;
use tauri::{AppHandle, State, Emitter};
use crate::commands::assistant::SharedAgentState;

/// Ping Agent
#[tauri::command]
pub async fn ping_agent(_state: State<'_, SharedAgentState>) -> Result<(), String> {
    Ok(())
}

/// 获取 flock 可执行路径
#[tauri::command]
pub async fn get_flock_path(_state: State<'_, SharedAgentState>) -> Result<String, String> {
    Ok("integrated".to_string())
}

/// 解析工作空间环境、更新对话标题、设定当前工作路径并初始化工具工作目录
pub async fn resolve_workspace_env(
    db: &flock_core::db::DbManager,
    thread_id: &str,
    input: Option<&str>,
    app: Option<&AppHandle>,
) -> Result<PathBuf, String> {
    let mut final_workdir: Option<PathBuf> = None;
    let row = sqlx::query("SELECT workspace_id, cwd, summary FROM session_metadata WHERE thread_id = ?1")
        .bind(thread_id)
        .fetch_optional(db.pool())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(r) = row {
        use sqlx::Row;
        let workspace_id: String = r.get("workspace_id");
        let cwd: String = r.get("cwd");
        let existing_summary: String = r.get("summary");
        
        let is_placeholder = |s: &str| {
            let s = s.trim();
            if s.starts_with("对话") {
                let rest = s.strip_prefix("对话").unwrap().trim();
                if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
                    return true;
                }
            }
            if s.starts_with("Session") {
                let rest = s.strip_prefix("Session").unwrap().trim();
                if !rest.is_empty() && (rest.chars().all(|c| c.is_ascii_digit() || c == '_' || c == '-') || rest.starts_with("conv_")) {
                    return true;
                }
            }
            false
        };

        // 实时更新：如果当前是占位标题，且此次有首次输入的 input，立刻将标题修改并通知前端
        if let Some(input_str) = input {
            if !input_str.is_empty() && (existing_summary.is_empty() || is_placeholder(&existing_summary)) {
                let mut title_to_use = input_str.to_string();
                
                // 智能解包 JSON 结构
                if let Ok(parsed_json) = serde_json::from_str::<JsonValue>(&title_to_use) {
                    if let Some(obj) = parsed_json.as_object() {
                        let found_val = obj.get("query")
                            .or_else(|| obj.get("q"))
                            .or_else(|| obj.get("input"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        
                        if let Some(val) = found_val {
                            title_to_use = val;
                        } else if let Some((_, first_val)) = obj.iter().next() {
                            if let Some(s) = first_val.as_str() {
                                title_to_use = s.to_string();
                            } else {
                                title_to_use = first_val.to_string();
                            }
                        }
                    }
                }

                if title_to_use.chars().count() > 80 {
                    let truncated: String = title_to_use.chars().take(77).collect();
                    title_to_use = format!("{}...", truncated);
                }
                
                let _ = sqlx::query("UPDATE session_metadata SET summary = ?1 WHERE thread_id = ?2")
                    .bind(&title_to_use)
                    .bind(thread_id)
                    .execute(db.pool())
                    .await;

                if let Some(app_handle) = app {
                    let title_updated_event = serde_json::json!({
                        "type": "title_updated",
                        "thread_id": thread_id.to_string(),
                        "title": title_to_use,
                    });
                    let _ = app_handle.emit("agent-event", serde_json::to_string(&title_updated_event).unwrap_or_default()).ok();
                }
            }
        }

        let workdir = if !cwd.is_empty() {
            PathBuf::from(cwd)
        } else if !workspace_id.is_empty() {
            flock_core::config::db_path::workspace_root().join(workspace_id)
        } else {
            PathBuf::new()
        };
        if workdir.exists() && workdir.as_os_str().len() > 0 {
            final_workdir = Some(workdir);
        }
    }

    let workdir = if let Some(wd) = final_workdir {
        wd
    } else {
        let debug_dir = flock_core::config::db_path::workspace_root().join("debug");
        if !debug_dir.exists() {
            let _ = std::fs::create_dir_all(&debug_dir);
        }
        debug_dir
    };

    if workdir.exists() {
        flock_tools::init_workspace_dir(thread_id, workdir.clone());
        if let Err(e) = std::env::set_current_dir(&workdir) {
            log::warn!("Failed to set current dir to {:?}: {}", workdir, e);
        } else {
            log::info!("Successfully set current dir and initialized workspace to {:?}", workdir);
        }
    }

    Ok(workdir)
}
