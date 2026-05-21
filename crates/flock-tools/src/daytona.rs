use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

static ACTIVE_SANDBOX_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn get_sandbox_id_mutex() -> &'static Mutex<Option<String>> {
    ACTIVE_SANDBOX_ID.get_or_init(|| Mutex::new(None))
}

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

/// 获取当前启用的沙盒配置。若未启用或未配置，则返回 None。
pub async fn get_sandbox_config(db: &DbManager) -> Option<SandboxConfig> {
    let cfg: SandboxConfig = db.get_config("sandbox").await?;
    if cfg.enabled && cfg.api_url.is_some() && cfg.api_key.is_some() {
        Some(cfg)
    } else {
        None
    }
}

/// 获取或创建活跃的沙盒 ID
pub async fn get_or_create_active_sandbox(db: &DbManager) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未启用或未配置。请在系统设置中配置有效的 API 地址和密钥。"))?;

    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    
    // 如果缓存中有 ID，进行探活
    if let Some(id) = lock.as_ref() {
        crate::emit_info(&format!("正在检查 Daytona 沙盒 {} 的健康状态...", id));
        if check_sandbox_alive(&cfg, id).await {
            crate::emit_info(&format!("Daytona 沙盒 {} 已就绪 (复用中)", id));
            return Ok(id.clone());
        }
        crate::emit_info(&format!("Daytona 沙盒 {} 已失效，准备重新创建...", id));
        *lock = None;
    }

    crate::emit_info("正在向云端申请创建新 Daytona 沙盒...");
    
    let client = reqwest::Client::new();
    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();

    let create_url = format!("{}/sandbox", api_url);
    let res = client.post(&create_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({}))
        .send()
        .await?;

    let status = res.status();
    let res_text = res.text().await.unwrap_or_default();
    
    let val: serde_json::Value = match serde_json::from_str(&res_text) {
        Ok(v) => v,
        Err(e) => anyhow::bail!(
            "解析沙盒创建响应为 JSON 失败: {}. HTTP 状态码: {}, 原始响应体: {}", 
            e, status, res_text
        ),
    };
    
    // 灵活支持 id/sandboxId 扁平或 data 嵌套结构
    let sandbox_id_val = val.get("id")
        .or_else(|| val.get("sandboxId"))
        .or_else(|| val.get("data").and_then(|d| d.get("id")))
        .or_else(|| val.get("data").and_then(|d| d.get("sandboxId")));

    let sandbox_id = match sandbox_id_val.and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => anyhow::bail!("无法在响应中解析出沙盒ID。原始响应体: {}", val),
    };

    // 轮询等待沙盒变为 "started" 状态
    crate::emit_info(&format!("Daytona 沙盒创建成功 (ID: {})。启动中，正在等待网络与系统就绪...", sandbox_id));
    
    let mut started = false;
    for i in 1..=30 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let get_url = format!("{}/sandbox/{}", api_url, sandbox_id);
        let check_res = client.get(&get_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await;

        if let Ok(resp) = check_res {
            if resp.status().is_success() {
                if let Ok(resp_text) = resp.text().await {
                    if let Ok(info_val) = serde_json::from_str::<serde_json::Value>(&resp_text) {
                        let status_val = info_val.get("status")
                            .or_else(|| info_val.get("data").and_then(|d| d.get("status")));
                        if let Some(status_str) = status_val.and_then(|s| s.as_str()) {
                            if status_str == "started" || status_str == "running" {
                                started = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
        if i % 5 == 0 {
            crate::emit_info(&format!("正在等待沙盒启动 (已等待 {} 秒)...", i));
        }
    }

    if !started {
        anyhow::bail!("等待沙盒启动超时。请稍后重试。");
    }

    crate::emit_info("Daytona 沙盒已就绪。");
    *lock = Some(sandbox_id.clone());
    Ok(sandbox_id)
}

/// 检查沙盒是否还存活
async fn check_sandbox_alive(cfg: &SandboxConfig, id: &str) -> bool {
    let client = reqwest::Client::new();
    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();
    let get_url = format!("{}/sandbox/{}", api_url, id);

    let res = client.get(&get_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await;

    if let Ok(resp) = res {
        if resp.status().is_success() {
            if let Ok(resp_text) = resp.text().await {
                if let Ok(info_val) = serde_json::from_str::<serde_json::Value>(&resp_text) {
                    let status_val = info_val.get("status")
                        .or_else(|| info_val.get("data").and_then(|d| d.get("status")));
                    if let Some(status_str) = status_val.and_then(|s| s.as_str()) {
                        return status_str == "started" || status_str == "running";
                    }
                }
            }
        }
    }
    false
}

/// 在沙盒中执行指令，带有端点兼容重试机制
pub async fn execute_command_in_sandbox(
    db: &DbManager,
    sandbox_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();
    
    // 生成 Toolbox 执行请求 of URL list
    let urls = if api_url.contains("app.daytona.io") {
        vec!(
            format!("https://proxy.app.daytona.io/toolbox/{}/toolbox/process/execute", sandbox_id),
            format!("https://proxy.app.daytona.io/toolbox/{}/process/execute", sandbox_id),
        )
    } else {
        // 自建模式
        let base = api_url.trim_end_matches("/api").trim_end_matches("/");
        vec!(
            format!("{}/toolbox/{}/toolbox/process/execute", base, sandbox_id),
            format!("{}/toolbox/{}/process/execute", base, sandbox_id),
        )
    };

    let client = reqwest::Client::new();
    let payload = ExecuteRequest {
        command: command.to_string(),
        cwd: Some("/home/daytona".to_string()),
        timeout: Some(60),
    };

    let mut last_error = None;
    for url in urls {
        let res = client.post(&url)
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
                    // 如果 404，我们尝试下一个候选 endpoint
                    last_error = Some(anyhow::anyhow!("Toolbox API 返回 404: {}", url));
                    continue;
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

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("无法连接沙盒 Toolbox API 终结点")))
}
