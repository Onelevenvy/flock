use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

static ACTIVE_SANDBOX_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn get_sandbox_id_mutex() -> &'static Mutex<Option<String>> {
    ACTIVE_SANDBOX_ID.get_or_init(|| Mutex::new(None))
}

pub async fn get_active_sandbox_id() -> Option<String> {
    let mutex = get_sandbox_id_mutex();
    let lock = mutex.lock().await;
    lock.clone()
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

/// 从用户配置的 api_url 中提取 Daytona REST API base URL。
///
/// Daytona 官方云端 (app.daytona.io) 的 API 路径以 `/sandbox`, `/snapshots` 开头，
/// 不含 `/api` 前缀。但用户配置的 api_url 通常是 `https://app.daytona.io/api`，
/// 因此我们需要去掉末尾的 `/api`。
///
/// 对于自建 Daytona 实例，保持 api_url 不变。
pub fn get_api_base(api_url: &str) -> String {
    let trimmed = api_url.trim_end_matches('/');
    if trimmed.ends_with("/api") {
        trimmed[..trimmed.len() - 4].to_string()
    } else {
        trimmed.to_string()
    }
}

/// 销毁当前活跃的沙盒（DELETE /sandbox/{id}），并清除缓存。
/// 由 Agent 停止事件或手动触发调用。
pub async fn destroy_active_sandbox(db: &DbManager) -> anyhow::Result<()> {
    let cfg = match get_sandbox_config(db).await {
        Some(c) => c,
        None => return Ok(()), // 未配置，无需操作
    };

    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;

    let sandbox_id = match lock.as_ref() {
        Some(id) => id.clone(),
        None => return Ok(()), // 没有活跃沙盒
    };

    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    crate::emit_info(&format!("正在销毁 Daytona 沙盒 {}...", sandbox_id));
    let del_url = format!("{}/api/sandbox/{}", base, sandbox_id);
    match client.delete(&del_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                crate::emit_info(&format!("Daytona 沙盒 {} 已销毁。", sandbox_id));
            } else {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                crate::emit_info(&format!("销毁沙盒返回非成功状态 (HTTP {}): {}", status, body));
            }
        }
        Err(e) => {
            crate::emit_info(&format!("销毁沙盒请求失败: {}", e));
        }
    }

    *lock = None;
    Ok(())
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
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
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

    let create_url = format!("{}/api/sandbox", base);
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
        let get_url = format!("{}/api/sandbox/{}", base, sandbox_id);
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
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();
    let get_url = format!("{}/api/sandbox/{}", base, id);

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
                    crate::emit_info(&format!("[VNC Status] 接口返回: {}", text));
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        // 兼容 data 嵌套或扁平的结构
                        let status_val = val.get("status")
                            .or_else(|| val.get("state"))
                            .or_else(|| val.get("data").and_then(|d| d.get("status")))
                            .or_else(|| val.get("data").and_then(|d| d.get("state")));
                        if let Some(status_str) = status_val.and_then(|s| s.as_str()) {
                            let s_lower = status_str.to_lowercase();
                            return Ok(s_lower == "started" || s_lower == "running" || s_lower == "ready" || s_lower == "active");
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

/// 确保沙盒中 VNC 桌面相关进程正在后台运行，具有自愈拉起和 setsid/nohup 防进程清理机制。
pub async fn ensure_vnc_running_in_sandbox(db: &DbManager, sandbox_id: &str) -> anyhow::Result<()> {
    // 检查 websockify 是否已经在运行且在 6080 监听
    let check_cmd = "python3 -c \"import socket; s = socket.socket(); s.connect(('127.0.0.1', 6080))\"";
    let (_, exit_code) = execute_command_in_sandbox(db, sandbox_id, check_cmd).await.unwrap_or(("-1".to_string(), -1));
    if exit_code == 0 {
        crate::emit_info("检测到 VNC 桌面服务已经在运行。");
        return Ok(());
    }

    crate::emit_info("检测到 VNC 服务未运行，手动拉起 Xvfb, VNC, noVNC...");
    let launch_cmd = "sh -c '\
        export DISPLAY=:0 && \
        rm -f /tmp/.X0-lock && \
        setsid nohup Xvfb :0 -screen 0 1280x1024x24 >/tmp/xvfb.log 2>&1 & \
        sleep 1 && \
        setsid nohup fluxbox >/tmp/fluxbox.log 2>&1 & \
        sleep 1 && \
        setsid nohup x11vnc -display :0 -forever -shared -nopw -rfbport 5900 >/tmp/x11vnc.log 2>&1 & \
        sleep 1 && \
        setsid nohup websockify --web /usr/share/novnc 0.0.0.0:6080 localhost:5900 >/tmp/websockify.log 2>&1 & \
        sleep 1'";
    
    let (out, code) = execute_command_in_sandbox(db, sandbox_id, launch_cmd).await?;
    if code != 0 {
        crate::emit_info(&format!("手动拉起桌面服务进程失败 (退出码 {}): {}", code, out));
    } else {
        crate::emit_info("手动拉起桌面服务进程指令已发送。");
    }
    
    Ok(())
}

/// 创建一个预装 Playwright 的 Daytona Snapshot
pub async fn create_playwright_snapshot(
    db: &DbManager,
    snapshot_name: &str,
) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let client = reqwest::Client::new();
    let base_url = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    // 1. 发送 POST /api/snapshots 请求
    crate::emit_info(&format!("[Snapshot] 正在向 Daytona 发送快照构建请求: {}...", snapshot_name));
    let snap_url = format!("{}/api/snapshots", base_url);
    
    let payload = serde_json::json!({
        "name": snapshot_name,
        "cpu": 1,
        "gpu": 0,
        "memory": 2,
        "disk": 3,
        "buildInfo": {
            "dockerfileContent": "FROM daytonaio/sandbox:latest\nUSER root\nENV DEBIAN_FRONTEND=noninteractive\nENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers\nRUN mkdir -p /opt/playwright-browsers && chmod 777 /opt/playwright-browsers\nRUN apt-get update && apt-get install -y python3-pip xvfb x11vnc novnc websockify fluxbox chromium && python3 -m pip install --break-system-packages playwright && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install-deps chromium && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install chromium\nUSER daytona"
        }
    });

    let res = client.post(&snap_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await?;

    let status = res.status();
    let res_text = res.text().await.unwrap_or_default();
    
    if !status.is_success() {
        anyhow::bail!("创建快照请求失败 (HTTP {}): {}", status, res_text);
    }

    let val: serde_json::Value = serde_json::from_str(&res_text)
        .map_err(|e| anyhow::anyhow!("解析快照创建响应失败: {}. 原始: {}", e, res_text))?;

    let snapshot_id = val.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("响应中没有 snapshot id。原始: {}", val))?
        .to_string();

    crate::emit_info(&format!("[Snapshot] 快照已在云端开始构建 (ID: {})。构建时间通常需要 3-5 分钟，正在等待构建完成...", snapshot_id));

    // 2. 轮询快照状态
    let mut success = false;
    let mut last_state = "未知".to_string();
    
    for i in 1..=300 { // 等待最多 10 分钟（每次循环睡眠 2 秒，300次 = 600秒 = 10分钟）
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let get_url = format!("{}/api/snapshots/{}", base_url, snapshot_id);
        
        let check_res = client.get(&get_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await;

        if let Ok(resp) = check_res {
            if resp.status().is_success() {
                if let Ok(text) = resp.text().await {
                    if let Ok(info) = serde_json::from_str::<serde_json::Value>(&text) {
                        let state_val = info.get("state")
                            .or_else(|| info.get("snapshotState"))
                            .or_else(|| info.get("data").and_then(|d| d.get("state")))
                            .or_else(|| info.get("data").and_then(|d| d.get("snapshotState")));
                            
                        if let Some(state_str) = state_val.and_then(|s| s.as_str()) {
                            last_state = state_str.to_string();
                            if state_str == "active" || state_str == "Completed" {
                                success = true;
                                break;
                            } else if state_str == "error" || state_str == "build_failed" || state_str == "Error" {
                                let err_reason = info.get("errorReason")
                                    .or_else(|| info.get("data").and_then(|d| d.get("errorReason")))
                                    .and_then(|e| e.as_str())
                                    .unwrap_or("未知构建错误");
                                anyhow::bail!("快照构建失败，原因为: {}", err_reason);
                            }
                        }
                    }
                }
            }
        }
        
        if i % 15 == 0 {
            crate::emit_info(&format!("正在等待快照构建 (当前状态: {}, 已等待 {} 秒)...", last_state, i * 2));
        }
    }

    if !success {
        anyhow::bail!("等待快照构建超时，最后状态: {}", last_state);
    }

    crate::emit_info(&format!("[Snapshot] 快照 '{}' 已构建并就绪！", snapshot_name));
    Ok(snapshot_name.to_string())
}

/// 获取沙盒 6080 端口的 Signed Preview URL，并自动转化为 noVNC 控制台 URL。
pub async fn get_sandbox_vnc_url(
    db: &DbManager,
    sandbox_id: &str,
) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let url = format!("{}/api/sandbox/{}/ports/6080/signed-preview-url", base, sandbox_id);
    let resp = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        anyhow::bail!("获取签名预览URL失败 (HTTP {}): {}", status, text);
    }

    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| anyhow::anyhow!("解析签名URL响应失败: {}. 原始响应: {}", e, text))?;

    let mut url_str = val.get("url")
        .or_else(|| val.get("signedUrl"))
        .or_else(|| val.get("signed_url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if val.is_string() {
                val.as_str().unwrap().to_string()
            } else {
                text
            }
        });

    // 格式化为 vnc.html 路径并带有自连参数
    if !url_str.contains("vnc.html") {
        if let Some(pos) = url_str.find('?') {
            let (host, query) = url_str.split_at(pos);
            let mut extra = String::new();
            if !query.contains("autoconnect=") {
                extra.push_str("&autoconnect=true");
            }
            if !query.contains("resize=") {
                extra.push_str("&resize=scale");
            }
            if !query.contains("skip-preview-warning=") {
                extra.push_str("&skip-preview-warning=true");
            }
            if !query.contains("skip_preview_warning=") {
                extra.push_str("&skip_preview_warning=true");
            }
            url_str = format!("{}/vnc.html{}{}", host, query, extra);
        } else {
            url_str = format!("{}/vnc.html?autoconnect=true&resize=scale&skip-preview-warning=true&skip_preview_warning=true", url_str.trim_end_matches('/'));
        }
    } else {
        if let Some(pos) = url_str.find('?') {
            let (host, query) = url_str.split_at(pos);
            let mut extra = String::new();
            if !query.contains("autoconnect=") {
                extra.push_str("&autoconnect=true");
            }
            if !query.contains("resize=") {
                extra.push_str("&resize=scale");
            }
            if !query.contains("skip-preview-warning=") {
                extra.push_str("&skip-preview-warning=true");
            }
            if !query.contains("skip_preview_warning=") {
                extra.push_str("&skip_preview_warning=true");
            }
            url_str = format!("{}{}{}", host, query, extra);
        } else {
            url_str = format!("{}?autoconnect=true&resize=scale&skip-preview-warning=true&skip_preview_warning=true", url_str);
        }
    }

    Ok(url_str)
}
