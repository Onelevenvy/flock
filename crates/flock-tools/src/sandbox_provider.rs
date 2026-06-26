use std::path::Path;
use async_trait::async_trait;
use flock_core::config::settings::SandboxConfig;

#[async_trait]
pub trait SandboxProvider: Send + Sync {
    /// 检查沙盒是否存活
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool;

    /// 启动或获取活跃的沙盒实例ID
    async fn get_or_create_sandbox(&self, cfg: &SandboxConfig) -> anyhow::Result<String>;

    /// 在沙盒中执行一条命令行，返回 (stdout_stderr_combined, exit_code)
    async fn execute_command(&self, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)>;

    /// 销毁沙盒实例
    async fn destroy_sandbox(&self, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()>;
}
