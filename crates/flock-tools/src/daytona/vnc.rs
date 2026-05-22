use flock_core::db::DbManager;
use crate::daytona::config::{get_sandbox_config, get_api_base};
use crate::daytona::exec::execute_command_in_sandbox;

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
        if command -v start-vnc >/dev/null 2>&1; then \
            start-vnc; \
        else \
            export DISPLAY=:0 && \
            rm -f /tmp/.X0-lock && \
            setsid nohup Xvfb :0 -screen 0 1280x1024x24 >/tmp/xvfb.log 2>&1 & \
            sleep 1 && \
            setsid nohup fluxbox >/tmp/fluxbox.log 2>&1 & \
            sleep 1 && \
            setsid nohup x11vnc -display :0 -forever -shared -nopw -rfbport 5900 >/tmp/x11vnc.log 2>&1 & \
            sleep 1 && \
            setsid nohup websockify --web /usr/share/novnc 0.0.0.0:6080 localhost:5900 >/tmp/websockify.log 2>&1 & \
            sleep 1; \
        fi'";
    
    let (out, code) = execute_command_in_sandbox(db, sandbox_id, launch_cmd).await?;
    if code != 0 {
        crate::emit_info(&format!("手动拉起桌面服务进程失败 (退出码 {}): {}", code, out));
    } else {
        crate::emit_info("手动拉起桌面服务进程指令已发送。");
    }
    
    Ok(())
}

/// 获取沙盒 6080 端口 of Preview URL，并自动转化为 noVNC 控制台 URL。
/// 当沙盒为 public 时，此 URL 可直接免鉴权访问，规避 Signed Preview URL 的安全警告页面。
pub async fn get_sandbox_vnc_url(
    db: &DbManager,
    sandbox_id: &str,
) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("云端 Daytona 沙箱未配置或未启用"))?;

    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let url = format!("{}/api/sandbox/{}/ports/6080/preview-url", base, sandbox_id);
    let resp = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        anyhow::bail!("获取预览URL失败 (HTTP {}): {}", status, text);
    }

    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| anyhow::anyhow!("解析预览URL响应失败: {}. 原始响应: {}", e, text))?;

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

    if url_str.starts_with("http://") {
        url_str = url_str.replacen("http://", "https://", 1);
    }

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
