use flock_core::db::DbManager;
use crate::daytona::execute_command_in_sandbox;
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::Context;

fn should_ignore(path: &Path) -> bool {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    name == ".git" || name == "node_modules" || name == "target" || name.starts_with(".flock")
}

pub async fn sync_up(db: &DbManager, sandbox_id: &str, local_workspace: &Path) -> anyhow::Result<()> {
    crate::emit_info("正在将本地工作区同步到沙盒 (Sync Up)...");
    
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
                    crate::emit_info(&format!("Failed to tar {}: {}", rel_path.display(), e));
                }
            }
        }
    }
    tar.into_inner()?.finish()?;

    // Upload tarball
    let tar_data = fs::read(&tar_path)?;
    let b64_content = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tar_data);
    let cmd = format!("echo '{}' | base64 -d > /workspace/.flock_sync.tar.gz", b64_content);
    execute_command_in_sandbox(db, sandbox_id, &cmd).await?;

    // Extract tarball
    let cmd = "cd /workspace && tar -xzf .flock_sync.tar.gz && rm .flock_sync.tar.gz";
    execute_command_in_sandbox(db, sandbox_id, cmd).await?;
    
    let _ = fs::remove_file(tar_path);
    crate::emit_info("同步到沙盒完成。");
    Ok(())
}

pub async fn sync_down(db: &DbManager, sandbox_id: &str, local_workspace: &Path) -> anyhow::Result<()> {
    crate::emit_info("正在将沙盒文件同步回本地 (Sync Down)...");
    
    // Create a tarball in sandbox
    let cmd = "cd /workspace && tar -czf .flock_sync_down.tar.gz --exclude='.flock_sync_down.tar.gz' --exclude='.git' --exclude='node_modules' --exclude='target' .";
    execute_command_in_sandbox(db, sandbox_id, cmd).await?;

    // Download tarball
    let cmd = "base64 -w 0 /workspace/.flock_sync_down.tar.gz";
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
                        // 标准化路径：清除 tar 包中带有的前置 "./" 或 ".\" 标记以保持一致
                        let mut rel_path = path.to_path_buf();
                        if rel_path.starts_with("./") {
                            if let Ok(stripped) = rel_path.strip_prefix("./") {
                                rel_path = stripped.to_path_buf();
                            }
                        } else if rel_path.starts_with(".\\") {
                            if let Ok(stripped) = rel_path.strip_prefix(".\\") {
                                rel_path = stripped.to_path_buf();
                            }
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
    let cmd = "rm -f /workspace/.flock_sync_down.tar.gz";
    let _ = execute_command_in_sandbox(db, sandbox_id, cmd).await;

    crate::emit_info("同步回本地完成。");
    Ok(())
}
