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
            .unwrap_or("base")
            .trim();
        if template_id.is_empty() {
            template_id = "base";
        }

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
        let url = format!("https://49983-{}.e2b.app/process.Process/Start", sandbox_id);

        #[derive(Debug, serde::Serialize)]
        struct ProcessConfig {
            cmd: String,
            args: Vec<String>,
            envs: std::collections::HashMap<String, String>,
            cwd: String,
        }

        #[derive(Debug, serde::Serialize)]
        struct StartRequest {
            process: ProcessConfig,
        }

        let payload = StartRequest {
            process: ProcessConfig {
                cmd: "/bin/bash".to_string(),
                args: vec!["-c".to_string(), command.to_string()],
                envs: std::collections::HashMap::new(),
                cwd: "/workspace".to_string(),
            },
        };

        let body_str = serde_json::to_string(&payload)?;

        let resp = client.post(&url)
            .header("X-API-Key", api_key)
            .header("Connect-Protocol-Version", "1")
            .header("Content-Type", "application/connect+json")
            .header(reqwest::header::USER_AGENT, "flock-agent")
            .body(body_str)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let resp_text = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to start command in E2B sandbox (HTTP {}): {}", status, resp_text);
        }

        let mut stdout_accum = String::new();
        let mut stderr_accum = String::new();
        let mut exit_code = 0;

        use futures::StreamExt;
        let mut body = resp.bytes_stream();
        let mut buffer = Vec::new();

        while let Some(chunk_res) = body.next().await {
            let chunk = chunk_res?;
            buffer.extend_from_slice(&chunk);

            while buffer.len() >= 5 {
                let flags = buffer[0];
                let length = u32::from_be_bytes([buffer[1], buffer[2], buffer[3], buffer[4]]) as usize;

                if buffer.len() >= 5 + length {
                    let payload_bytes = &buffer[5..5 + length];

                    println!("[DEBUG E2B] flags: {}, length: {}, payload_raw: {:?}", flags, length, String::from_utf8_lossy(payload_bytes));
                    if flags == 0x00 {
                        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(payload_bytes) {
                            println!("[DEBUG E2B] Parsed JSON: {:?}", val);
                            if let Some(event) = val.get("event") {
                                if let Some(data) = event.get("data") {
                                    if let Some(stdout_b64) = data.get("stdout").and_then(|v| v.as_str()) {
                                        if let Ok(decoded) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, stdout_b64) {
                                            if let Ok(s) = String::from_utf8(decoded) {
                                                stdout_accum.push_str(&s);
                                            }
                                        }
                                    }
                                    if let Some(stderr_b64) = data.get("stderr").and_then(|v| v.as_str()) {
                                        if let Ok(decoded) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, stderr_b64) {
                                            if let Ok(s) = String::from_utf8(decoded) {
                                                stderr_accum.push_str(&s);
                                            }
                                        }
                                    }
                                }
                                if let Some(end) = event.get("end") {
                                    if let Some(code) = end.get("exitCode").or_else(|| end.get("exit_code")).and_then(|v| v.as_i64()) {
                                        exit_code = code as i32;
                                    }
                                }
                            }
                        }
                    }

                    buffer.drain(0..5 + length);
                } else {
                    break;
                }
            }
        }

        let combined_output = if stderr_accum.is_empty() {
            stdout_accum
        } else if stdout_accum.is_empty() {
            stderr_accum
        } else {
            format!("{}\n{}", stdout_accum, stderr_accum)
        };

        println!("[DEBUG E2B] Result: exit_code={}, combined_output={:?}", exit_code, combined_output);
        Ok((combined_output, exit_code))
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
