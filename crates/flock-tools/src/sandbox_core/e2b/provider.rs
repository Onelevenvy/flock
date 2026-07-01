use crate::sandbox_core::provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use flock_core::db::DbManager;
use async_trait::async_trait;
use std::path::Path;

pub struct E2bProvider;

#[async_trait]
impl SandboxProvider for E2bProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        crate::sandbox_core::e2b::check_alive(cfg, sandbox_id).await
    }
    async fn create_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
        crate::sandbox_core::e2b::create_sandbox(cfg).await
    }
    async fn destroy_sandbox(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::sandbox_core::e2b::destroy_sandbox(cfg, sandbox_id).await
    }
    async fn execute_command(&self, _db: &DbManager, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        crate::sandbox_core::e2b::execute_command(cfg, sandbox_id, command).await
    }
    async fn get_vnc_url(&self, _db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<String> {
        Ok(crate::sandbox_core::e2b::exec::get_vnc_url(sandbox_id))
    }
    async fn ensure_vnc_running(&self, db: &DbManager, _cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        crate::sandbox_core::vnc_helper::ensure_vnc_running_in_sandbox(db, sandbox_id).await
    }
    async fn sync_up(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::sandbox_core::sync::sync_up(db, sandbox_id, ws_path).await
    }
    async fn sync_down(&self, db: &DbManager, sandbox_id: &str, ws_path: &Path) -> anyhow::Result<()> {
        crate::sandbox_core::sync::sync_down(db, sandbox_id, ws_path).await
    }
    fn get_workspace_dir(&self) -> &str {
        "/home/user"
    }
    async fn list_templates(&self, _db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<serde_json::Value> {
        let key = cfg.e2b_api_key.clone().unwrap_or_default();
        if key.is_empty() {
            return Ok(serde_json::json!([]));
        }
        let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');
        let client = reqwest::Client::new();
        let url = format!("{}/templates", base_url);
        let resp = client.get(&url)
            .header("X-API-Key", key)
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            anyhow::bail!("E2B API error ({}): {}", status, text);
        }

        let mut mapped: Vec<serde_json::Value> = vec![];
        let list_val: serde_json::Value = serde_json::from_str(&text)?;

        if let Some(arr) = list_val.as_array() {
            for item in arr {
                let id = item.get("templateID")
                    .or_else(|| item.get("snapshotID"))
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                let name = item.get("aliases")
                    .and_then(|a| a.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_str())
                    .unwrap_or(id);
                if !id.is_empty() && !mapped.iter().any(|m| m.get("id").and_then(|v| v.as_str()) == Some(id)) {
                    mapped.push(serde_json::json!({
                        "id": id,
                        "name": name,
                        "status": "active"
                    }));
                }
            }
        }
        Ok(serde_json::json!(mapped))
    }
    async fn delete_template(&self, _db: &DbManager, cfg: &SandboxConfig, id: &str) -> anyhow::Result<()> {
        let api_key = cfg.e2b_api_key.as_ref().ok_or_else(|| anyhow::anyhow!("E2B API key missing"))?;
        let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');
        let client = reqwest::Client::new();
        let url = format!("{}/templates/{}", base_url, id);
        let resp = client.delete(&url)
            .header("X-API-Key", api_key)
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to delete E2B template: {} - {}", resp.status(), err_body);
        }
        Ok(())
    }
    async fn cleanup_all_instances(&self, _db: &DbManager, _cfg: &SandboxConfig) -> anyhow::Result<String> {
        Ok(flock_core::tr(
            "E2B 实例由平台自动进行生命周期托管与清理，无需手动干预。",
            "E2B instances are self-cleaning and managed automatically by the platform."
        ))
    }
}
