use crate::sandbox_provider::SandboxProvider;
use flock_core::config::settings::SandboxConfig;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub struct E2BSandboxProvider;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BCreateSandboxRequest {
    #[serde(rename = "templateID")]
    pub template_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BSandboxResponse {
    #[serde(rename = "sandboxID")]
    pub sandbox_id: String,
    #[serde(rename = "templateID")]
    pub template_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BProcessRequest {
    pub cmd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2BProcessResponse {
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
}

#[async_trait]
impl SandboxProvider for E2BSandboxProvider {
    async fn check_alive(&self, cfg: &SandboxConfig, sandbox_id: &str) -> bool {
        let api_key = match &cfg.e2b_api_key {
            Some(k) => k,
            None => return false,
        };

        let client = reqwest::Client::new();
        let url = format!("https://api.e2b.app/sandboxes/{}", sandbox_id);

        let resp = match client.get(&url)
            .header("X-API-Key", api_key)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return false,
        };

        resp.status().is_success()
    }

    async fn get_or_create_sandbox(&self, cfg: &SandboxConfig) -> anyhow::Result<String> {
        let api_key = cfg.e2b_api_key.as_ref()
            .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

        let client = reqwest::Client::new();
        let mut template_id = cfg.snapshot.as_deref()
            .unwrap_or("browser")
            .trim();
        if template_id.is_empty() {
            template_id = "browser";
        }
        
        // 如果是 Daytona 生成的数字序列（如 "1234567890" 等纯数字，或者不含 hyphen 的 Daytona 快照），
        // 或者不是官方默认推荐模板 (browser/base/code-interpreter) 且不包含常规自定义模板格式时，
        // 自动回退到官方 "browser" 模板，防止参数串用报错。
        let is_valid_e2b_template = template_id == "browser" 
            || template_id == "base" 
            || template_id == "code-interpreter"
            || (template_id.contains('-') && template_id.len() > 5); // E2B 自定义模板通常带有连字符且较长
            
        let template_id = if is_valid_e2b_template {
            template_id
        } else {
            "browser"
        };

        let payload = E2BCreateSandboxRequest {
            template_id: template_id.to_string(),
        };

        let url = "https://api.e2b.app/sandboxes";
        crate::emit_info(&flock_core::tr(
            &format!("正在向 E2B 申请启动沙盒 (模版: {})...", template_id),
            &format!("Requesting E2B sandbox (template: {})...", template_id)
        ));

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

    async fn execute_command(&self, cfg: &SandboxConfig, sandbox_id: &str, command: &str) -> anyhow::Result<(String, i32)> {
        let api_key = cfg.e2b_api_key.as_ref()
            .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

        let client = reqwest::Client::new();
        let url = format!("https://api.e2b.app/sandboxes/{}/commands", sandbox_id);

        let payload = E2BProcessRequest {
            cmd: command.to_string(),
        };

        let resp = client.post(&url)
            .header("X-API-Key", api_key)
            .json(&payload)
            .send()
            .await?;

        let status = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            anyhow::bail!("Failed to execute command in E2B sandbox (HTTP {}): {}", status, resp_text);
        }

        let exec_res: E2BProcessResponse = serde_json::from_str(&resp_text)
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

    async fn destroy_sandbox(&self, cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
        let api_key = cfg.e2b_api_key.as_ref()
            .ok_or_else(|| anyhow::anyhow!("E2B API key is missing"))?;

        let client = reqwest::Client::new();
        let url = format!("https://api.e2b.app/sandboxes/{}", sandbox_id);

        let resp = client.delete(&url)
            .header("X-API-Key", api_key)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let resp_text = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to destroy E2B sandbox (HTTP {}): {}", status, resp_text);
        }

        Ok(())
    }
}
