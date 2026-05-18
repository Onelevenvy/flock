use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use flock_core::config::db_path;

/// 工作空间根目录（可配置，优先读 FLOCK_WORKSPACE_ROOT 环境变量）
fn workspace_root() -> PathBuf {
    db_path::workspace_root()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
    pub children: Option<Vec<FileEntry>>,
}

// Re-export conversation types for backward compatibility.
pub use flock_core::db::{ChatMessage, ConversationInfo};

/// 确保工作空间根目录存在，并在第一次启动（尚无工作区）时自动创建默认工作空间
pub fn ensure_root() -> std::io::Result<()> {
    let root = workspace_root();
    if !root.exists() {
        fs::create_dir_all(&root)?;
    }

    // 检查是否已有工作区，若无则创建一个名为 "default" 的默认工作区
    if let Ok(entries) = fs::read_dir(&root) {
        let mut has_workspaces = false;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if !name.starts_with('.') {
                        has_workspaces = true;
                        break;
                    }
                }
            }
        }
        if !has_workspaces {
            let default_ws = root.join("default");
            if !default_ws.exists() {
                fs::create_dir_all(&default_ws)?;
            }
        }
    }
    Ok(())
}

/// 获取所有工作空间
pub fn list_workspaces() -> anyhow::Result<Vec<WorkspaceInfo>> {
    ensure_root()?;
    let root = workspace_root();
    let mut workspaces = Vec::new();

    if let Ok(entries) = fs::read_dir(&root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                if name.starts_with('.') {
                    continue;
                }
                let meta = fs::metadata(&path).ok();
                let created_at = meta
                    .and_then(|m| m.created().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                workspaces.push(WorkspaceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    created_at,
                });
            }
        }
    }

    workspaces.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(workspaces)
}

/// 创建工作空间
pub fn create_workspace(name: &str) -> anyhow::Result<WorkspaceInfo> {
    ensure_root()?;
    let safe_name = sanitize_name(name);
    if safe_name.is_empty() {
        anyhow::bail!("工作空间名称无效");
    }

    let path = workspace_root().join(&safe_name);
    if path.exists() {
        anyhow::bail!("工作空间 '{}' 已存在", safe_name);
    }

    fs::create_dir_all(&path)?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(WorkspaceInfo {
        id: safe_name.clone(),
        name: safe_name.clone(),
        path: path.to_string_lossy().to_string(),
        created_at: now,
    })
}

/// 删除工作空间（谨慎：递归删除）
pub fn delete_workspace(id: &str) -> anyhow::Result<()> {
    let path = workspace_root().join(id);
    if !path.exists() {
        anyhow::bail!("工作空间不存在");
    }
    fs::remove_dir_all(&path)?;
    Ok(())
}

/// 获取工作空间下的对话列表（全部从 DB 读取）
pub async fn list_conversations(
    db: &flock_core::db::DbManager,
    workspace_id: &str,
) -> anyhow::Result<Vec<ConversationInfo>> {
    let ws_path = workspace_root().join(workspace_id);
    let ws_path_str = ws_path.to_string_lossy().to_string();

    let mut conversations = db.list_workspace_sessions(workspace_id, &ws_path_str).await?;

    conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(conversations)
}

/// 读取对话详情 (消息历史)
pub async fn load_conversation_history(
    db: &flock_core::db::DbManager,
    conv_id: &str,
) -> anyhow::Result<Vec<ChatMessage>> {
    db.load_conversation_messages(conv_id).await
}

/// 创建对话（写入 DB）
pub async fn create_conversation(
    db: &flock_core::db::DbManager,
    workspace_id: &str,
    title: &str,
) -> anyhow::Result<ConversationInfo> {
    db.create_conversation(workspace_id, title).await
}

/// 更新对话标题（写入 DB）
pub async fn update_conversation_title(
    db: &flock_core::db::DbManager,
    conv_id: &str,
    title: &str,
) -> anyhow::Result<()> {
    db.update_conversation_title(conv_id, title).await
}

/// 删除对话（从 DB 删除）
pub async fn delete_conversation(
    db: &flock_core::db::DbManager,
    conv_id: &str,
) -> anyhow::Result<()> {
    db.delete_conversation(conv_id).await
}

/// 列出工作空间下的文件（一层或递归）
pub fn list_files(workspace_id: &str, relative_path: &str, recursive: bool) -> anyhow::Result<Vec<FileEntry>> {
    let base = workspace_root().join(workspace_id);
    let target = if relative_path.is_empty() {
        base.clone()
    } else {
        base.join(relative_path)
    };

    if !target.exists() {
        return Ok(vec![]);
    }

    read_dir_entries(&target, &base, recursive, 0)
}

fn read_dir_entries(
    dir: &Path,
    base: &Path,
    recursive: bool,
    depth: usize,
) -> anyhow::Result<Vec<FileEntry>> {
    if depth > 5 {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();

    let read = fs::read_dir(dir)?;
    let mut paths: Vec<_> = read.flatten().collect();
    paths.sort_by_key(|e| {
        let is_dir = e.path().is_dir();
        let name = e.file_name().to_string_lossy().to_lowercase();
        (!is_dir, name)
    });

    for entry in paths {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if name.starts_with('.') {
            continue;
        }

        let rel_path = path
            .strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let is_dir = path.is_dir();
        let meta = fs::metadata(&path).ok();
        let size = meta.as_ref().and_then(|m| if is_dir { None } else { Some(m.len()) });

        let extension = if is_dir {
            None
        } else {
            path.extension().and_then(|e| e.to_str()).map(|s| s.to_string())
        };

        let children = if is_dir && recursive {
            Some(read_dir_entries(&path, base, recursive, depth + 1)?)
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: rel_path,
            is_dir,
            size,
            extension,
            children,
        });
    }

    Ok(entries)
}

/// 读取文件内容（用于预览）
pub fn read_file_content(workspace_id: &str, relative_path: &str) -> anyhow::Result<String> {
    let base = workspace_root().join(workspace_id);
    let target = base.join(relative_path);

    let canonical_base = fs::canonicalize(&base).unwrap_or(base.clone());
    let canonical_target = target.canonicalize().unwrap_or(target.clone());
    if !canonical_target.starts_with(&canonical_base) {
        anyhow::bail!("非法路径访问");
    }

    let content = fs::read_to_string(&canonical_target)?;
    Ok(content)
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | ' ' => c,
            _ => '_',
        })
        .collect::<String>()
        .trim()
        .replace(' ', "_")
}
