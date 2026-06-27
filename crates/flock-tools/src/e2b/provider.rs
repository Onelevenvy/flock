use crate::sandbox_provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use flock_core::db::DbManager;
use async_trait::async_trait;
use std::path::Path;

pub struct E2bProvider;

#[async_trait]
impl SandboxProvider for E2bProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        crate::e2b::check_alive(cfg, sandbox_id).await
    }
    async fn create_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
        crate::e2b::create_sandbox(cfg).await
    }
    async fn destroy_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::e2b::destroy_sandbox(cfg, sandbox_id).await
    }
    async fn execute_command(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::e2b::execute_command(cfg, sandbox_id, command).await
    }
    async fn get_vnc_url(&self, _db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<String> {
        Ok(crate::e2b::exec::get_vnc_url(sandbox_id))
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
