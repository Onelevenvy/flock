use serde::{Deserialize, Serialize};
use flock_core::db::DbManager;
use crate::sandbox_core::daytona::config::get_sandbox_config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaytonaSandboxResponse {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
struct ExecuteRequest {
    pub command: String,
    pub cwd: Option<String>,
    pub timeout: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ExecuteResponse {
    pub result: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
}

/// 在 Daytona 沙盒中执行指令（通过 Toolbox API），带端点兼容重试机制
pub async fn execute_command_in_sandbox(
    db: &DbManager,
    sandbox_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("Daytona 沙箱未配置或未启用"))?;

    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();

    let urls = if api_url.contains("app.daytona.io") {
        vec!(
            format!("https://proxy.app.daytona.io/toolbox/{}/toolbox/process/execute", sandbox_id),
            format!("https://proxy.app.daytona.io/toolbox/{}/process/execute", sandbox_id),
        )
    } else {
        let base = api_url.trim_end_matches("/api").trim_end_matches("/");
        vec!(
            format!("{}/toolbox/{}/toolbox/process/execute", base, sandbox_id),
            format!("{}/toolbox/{}/process/execute", base, sandbox_id),
        )
    };

    let client = reqwest::Client::new();
    let payload = ExecuteRequest {
        command: command.to_string(),
        cwd: Some("/workspace".to_string()),
        timeout: Some(60),
    };

    let mut last_error = None;
    let max_retries = 3;

    for attempt in 1..=max_retries {
        for url in &urls {
            let res = client.post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&payload)
                .send()
                .await;

            match res {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        let resp_text = resp.text().await.unwrap_or_default();
                        if let Ok(exec_res) = serde_json::from_str::<ExecuteResponse>(&resp_text) {
                            let result = exec_res.result.unwrap_or_default();
                            let exit_code = exec_res.exit_code.unwrap_or(0);
                            return Ok((result, exit_code));
                        } else {
                            return Err(anyhow::anyhow!("解析执行响应失败。原始响应体: {}", resp_text));
                        }
                    } else if status == reqwest::StatusCode::NOT_FOUND {
                        last_error = Some(anyhow::anyhow!("Toolbox API 返回 404: {}", url));
                        continue;
                    } else if status.is_server_error() || status.as_u16() == 502 || status.as_u16() == 503 {
                        last_error = Some(anyhow::anyhow!("Toolbox API 响应服务端错误 ({}): {}", url, status));
                    } else {
                        let err_body = resp.text().await.unwrap_or_default();
                        return Err(anyhow::anyhow!("Toolbox API 响应失败 ({}): {}", url, err_body));
                    }
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("请求连接 Toolbox 失败: {}", e));
                }
            }
        }

        if attempt < max_retries {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("无法连接沙盒 Toolbox API 终结点")))
}
