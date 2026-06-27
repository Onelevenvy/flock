use crate::sandbox_provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use flock_core::db::DbManager;
use async_trait::async_trait;
use std::path::Path;

pub struct DaytonaProvider;

#[async_trait]
impl SandboxProvider for DaytonaProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        crate::daytona::check_sandbox_alive(cfg, sandbox_id).await
    }
    async fn create_sandbox(&self, db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
        crate::daytona::create_sandbox(db, cfg).await
    }
    async fn destroy_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::daytona::destroy_daytona_sandbox(cfg, sandbox_id).await
    }
    async fn execute_command(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::daytona::execute_command_in_sandbox(db, sandbox_id, command).await
    }
    async fn get_vnc_url(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<String> {
        crate::daytona::get_sandbox_vnc_url(db, sandbox_id).await
    }
    async fn ensure_vnc_running(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::daytona::ensure_vnc_running_in_sandbox(db, sandbox_id).await
    }
    async fn sync_up(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::daytona::sync::sync_up(db, sandbox_id, ws_path).await
    }
    async fn sync_down(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::daytona::sync::sync_down(db, sandbox_id, ws_path).await
    }
}
