use serde::{Deserialize, Serialize};
use flock_core::config::settings::SandboxConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BCreateInstanceRequest {
    #[serde(rename = "templateId")]
    pub template_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BInstance {
    #[serde(rename = "instanceID")]
    pub instance_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
    #[serde(rename = "clientID")]
    pub client_id: String,
}

#[derive(Debug, Serialize)]
struct E2BExecuteRequest {
    pub command: String,
}

#[derive(Debug, Deserialize)]
struct E2BExecuteResponse {
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
}

pub async fn create_e2b_sandbox(cfg: &SandboxConfig) -> anyhow::Result<String> {
    let api_key = cfg.e2b_api_key.as_ref()
        .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

    let client = reqwest::Client::new();
    
    // We use the default "desktop" image or similar for E2B which supports GUI,
    // or standard "base" / "browser" template. Let's use "browser" template by default.
    let template_id = cfg.snapshot.as_deref()
        .unwrap_or("browser")
        .trim();
        
    let template_id = if template_id.is_empty() { "browser" } else { template_id };

    let payload = E2BCreateInstanceRequest {
        template_id: template_id.to_string(),
    };

    let url = "https://api.e2b.dev/instances";

    let resp = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await?;

    let status = resp.status();
    let resp_text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        anyhow::bail!("Failed to create E2B instance (HTTP {}): {}", status, resp_text);
    }

    let instance: E2BInstance = serde_json::from_str(&resp_text)
        .map_err(|e| anyhow::anyhow!("Failed to parse E2B instance response: {}, body: {}", e, resp_text))?;

    Ok(instance.instance_id)
}

pub async fn execute_in_e2b_sandbox(
    cfg: &SandboxConfig,
    instance_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
    let api_key = cfg.e2b_api_key.as_ref()
        .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

    let client = reqwest::Client::new();
    let url = format!("https://api.e2b.dev/instances/{}/commands", instance_id);

    let payload = E2BExecuteRequest {
        command: command.to_string(),
    };

    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await?;

    let status = resp.status();
    let resp_text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        anyhow::bail!("Failed to execute command in E2B instance (HTTP {}): {}", status, resp_text);
    }

    let exec_res: E2BExecuteResponse = serde_json::from_str(&resp_text)
        .map_err(|e| anyhow::anyhow!("Failed to parse E2B execution response: {}, body: {}", e, resp_text))?;

    let stdout = exec_res.stdout.unwrap_or_default();
    let stderr = exec_res.stderr.unwrap_or_default();
    let combined_output = if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok((combined_output, exec_res.exit_code.unwrap_or(0)))
}

pub async fn destroy_e2b_sandbox(cfg: &SandboxConfig, instance_id: &str) -> anyhow::Result<()> {
    let api_key = cfg.e2b_api_key.as_ref()
        .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

    let client = reqwest::Client::new();
    let url = format!("https://api.e2b.dev/instances/{}", instance_id);

    let resp = client.delete(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let resp_text = resp.text().await.unwrap_or_default();
        anyhow::bail!("Failed to destroy E2B instance (HTTP {}): {}", status, resp_text);
    }

    Ok(())
}

pub async fn check_e2b_alive(cfg: &SandboxConfig, instance_id: &str) -> bool {
    let api_key = match &cfg.e2b_api_key {
        Some(k) => k,
        None => return false,
    };

    let client = reqwest::Client::new();
    let url = "https://api.e2b.dev/instances";

    let resp = match client.get(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return false,
    };

    if !resp.status().is_success() {
        return false;
    }

    let resp_text = match resp.text().await {
        Ok(t) => t,
        Err(_) => return false,
    };

    let instances: Result<Vec<E2BInstance>, _> = serde_json::from_str(&resp_text);
    match instances {
        Ok(list) => list.iter().any(|i| i.instance_id == instance_id),
        Err(_) => false,
    }
}
