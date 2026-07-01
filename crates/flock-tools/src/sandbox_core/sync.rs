use flock_core::db::DbManager;
use crate::sandbox_core::manager::execute_command_in_sandbox;
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::Context;

fn should_ignore(path: &Path) -> bool {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    name == ".git" || name == "node_modules" || name == "target" || name.starts_with(".flock")
}

pub async fn sync_up(db: &DbManager, sandbox_id: &str, local_workspace: &Path) -> anyhow::Result<()> {
    let mut ws_dir = "/workspace";
    if let Some(cfg) = crate::sandbox_core::config::get_sandbox_config(db).await {
        if cfg.provider.as_deref().unwrap_or("e2b") == "local" {
            return Ok(());
        }
        let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
        let provider = crate::sandbox_core::manager::get_provider(provider_name);
        ws_dir = provider.get_workspace_dir();
    }

    if ws_dir.is_empty() {
        return Ok(());
    }

    // Create a temporary tarball
    let tar_path = std::env::temp_dir().join(format!("flock_sync_up_{}.tar.gz", sandbox_id));
    let tar_file = fs::File::create(&tar_path).context("Failed to create tar file")?;
    let enc = flate2::write::GzEncoder::new(tar_file, flate2::Compression::default());
    let mut tar = tar::Builder::new(enc);

    let walker = ignore::WalkBuilder::new(local_workspace)
        .hidden(false)
        .filter_entry(|e| !should_ignore(e.path()))
        .build();

    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_file() {
            if let Ok(rel_path) = path.strip_prefix(local_workspace) {
                if let Err(e) = tar.append_path_with_name(path, rel_path) {
                    log::warn!("Failed to tar {}: {}", rel_path.display(), e);
                }
            }
        }
    }
    tar.into_inner()?.finish()?;

    // Upload tarball
    let tar_data = fs::read(&tar_path)?;
    let b64_content = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tar_data);
    let cmd = format!("echo '{}' | base64 -d > {}/.flock_sync.tar.gz", b64_content, ws_dir);
    execute_command_in_sandbox(db, sandbox_id, &cmd).await?;

    // Extract tarball
    let cmd = format!("cd {} && tar -xzf .flock_sync.tar.gz && rm .flock_sync.tar.gz", ws_dir);
    execute_command_in_sandbox(db, sandbox_id, &cmd).await?;
    
    let _ = fs::remove_file(tar_path);
    Ok(())
}

pub async fn sync_down(db: &DbManager, sandbox_id: &str, local_workspace: &Path) -> anyhow::Result<()> {
    let mut ws_dir = "/workspace";
    if let Some(cfg) = crate::sandbox_core::config::get_sandbox_config(db).await {
        if cfg.provider.as_deref().unwrap_or("e2b") == "local" {
            return Ok(());
        }
        let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
        let provider = crate::sandbox_core::manager::get_provider(provider_name);
        ws_dir = provider.get_workspace_dir();
    }

    if ws_dir.is_empty() {
        return Ok(());
    }

    // Create a tarball in sandbox
    let cmd = format!("cd {} && tar -czf .flock_sync_down.tar.gz --exclude='.flock_sync_down.tar.gz' --exclude='.git' --exclude='node_modules' --exclude='target' .", ws_dir);
    execute_command_in_sandbox(db, sandbox_id, &cmd).await?;

    // Download tarball
    let cmd = format!("base64 -w 0 {}/.flock_sync_down.tar.gz", ws_dir);
    let (b64, code) = execute_command_in_sandbox(db, sandbox_id, &cmd).await?;
    if code != 0 {
        anyhow::bail!("Failed to download tarball: {}", b64);
    }
    
    let tar_data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64.trim())?;

    let tar_path = std::env::temp_dir().join(format!("flock_sync_down_{}.tar.gz", sandbox_id));
    fs::write(&tar_path, tar_data)?;

    // 1. 在解包前，遍历一遍 tar 归档，收集目前远端沙盒真实存活的相对路径文件集合
    let mut remote_files = std::collections::HashSet::new();
    {
        let tar_file_read = fs::File::open(&tar_path)?;
        let dec_read = flate2::read::GzDecoder::new(tar_file_read);
        let mut tar_read = tar::Archive::new(dec_read);
        if let Ok(entries) = tar_read.entries() {
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(path) = entry.path() {
                        let mut rel_path = path.to_path_buf();
                        if let Ok(stripped) = rel_path.strip_prefix(".") {
                            rel_path = stripped.to_path_buf();
                        }
                        remote_files.insert(rel_path);
                    }
                }
            }
        }
    }

    // 2. 将 tar 包文件解压覆盖到本地工作区
    let tar_file = fs::File::open(&tar_path)?;
    let dec = flate2::read::GzDecoder::new(tar_file);
    let mut tar = tar::Archive::new(dec);
    tar.unpack(local_workspace)?;

    // 3. 增量清理：遍历本地工作区，如果本地有但远端没有，说明在沙箱中已被删除，应在本地同步抹除！
    let walker = ignore::WalkBuilder::new(local_workspace)
        .hidden(false)
        .filter_entry(|e| !should_ignore(e.path()))
        .build();

    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_file() {
            if let Ok(rel_path) = path.strip_prefix(local_workspace) {
                // 如果本地的该相对路径文件不在远端存活集合中，立刻执行物理删除！
                let rel_path_buf = rel_path.to_path_buf();
                if !remote_files.contains(&rel_path_buf) {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }

    let _ = fs::remove_file(tar_path);
    
    // Cleanup sandbox
    let cmd = format!("rm -f {}/.flock_sync_down.tar.gz", ws_dir);
    let _ = execute_command_in_sandbox(db, sandbox_id, &cmd).await;

    Ok(())
}
