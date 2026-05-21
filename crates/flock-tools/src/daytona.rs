use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

static ACTIVE_SANDBOX_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn get_sandbox_id_mutex() -> &'static Mutex<Option<String>> {
    ACTIVE_SANDBOX_ID.get_or_init(|| Mutex::new(None))
}

/// 向前端发送"需要人工接管"事件
pub fn emit_human_takeover(call_id: &str, msg_id: &str, message: &str, remote_url: Option<String>) {
    if let Some(emitter) = crate::get_global_emitter() {
        let _ = emitter.emit(&flock_core::ipc_interface::events::ProtocolEvent::HumanTakeover {
            call_id: call_id.to_string(),
            msg_id: msg_id.to_string(),
            message: message.to_string(),
            remote_url,
        });
    }
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

    // 构造创建请求 body，如果配置了 snapshot 则使用它
    let create_body = if let Some(ref snap_name) = cfg.snapshot {
        if !snap_name.trim().is_empty() {
            crate::emit_info(&format!("使用自定义 Snapshot: {}...", snap_name));
            serde_json::json!({ "snapshot": snap_name.trim() })
        } else {
            serde_json::json!({})
        }
    } else {
        serde_json::json!({})
    };

    let create_url = format!("{}/sandbox", api_url);
    let res = client.post(&create_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&create_body)
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
    let mut last_status = "未知".to_string();
    let mut last_resp_body = String::new();
    
    for i in 1..=90 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let get_url = format!("{}/sandbox/{}", api_url, sandbox_id);
        let check_res = client.get(&get_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await;

        match check_res {
            Ok(resp) => {
                let status_code = resp.status();
                if status_code.is_success() {
                    if let Ok(resp_text) = resp.text().await {
                        last_resp_body = resp_text.clone();
                        if let Ok(info_val) = serde_json::from_str::<serde_json::Value>(&resp_text) {
                            let status_val = info_val.get("state")
                                .or_else(|| info_val.get("status"))
                                .or_else(|| info_val.get("data").and_then(|d| d.get("state")))
                                .or_else(|| info_val.get("data").and_then(|d| d.get("status")));
                            if let Some(status_str) = status_val.and_then(|s| s.as_str()) {
                                last_status = status_str.to_string();
                                if status_str == "started" || status_str == "running" {
                                    started = true;
                                    break;
                                }
                            } else {
                                last_status = "字段缺失".to_string();
                            }
                        } else {
                            last_status = "非JSON".to_string();
                        }
                    } else {
                        last_status = "读取响应体失败".to_string();
                    }
                } else {
                    last_status = format!("HTTP {}", status_code);
                }
            }
            Err(e) => {
                last_status = format!("网络请求失败: {}", e);
            }
        }
        
        if i % 3 == 0 || (last_status != "creating" && last_status != "pending" && last_status != "未知") {
            crate::emit_info(&format!("正在等待沙盒启动 (当前状态: {}, 已等待 {} 秒)...", last_status, i));
        }
    }

    if !started {
        anyhow::bail!(
            "等待沙盒启动超时。最后状态: {}。最后响应体: {}", 
            last_status, last_resp_body
        );
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
                    let status_val = info_val.get("state")
                        .or_else(|| info_val.get("status"))
                        .or_else(|| info_val.get("data").and_then(|d| d.get("state")))
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

/// 启动沙盒中的 Computer Use（VNC桌面）
pub async fn start_computer_use_in_sandbox(
    db: &DbManager,
    sandbox_id: &str,
) -> anyhow::Result<()> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();

    let urls = if api_url.contains("app.daytona.io") {
        vec![
            format!("https://proxy.app.daytona.io/toolbox/{}/toolbox/computeruse/start", sandbox_id),
            format!("https://proxy.app.daytona.io/toolbox/{}/computeruse/start", sandbox_id),
        ]
    } else {
        let base = api_url.trim_end_matches("/api").trim_end_matches("/");
        vec![
            format!("{}/toolbox/{}/toolbox/computeruse/start", base, sandbox_id),
            format!("{}/toolbox/{}/computeruse/start", base, sandbox_id),
        ]
    };

    let client = reqwest::Client::new();
    let mut last_error = None;

    for url in urls {
        crate::emit_info(&format!("正在请求 Daytona 桌面启动端点: {}...", url));
        let res = client.post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&serde_json::json!({}))
            .send()
            .await;

        match res {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    crate::emit_info("Daytona 桌面拉起请求已发送。");
                    return Ok(());
                } else if status == reqwest::StatusCode::NOT_FOUND {
                    last_error = Some(anyhow::anyhow!("ComputerUse start API 返回 404: {}", url));
                    continue;
                } else {
                    let err_body = resp.text().await.unwrap_or_default();
                    return Err(anyhow::anyhow!("ComputerUse start API 响应失败 ({}): {}", url, err_body));
                }
            }
            Err(e) => {
                last_error = Some(anyhow::anyhow!("请求连接 Daytona 桌面端点失败: {}", e));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("无法连接沙盒 ComputerUse 启动接口")))
}

/// 检查沙盒中的 Computer Use（VNC桌面）状态
pub async fn check_computer_use_status(
    db: &DbManager,
    sandbox_id: &str,
) -> anyhow::Result<bool> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();

    let urls = if api_url.contains("app.daytona.io") {
        vec![
            format!("https://proxy.app.daytona.io/toolbox/{}/toolbox/computeruse/status", sandbox_id),
            format!("https://proxy.app.daytona.io/toolbox/{}/computeruse/status", sandbox_id),
        ]
    } else {
        let base = api_url.trim_end_matches("/api").trim_end_matches("/");
        vec![
            format!("{}/toolbox/{}/toolbox/computeruse/status", base, sandbox_id),
            format!("{}/toolbox/{}/computeruse/status", base, sandbox_id),
        ]
    };

    let client = reqwest::Client::new();
    let mut last_error = None;

    for url in urls {
        let res = client.get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await;

        match res {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let text = resp.text().await.unwrap_or_default();
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        // 兼容 data 嵌套或扁平的结构
                        let status_val = val.get("status")
                            .or_else(|| val.get("state"))
                            .or_else(|| val.get("data").and_then(|d| d.get("status")))
                            .or_else(|| val.get("data").and_then(|d| d.get("state")));
                        if let Some(status_str) = status_val.and_then(|s| s.as_str()) {
                            return Ok(status_str == "started" || status_str == "running" || status_str == "ready");
                        }
                    }
                    return Ok(true);
                } else if status == reqwest::StatusCode::NOT_FOUND {
                    last_error = Some(anyhow::anyhow!("ComputerUse status API 返回 404: {}", url));
                    continue;
                } else {
                    let err_body = resp.text().await.unwrap_or_default();
                    return Err(anyhow::anyhow!("ComputerUse status API 响应失败 ({}): {}", url, err_body));
                }
            }
            Err(e) => {
                last_error = Some(anyhow::anyhow!("请求连接 Daytona 桌面状态端点失败: {}", e));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("无法获取沙盒 ComputerUse 状态")))
}

/// 创建一个预装 Playwright 的 Daytona Snapshot
///
/// 流程：
/// 1. 创建一个临时沙盒（使用默认镜像）
/// 2. 在沙盒中安装 Playwright 及 Chromium
/// 3. 调用 Daytona Snapshot API 固化该沙盒
/// 4. 删除临时沙盒
///
/// 返回创建的 Snapshot 名称。
pub async fn create_playwright_snapshot(
    db: &DbManager,
    snapshot_name: &str,
) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let client = reqwest::Client::new();
    let api_url = cfg.api_url.as_ref().unwrap().trim_end_matches('/');
    let api_key = cfg.api_key.as_ref().unwrap();

    // 1. 创建一个临时沙盒（使用默认镜像，不使用 snapshot 避免循环）
    crate::emit_info("[Snapshot] 正在创建临时沙盒以安装 Playwright...");
    let create_url = format!("{}/sandbox", api_url);
    let res = client.post(&create_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({}))
        .send()
        .await?;

    let res_text = res.text().await.unwrap_or_default();
    let val: serde_json::Value = serde_json::from_str(&res_text)
        .map_err(|e| anyhow::anyhow!("解析沙盒创建响应失败: {}. 原始: {}", e, res_text))?;

    let sandbox_id = val.get("id")
        .or_else(|| val.get("sandboxId"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("无法解析临时沙盒 ID。原始: {}", val))?
        .to_string();

    // 等待沙盒启动
    crate::emit_info(&format!("[Snapshot] 等待临时沙盒 {} 就绪...", sandbox_id));
    for _ in 1..=60 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let get_url = format!("{}/sandbox/{}", api_url, sandbox_id);
        if let Ok(resp) = client.get(&get_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send().await
        {
            if let Ok(text) = resp.text().await {
                if let Ok(info) = serde_json::from_str::<serde_json::Value>(&text) {
                    let st = info.get("state").or_else(|| info.get("status"))
                        .and_then(|s| s.as_str()).unwrap_or("");
                    if st == "started" || st == "running" {
                        break;
                    }
                }
            }
        }
    }

    // 2. 在临时沙盒中安装 Playwright
    crate::emit_info("[Snapshot] 正在安装 Playwright + Chromium（需要约 2-3 分钟）...");
    let install_cmd = "python3 -m pip install playwright && python3 -m playwright install chromium && python3 -m playwright install-deps chromium && echo 'PLAYWRIGHT_DONE'";

    let exec_payload = serde_json::json!({
        "command": install_cmd,
        "cwd": "/home/daytona",
        "timeout": 300
    });

    let exec_urls = [
        format!("https://proxy.app.daytona.io/toolbox/{}/toolbox/process/execute", sandbox_id),
        format!("https://proxy.app.daytona.io/toolbox/{}/process/execute", sandbox_id),
    ];

    let mut install_ok = false;
    for exec_url in &exec_urls {
        if let Ok(exec_resp) = client.post(exec_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&exec_payload)
            .send().await
        {
            if exec_resp.status().is_success() {
                let out = exec_resp.text().await.unwrap_or_default();
                if out.contains("PLAYWRIGHT_DONE") {
                    install_ok = true;
                    crate::emit_info("[Snapshot] Playwright 安装完成！");
                    break;
                }
            }
        }
    }

    if !install_ok {
        // 清理临时沙盒
        let del_url = format!("{}/sandbox/{}", api_url, sandbox_id);
        let _ = client.delete(&del_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send().await;
        anyhow::bail!("[Snapshot] Playwright 安装失败，已清理临时沙盒。");
    }

    // 3. 调用 Snapshot API 固化沙盒
    crate::emit_info(&format!("[Snapshot] 正在固化 Snapshot: {}...", snapshot_name));
    let snap_url = format!("{}/sandbox/{}/snapshot", api_url, sandbox_id);
    let snap_res = client.post(&snap_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({ "name": snapshot_name }))
        .send()
        .await?;

    let snap_status = snap_res.status();
    let snap_body = snap_res.text().await.unwrap_or_default();
    if !snap_status.is_success() {
        // 清理临时沙盒
        let del_url = format!("{}/sandbox/{}", api_url, sandbox_id);
        let _ = client.delete(&del_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send().await;
        anyhow::bail!("[Snapshot] 固化 Snapshot 失败 (HTTP {}): {}", snap_status, snap_body);
    }

    crate::emit_info(&format!("[Snapshot] Snapshot '{}' 创建成功！正在清理临时沙盒...", snapshot_name));

    // 4. 删除临时沙盒
    let del_url = format!("{}/sandbox/{}", api_url, sandbox_id);
    let _ = client.delete(&del_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send().await;

    crate::emit_info(&format!("[Snapshot] 完成！今后创建的沙盒将自动使用 '{}' 快照，无需再次安装 Playwright。", snapshot_name));
    Ok(snapshot_name.to_string())
}
