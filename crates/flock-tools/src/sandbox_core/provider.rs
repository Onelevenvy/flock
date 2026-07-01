use std::path::Path;
use async_trait::async_trait;
use flock_core::config::settings::SandboxConfig;
use serde_json::Value;

#[async_trait]
pub trait SandboxProvider: Send + Sync {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool;
    async fn create_sandbox(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig) -> anyhow::Result<String>;
    async fn destroy_sandbox(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()>;
    async fn execute_command(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)>;
    async fn get_vnc_url(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<String>;
    async fn ensure_vnc_running(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()>;
    async fn sync_up(&self, db: &flock_core::db::DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()>;
    async fn sync_down(&self, db: &flock_core::db::DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()>;
    fn get_workspace_dir(&self) -> &str;
    async fn list_templates(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig) -> anyhow::Result<Value>;
    async fn delete_template(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig, id: &str) -> anyhow::Result<()>;
    async fn cleanup_all_instances(&self, db: &flock_core::db::DbManager, cfg: &SandboxConfig) -> anyhow::Result<String>;
}
