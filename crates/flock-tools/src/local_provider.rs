use crate::sandbox_provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use async_trait::async_trait;

pub struct LocalSandboxProvider;

#[async_trait]
impl SandboxProvider for LocalSandboxProvider {
    async fn check_alive(&self, _cfg: &SandboxConfig, _sandbox_id: &str) -> bool {
        true
    }

    async fn get_or_create_sandbox(&self, _cfg: &SandboxConfig) -> anyhow::Result<String> {
        Ok("local".to_string())
    }

    async fn execute_command(&self, _cfg: &SandboxConfig, _sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::emit_info(&format!("Local mock executing: {}", command));
        Ok((format!("Local mock execution placeholder: executing '{}'", command), 0))
    }

    async fn destroy_sandbox(&self, _cfg: &SandboxConfig, _sandbox_id: &str) -> anyhow::Result<()> {
        Ok(())
    }
}
