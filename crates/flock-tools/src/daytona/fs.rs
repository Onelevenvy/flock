use flock_core::db::DbManager;
use crate::daytona::{execute_command_in_sandbox, get_or_create_active_sandbox};
use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaytonaFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
    pub children: Option<Vec<DaytonaFileEntry>>,
}

pub struct DaytonaFs;

impl DaytonaFs {
    /// Normalize any input path into a safe relative path under `/workspace`.
    ///
    /// Rules:
    /// - `foo/bar` -> `foo/bar`
    /// - `/workspace/foo/bar` -> `foo/bar`
    /// - `/home/daytona/foo` -> `home/daytona/foo` (still mapped under `/workspace`)
    /// - parent traversal (`..`) is rejected
    fn normalize_workspace_relative_path(input: &str) -> anyhow::Result<String> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            anyhow::bail!("Path cannot be empty");
        }

        let no_workspace_prefix = if let Some(rest) = trimmed.strip_prefix("/workspace/") {
            rest
        } else if trimmed == "/workspace" {
            ""
        } else if let Some(rest) = trimmed.strip_prefix("/workspace") {
            rest.trim_start_matches('/')
        } else {
            trimmed.trim_start_matches('/')
        };

        let mut parts: Vec<String> = Vec::new();
        for comp in Path::new(no_workspace_prefix).components() {
            match comp {
                Component::Normal(seg) => parts.push(seg.to_string_lossy().to_string()),
                Component::CurDir => {}
                Component::ParentDir => anyhow::bail!("Path cannot contain '..': {}", input),
                Component::RootDir | Component::Prefix(_) => {}
            }
        }

        if parts.is_empty() {
            anyhow::bail!("Path points to workspace root; file path is required: {}", input);
        }

        Ok(parts.join("/"))
    }

    async fn run_cmd(db: &DbManager, cmd: &str) -> anyhow::Result<String> {
        let sandbox_id = get_or_create_active_sandbox(db).await?;
        let (out, code) = execute_command_in_sandbox(db, &sandbox_id, cmd).await?;
        if code != 0 {
            anyhow::bail!("Command failed with code {}: {}", code, out);
        }
        Ok(out)
    }

    pub async fn list_files(db: &DbManager, relative_path: &str, recursive: bool) -> anyhow::Result<Vec<DaytonaFileEntry>> {
        let target_dir = if relative_path.is_empty() {
            "/workspace".to_string()
        } else {
            format!("/workspace/{}", relative_path)
        };

        // We use python in the sandbox to accurately list files and output JSON.
        // It's much safer than parsing bash `ls` or `find`.
        let py_script = format!(r#"
import os, json, sys

def get_tree(path, recursive, base_path, depth=0):
    if depth > 5:
        return []
    try:
        entries = []
        with os.scandir(path) as it:
            for entry in it:
                if entry.name.startswith('.'):
                    continue
                is_dir = entry.is_dir(follow_symlinks=False)
                rel_path = os.path.relpath(entry.path, base_path)
                size = None if is_dir else entry.stat().st_size
                extension = None if is_dir else os.path.splitext(entry.name)[1][1:]
                if extension == '': extension = None
                
                children = None
                if is_dir and recursive:
                    children = get_tree(entry.path, True, base_path, depth + 1)
                
                entries.append({{
                    "name": entry.name,
                    "path": rel_path,
                    "is_dir": is_dir,
                    "size": size,
                    "extension": extension,
                    "children": children
                }})
        entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return entries
    except Exception as e:
        return []

try:
    print(json.dumps(get_tree("{}", {}, "{}")))
except Exception as e:
    print("[]")
"#, target_dir, if recursive { "True" } else { "False" }, "/workspace");

        let b64_script = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, py_script);
        let cmd = format!("echo '{}' | base64 -d | python3", b64_script);
        
        let out = Self::run_cmd(db, &cmd).await?;
        let entries: Vec<DaytonaFileEntry> = serde_json::from_str(&out).unwrap_or_default();
        Ok(entries)
    }

    pub async fn read_file(db: &DbManager, relative_path: &str) -> anyhow::Result<String> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let cmd = format!("cat '{}'", target.replace('\'', "'\\''"));
        Self::run_cmd(db, &cmd).await
    }

    pub async fn read_file_base64(db: &DbManager, relative_path: &str) -> anyhow::Result<String> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let cmd = format!("base64 -w 0 '{}'", target.replace('\'', "'\\''"));
        Self::run_cmd(db, &cmd).await
    }

    pub async fn write_file(db: &DbManager, relative_path: &str, content: &str) -> anyhow::Result<()> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let parent = std::path::Path::new(&target).parent().unwrap_or(std::path::Path::new("/workspace"));
        let b64_content = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, content);
        
        let cmd = format!("mkdir -p '{}' && echo '{}' | base64 -d > '{}'", 
            parent.to_string_lossy().replace('\'', "'\\''"),
            b64_content, 
            target.replace('\'', "'\\''"));
        
        Self::run_cmd(db, &cmd).await?;
        Ok(())
    }

    pub async fn upload_file(db: &DbManager, relative_path: &str, content: &[u8]) -> anyhow::Result<()> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let parent = std::path::Path::new(&target).parent().unwrap_or(std::path::Path::new("/workspace"));
        let b64_content = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, content);
        
        let cmd = format!("mkdir -p '{}' && echo '{}' | base64 -d > '{}'", 
            parent.to_string_lossy().replace('\'', "'\\''"),
            b64_content, 
            target.replace('\'', "'\\''"));
        
        Self::run_cmd(db, &cmd).await?;
        Ok(())
    }

    pub async fn delete_path(db: &DbManager, relative_path: &str) -> anyhow::Result<()> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let cmd = format!("rm -rf '{}'", target.replace('\'', "'\\''"));
        Self::run_cmd(db, &cmd).await?;
        Ok(())
    }

    pub async fn create_dir(db: &DbManager, relative_path: &str) -> anyhow::Result<()> {
        let rel = Self::normalize_workspace_relative_path(relative_path)?;
        let target = format!("/workspace/{}", rel);
        let cmd = format!("mkdir -p '{}'", target.replace('\'', "'\\''"));
        Self::run_cmd(db, &cmd).await?;
        Ok(())
    }
}
