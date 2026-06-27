use crate::sandbox_core::provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use flock_core::db::DbManager;
use async_trait::async_trait;
use std::path::Path;

pub struct LocalSandboxProvider;

#[async_trait]
impl SandboxProvider for LocalSandboxProvider {
    async fn check_alive(&self, _cfg: &SandboxConfig, _sandbox_id: &str) -> bool {
        true
    }
    async fn create_sandbox(&self, _db: &DbManager, _cfg: &SandboxConfig) -> anyhow::Result<String> {
        crate::emit_info(&flock_core::tr("正在启动本地 Mock 沙盒 (占位)...", "Starting local mock sandbox (placeholder)..."));
        Ok("local".to_string())
    }
    async fn destroy_sandbox(&self, _db: &DbManager, _cfg: &SandboxConfig, _sandbox_id: &str) -> anyhow::Result<()> {
        Ok(())
    }
    async fn execute_command(&self, _db: &DbManager, _cfg: &SandboxConfig, _sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::emit_info(&format!("Local mock executing: {}", command));
        Ok((format!("Local mock execution placeholder: executing '{}'", command), 0))
    }
    async fn get_vnc_url(&self, _db: &DbManager, _cfg: &SandboxConfig, _sandbox_id: &str) -> anyhow::Result<String> {
        anyhow::bail!("Local sandbox does not support VNC")
    }
    async fn ensure_vnc_running(&self, _db: &DbManager, _cfg: &SandboxConfig, _sandbox_id: &str) -> anyhow::Result<()> {
        Ok(())
    }
    async fn sync_up(&self, _db: &DbManager, _sandbox_id: &str, _ws_path: &Path) -> anyhow::Result<()> {
        Ok(())
    }
    async fn sync_down(&self, _db: &DbManager, _sandbox_id: &str, _ws_path: &Path) -> anyhow::Result<()> {
        Ok(())
    }
}
