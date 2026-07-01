use crate::sandbox_core::provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use flock_core::db::DbManager;
use async_trait::async_trait;
use std::path::Path;

pub struct DaytonaProvider;

#[async_trait]
impl SandboxProvider for DaytonaProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        crate::sandbox_core::daytona::check_sandbox_alive(cfg, sandbox_id).await
    }
    async fn create_sandbox(&self, db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
        crate::sandbox_core::daytona::create_sandbox(db, cfg).await
    }
    async fn destroy_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::sandbox_core::daytona::destroy_daytona_sandbox(cfg, sandbox_id).await
    }
    async fn execute_command(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::sandbox_core::daytona::execute_command_in_sandbox(db, sandbox_id, command).await
    }
    async fn get_vnc_url(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<String> {
        crate::sandbox_core::daytona::get_sandbox_vnc_url(db, sandbox_id).await
    }
    async fn ensure_vnc_running(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::sandbox_core::daytona::ensure_vnc_running_in_sandbox(db, sandbox_id).await
    }
    async fn sync_up(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::sandbox_core::sync::sync_up(db, sandbox_id, ws_path).await
    }
    async fn sync_down(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::sandbox_core::sync::sync_down(db, sandbox_id, ws_path).await
    }
    fn get_workspace_dir(&self) -> &str {
        "/workspace"
    }
    async fn list_templates(&self, _db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<serde_json::Value> {
        let base = crate::sandbox_core::config::get_api_base(cfg.api_url.as_ref().unwrap());
        let api_key = cfg.api_key.as_ref().unwrap();

        let client = reqwest::Client::new();
        let url = format!("{}/api/snapshots", base);
        let resp = client.get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            anyhow::bail!("Daytona API error ({}): {}", status, text);
        }

        let val: serde_json::Value = serde_json::from_str(&text)?;
        Ok(val)
    }
    async fn delete_template(&self, _db: &DbManager, cfg: &SandboxConfig, id: &str) -> anyhow::Result<()> {
        let base = crate::sandbox_core::config::get_api_base(cfg.api_url.as_ref().unwrap());
        let api_key = cfg.api_key.as_ref().unwrap();

        let client = reqwest::Client::new();
        let url = format!("{}/api/snapshots/{}", base, id);
        let resp = client.delete(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to delete Daytona snapshot: {} - {}", resp.status(), err_body);
        }
        Ok(())
    }
    async fn cleanup_all_instances(&self, _db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
        let base = crate::sandbox_core::config::get_api_base(cfg.api_url.as_ref().unwrap());
        let api_key = cfg.api_key.as_ref().unwrap();

        let client = reqwest::Client::new();
        let list_url = format!("{}/api/sandbox", base);
        let resp = client.get(&list_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            anyhow::bail!("Failed to list Daytona sandboxes (HTTP {}): {}", status, text);
        }

        let val: serde_json::Value = serde_json::from_str(&text)?;
        let sandboxes = val.as_array()
            .cloned()
            .unwrap_or_else(|| {
                val.get("items").or_else(|| val.get("data"))
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default()
            });

        let mut deleted = 0usize;
        let mut failed = 0usize;

        for sb in &sandboxes {
            let id = sb.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            if id.is_empty() { continue; }

            let state_str = sb.get("state").or_else(|| sb.get("status"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if state_str == "deleted" || state_str == "archived" { continue; }

            let del_url = format!("{}/api/sandbox/{}", base, id);
            match client.delete(&del_url)
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
            {
                Ok(r) if r.status().is_success() => deleted += 1,
                _ => failed += 1,
            }
        }

        Ok(flock_core::tr(
            &format!("清理完成：已销毁 {} 个沙盒，失败 {} 个。", deleted, failed),
            &format!("Cleanup complete: destroyed {} sandboxes, failed {}.", deleted, failed)
        ))
    }
}
