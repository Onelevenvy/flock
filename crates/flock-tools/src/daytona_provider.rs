use crate::sandbox_provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use async_trait::async_trait;

pub struct DaytonaSandboxProvider;

#[async_trait]
impl SandboxProvider for DaytonaSandboxProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        crate::daytona::check_sandbox_alive(cfg, sandbox_id).await
    }

    async fn get_or_create_sandbox(&self, cfg: &SandboxConfig) -> anyhow::Result<String> {
        // 由于 get_or_create_active_sandbox 会通过 db 读取配置，
        // 我们在 daytona::lifecycle.rs 外部已经完成了接口分发，
        // 这里只是其底层的实现封装包装。
        anyhow::bail!("Daytona sandbox creation should be managed via lifecycle")
    }

    async fn execute_command(&self, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        // 使用底层的 db 获取方式执行
        if let Some(db) = crate::get_db_manager() {
            crate::daytona::execute_command_in_sandbox(&db, sandbox_id, command).await
        } else {
            anyhow::bail!("Database manager not initialized")
        }
    }

    async fn destroy_sandbox(&self, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        if let Some(db) = crate::get_db_manager() {
            crate::daytona::destroy_active_sandbox(&db).await
        } else {
            anyhow::bail!("Database manager not initialized")
        }
    }
}
