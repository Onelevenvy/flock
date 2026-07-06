use flock_core::config::settings::SandboxConfig;

/// 在 E2B 沙盒中执行命令（通过 Connect Protocol）
/// 返回 (combined_output, exit_code)
pub async fn execute_command(
    cfg: &SandboxConfig,
    sandbox_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
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
            cwd: "/home/user".to_string(),
        },
    };

    let body_str = serde_json::to_string(&payload)?;

    // 拼接 5 字节的 Connect 协议信封头部 (1 字节 flag + 4 字节大端序长度)
    let mut req_body = Vec::new();
    req_body.push(0x00);
    req_body.extend_from_slice(&(body_str.len() as u32).to_be_bytes());
    req_body.extend_from_slice(body_str.as_bytes());

    let resp = client.post(&url)
        .header("X-API-Key", api_key)
        .header("Connect-Protocol-Version", "1")
        .header("Content-Type", "application/connect+json")
        .header(reqwest::header::USER_AGENT, "flock-agent")
        .body(req_body)
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

    let response_bytes = resp.bytes().await?;
    let mut buffer = response_bytes.to_vec();
    let mut idx = 0;

    while idx + 5 <= buffer.len() {
        let flags = buffer[idx];
        let length = u32::from_be_bytes([buffer[idx+1], buffer[idx+2], buffer[idx+3], buffer[idx+4]]) as usize;

        if idx + 5 + length <= buffer.len() {
            let payload_bytes = &buffer[idx+5..idx+5+length];

            if flags == 0x00 {
                if let Ok(val) = serde_json::from_slice::<serde_json::Value>(payload_bytes) {
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

            idx += 5 + length;
        } else {
            break;
        }
    }

    let combined_output = if stderr_accum.is_empty() {
        stdout_accum
    } else if stdout_accum.is_empty() {
        stderr_accum
    } else {
        format!("{}\n{}", stdout_accum, stderr_accum)
    };

    Ok((combined_output, exit_code))
}

/// 获取 E2B 沙盒的 VNC URL（desktop 模板内置 noVNC on port 6080）
/// 直接返回固定格式 URL，不检查端口，不拉起任何进程。
pub fn get_vnc_url(sandbox_id: &str) -> String {
    format!(
        "https://6080-{}.e2b.app/vnc.html?autoconnect=true&resize=scale&path=websockify",
        sandbox_id
    )
}
