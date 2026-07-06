use flock_core::config::settings::SandboxConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BCreateSandboxRequest {
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BSandboxResponse {
    #[serde(rename = "sandboxID")]
    pub sandbox_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
}

/// 检查 E2B 沙盒是否存活
pub async fn check_alive(cfg: &SandboxConfig, sandbox_id: &str) -> bool {
    let api_key = match &cfg.e2b_api_key {
        Some(k) => k,
        None => return false,
    };
    let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');

    let client = reqwest::Client::new();
    let url = format!("{}/sandboxes/{}", base_url, sandbox_id);

    match client.get(&url)
        .header("X-API-Key", api_key)
        .send()
        .await
    {
        Ok(r) => r.status().is_success(),
        Err(_) => false,
    }
}

/// 创建 E2B 沙盒，返回 sandbox_id
pub async fn create_sandbox(cfg: &SandboxConfig) -> anyhow::Result<String> {
    let api_key = cfg.e2b_api_key.as_ref()
        .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;
    let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');

    let mut template_id = cfg.snapshot.as_deref()
        .unwrap_or("")
        .trim();
    if template_id.is_empty() {
        template_id = "aa5z6s0zm7qv5g3oay5v"; // 使用您发布的公共模版 ID 作为默认兜底
    }

    let client = reqwest::Client::new();
    let payload = E2BCreateSandboxRequest {
        template_id: template_id.to_string(),
        timeout: Some(300),
    };

    crate::emit_info(&flock_core::tr(
        &format!("正在向 E2B 申请启动沙盒 (模版: {})...", template_id),
        &format!("Requesting E2B sandbox (template: {})...", template_id)
    ));

    let url = format!("{}/sandboxes", base_url);
    let resp = client.post(url)
        .header("X-API-Key", api_key)
        .json(&payload)
        .send()
        .await?;

    let status = resp.status();
    let resp_text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        anyhow::bail!("Failed to create E2B sandbox (HTTP {}): {}", status, resp_text);
    }

    let sandbox: E2BSandboxResponse = serde_json::from_str(&resp_text)
        .map_err(|e| anyhow::anyhow!("Failed to parse E2B sandbox response: {}, body: {}", e, resp_text))?;

    crate::emit_info(&flock_core::tr("E2B 沙盒已启动。", "E2B sandbox started."));
    Ok(sandbox.sandbox_id)
}

/// 销毁 E2B 沙盒
pub async fn destroy_sandbox(cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
    let api_key = cfg.e2b_api_key.as_ref()
        .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;
    let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');

    let client = reqwest::Client::new();
    let url = format!("{}/sandboxes/{}", base_url, sandbox_id);

    let resp = client.delete(&url)
        .header("X-API-Key", api_key)
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() && status.as_u16() != 204 {
        let resp_text = resp.text().await.unwrap_or_default();
        anyhow::bail!("Failed to destroy E2B sandbox (HTTP {}): {}", status, resp_text);
    }

    Ok(())
}
