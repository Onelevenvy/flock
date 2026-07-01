use flock_core::db::DbManager;
use crate::sandbox_core::config::{get_sandbox_config, get_api_base};
use crate::sandbox_core::daytona::{DISPLAY_ID, SCREEN_RESOLUTION, X11VNC_PORT, WEBSOCKIFY_PORT};

/// 创建一个预装 Playwright 的 Daytona Snapshot
pub async fn create_playwright_snapshot(
    db: &DbManager,
    snapshot_name: &str,
) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr("云端 Daytona 沙箱未配置或未启用", "Cloud Daytona sandbox not configured or enabled")))?;

    let client = reqwest::Client::new();
    let base_url = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    // 1. 发送 POST /api/snapshots 请求
    crate::emit_info(&flock_core::tr(
        &format!("[Snapshot] 正在向 Daytona 发送快照构建请求: {}...", snapshot_name),
        &format!("[Snapshot] Sending snapshot build request to Daytona: {}...", snapshot_name)
    ));
    let snap_url = format!("{}/api/snapshots", base_url);
    
    let dockerfile_content = format!(
        "FROM daytonaio/sandbox:latest\nUSER root\nENV DEBIAN_FRONTEND=noninteractive\nENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers\nRUN mkdir -p /opt/playwright-browsers && chmod 777 /opt/playwright-browsers\nRUN apt-get update && apt-get install -y python3-pip xvfb x11vnc novnc websockify fluxbox chromium xterm lxterminal fonts-wqy-zenhei fonts-wqy-microhei fonts-noto-cjk && python3 -m pip install --break-system-packages playwright && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install-deps chromium && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install chromium\nRUN printf '#!/bin/bash\\nexport DISPLAY={display}\\nrm -f /tmp/.X0-lock\\nsetsid Xvfb {display} -screen 0 {res} >/tmp/xvfb.log 2>&1 &\\nsleep 1\\nsetsid fluxbox >/tmp/fluxbox.log 2>&1 &\\nsleep 1\\nsetsid x11vnc -display {display} -forever -shared -nopw -rfbport {vnc_port} >/tmp/x11vnc.log 2>&1 &\\nsleep 1\\nsetsid websockify --web /usr/share/novnc 0.0.0.0:{web_port} localhost:{vnc_port} >/tmp/websockify.log 2>&1 &\\nsleep 1\\n' > /usr/local/bin/start-vnc && chmod +x /usr/local/bin/start-vnc\nUSER daytona",
        display = DISPLAY_ID,
        res = SCREEN_RESOLUTION,
        vnc_port = X11VNC_PORT,
        web_port = WEBSOCKIFY_PORT
    );

    let payload = serde_json::json!({
        "name": snapshot_name,
        "cpu": 1,
        "gpu": 0,
        "memory": 2,
        "disk": 3,
        "buildInfo": {
            "dockerfileContent": dockerfile_content
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
        anyhow::bail!("{}", flock_core::tr(
            &format!("创建快照请求失败 (HTTP {}): {}", status, res_text),
            &format!("Failed to request snapshot creation (HTTP {}): {}", status, res_text)
        ));
    }

    let val: serde_json::Value = serde_json::from_str(&res_text)
        .map_err(|e| anyhow::anyhow!(flock_core::tr(
            &format!("解析快照创建响应失败: {}. 原始: {}", e, res_text),
            &format!("Failed to parse snapshot creation response: {}. Original: {}", e, res_text)
        )))?;

    let snapshot_id = val.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr(
            &format!("响应中没有 snapshot id。原始: {}", val),
            &format!("No snapshot ID in response. Original: {}", val)
        )))?
        .to_string();

    crate::emit_info(&flock_core::tr(
        &format!("[Snapshot] 快照已在云端开始构建 (ID: {})。构建时间通常需要 3-5 分钟，正在等待构建完成...", snapshot_id),
        &format!("[Snapshot] Snapshot build has started in the cloud (ID: {}). Building usually takes 3-5 minutes, waiting for completion...", snapshot_id)
    ));

    // 2. 轮询快照状态
    let mut success = false;
    let mut last_state = flock_core::tr("未知", "Unknown");
    
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
                                let err_reason_str = flock_core::tr("未知构建错误", "Unknown build error");
                                let err_reason = info.get("errorReason")
                                    .or_else(|| info.get("data").and_then(|d| d.get("errorReason")))
                                    .and_then(|e| e.as_str())
                                    .unwrap_or(&err_reason_str);
                                anyhow::bail!("{}", flock_core::tr(
                                    &format!("快照构建失败，原因为: {}", err_reason),
                                    &format!("Snapshot build failed, reason: {}", err_reason)
                                ));
                            }
                        }
                    }
                }
            }
        }
        
        if i % 15 == 0 {
            crate::emit_info(&flock_core::tr(
                &format!("正在等待快照构建 (当前状态: {}, 已等待 {} 秒)...", last_state, i * 2),
                &format!("Waiting for snapshot build (current state: {}, waited {} seconds)...", last_state, i * 2)
            ));
        }
    }

    if !success {
        anyhow::bail!("{}", flock_core::tr(
            &format!("等待快照构建超时，最后状态: {}", last_state),
            &format!("Timeout waiting for snapshot build, last state: {}", last_state)
        ));
    }

    crate::emit_info(&flock_core::tr(
        &format!("[Snapshot] 快照 '{}' 已构建并就绪！", snapshot_name),
        &format!("[Snapshot] Snapshot '{}' is built and ready!", snapshot_name)
    ));
    Ok(snapshot_name.to_string())
}
