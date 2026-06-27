use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;
use crate::sandbox_core::config::{get_sandbox_config, get_api_base};
use crate::sandbox_core::daytona::volume::get_or_create_volume;

/// 创建 Daytona 沙盒，等待 started 状态后返回 sandbox_id
pub async fn create_sandbox(db: &DbManager, cfg: &SandboxConfig) -> anyhow::Result<String> {
    crate::emit_info(&flock_core::tr("正在向云端申请启动 Daytona 沙盒...", "Requesting to start Daytona sandbox from the cloud..."));

    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let workspace_id = crate::get_workspace_dir()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| "default".to_string());

    let volume_id = match get_or_create_volume(cfg, &workspace_id).await {
        Ok(id) => Some(id),
        Err(e) => {
            crate::emit_info(&format!("未能创建或获取云端 Volume: {} (将使用临时沙盒存储)", e));
            None
        }
    };

    let mut create_body = serde_json::json!({ "public": true });

    if let Some(ref snap_name) = cfg.snapshot {
        if !snap_name.trim().is_empty() {
            create_body["snapshot"] = serde_json::Value::String(snap_name.trim().to_string());
        }
    }

    if let Some(vid) = volume_id {
        let mount_path = "/workspace";
        create_body["volumes"] = serde_json::json!([
            {
                "volumeId": vid,
                "mountPath": mount_path
            }
        ]);
    }

    let create_url = format!("{}/api/sandbox", base);

    let mut last_error = None;
    let mut res = None;
    for attempt in 1..=3 {
        crate::emit_info(&flock_core::tr(
            &format!("尝试创建 Daytona 沙盒 (第{}次)...", attempt),
            &format!("Attempting to create Daytona sandbox (attempt {})...", attempt)
        ));

        match client.post(&create_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&create_body)
            .send()
            .await
        {
            Ok(response) => {
                res = Some(response);
                break;
            }
            Err(e) => {
                last_error = Some(anyhow::anyhow!("{}", e));
                if attempt < 3 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
            }
        }
    }

    let res = res.ok_or_else(|| last_error.unwrap_or_else(|| anyhow::anyhow!("Failed to create sandbox after 3 attempts")))?;

    let status = res.status();
    let res_text = res.text().await.unwrap_or_default();

    let val: serde_json::Value = match serde_json::from_str(&res_text) {
        Ok(v) => v,
        Err(e) => anyhow::bail!(
            "{}", flock_core::tr(
                &format!("解析沙盒创建响应为 JSON 失败: {}. HTTP 状态码: {}, 原始响应体: {}", e, status, res_text),
                &format!("Failed to parse sandbox creation response as JSON: {}. HTTP status code: {}, original response body: {}", e, status, res_text)
            )
        ),
    };

    let sandbox_id_val = val.get("id")
        .or_else(|| val.get("sandboxId"))
        .or_else(|| val.get("data").and_then(|d| d.get("id")))
        .or_else(|| val.get("data").and_then(|d| d.get("sandboxId")));

    let sandbox_id = match sandbox_id_val.and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => anyhow::bail!("{}", flock_core::tr(
            &format!("无法在响应中解析出沙盒ID。原始响应体: {}", val),
            &format!("Unable to parse sandbox ID from response. Original response body: {}", val)
        )),
    };

    // 等待沙盒 started/running
    let mut started = false;
    let mut last_status = flock_core::tr("未知", "Unknown");
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
                                last_status = flock_core::tr("字段缺失", "Missing field");
                            }
                        } else {
                            last_status = flock_core::tr("非JSON", "Not JSON");
                        }
                    }
                } else {
                    last_status = format!("HTTP {}", status_code);
                }
            }
            Err(e) => {
                last_status = flock_core::tr(
                    &format!("网络请求失败: {}", e),
                    &format!("Network request failed: {}", e)
                );
            }
        }

        if i % 3 == 0 || (last_status != "creating" && last_status != "pending" && last_status != "Unknown" && last_status != "未知") {
            crate::emit_info(&flock_core::tr(
                &format!("正在等待 Daytona 沙盒启动 (当前状态: {}, 已等待 {} 秒)...", last_status, i),
                &format!("Waiting for Daytona sandbox startup (current state: {}, waited {} seconds)...", last_status, i)
            ));
        }
    }

    if !started {
        anyhow::bail!(
            "{}", flock_core::tr(
                &format!("等待沙盒启动超时。最后状态: {}。最后响应体: {}", last_status, last_resp_body),
                &format!("Timeout waiting for sandbox startup. Last state: {}. Last response body: {}", last_status, last_resp_body)
            )
        );
    }

    crate::emit_info(&flock_core::tr("Daytona 沙盒已就绪。", "Daytona sandbox is ready."));
    let _ = set_sandbox_public(cfg, &sandbox_id, true).await;

    // 确保 /workspace 目录存在
    let ensure_workspace_cmd = "mkdir -p /workspace && ls -la /workspace";
    match crate::sandbox_core::daytona::execute_command_in_sandbox(db, &sandbox_id, ensure_workspace_cmd).await {
        Ok((out, code)) => {
            if code != 0 {
                crate::emit_info(&flock_core::tr(
                    &format!("创建 /workspace 目录失败 (退出码 {}): {}", code, out),
                    &format!("Failed to create /workspace directory (exit code {}): {}", code, out)
                ));
            }
        }
        Err(e) => {
            crate::emit_info(&flock_core::tr(
                &format!("检查 /workspace 目录失败: {}", e),
                &format!("Failed to check /workspace directory: {}", e)
            ));
        }
    }

    // Sync up local workspace
    if let Some(ws_path) = crate::get_workspace_dir() {
        if let Err(e) = crate::sandbox_core::daytona::sync::sync_up(db, &sandbox_id, &ws_path).await {
            crate::emit_info(&format!("Sync Up failed: {}", e));
        }
    }

    Ok(sandbox_id)
}

/// 销毁指定 Daytona 沙盒（通过 REST API）
pub async fn destroy_daytona_sandbox(cfg: &SandboxConfig, sandbox_id: &str) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let del_url = format!("{}/api/sandbox/{}", base, sandbox_id);
    match client.delete(&del_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                anyhow::bail!(flock_core::tr(
                    &format!("销毁 Daytona 沙盒返回非成功状态 (HTTP {}): {}", status, body),
                    &format!("Destroying Daytona sandbox returned non-success status (HTTP {}): {}", status, body)
                ));
            }
        }
        Err(e) => {
            anyhow::bail!(flock_core::tr(
                &format!("销毁 Daytona 沙盒请求失败: {}", e),
                &format!("Destroying Daytona sandbox request failed: {}", e)
            ));
        }
    }
    Ok(())
}

/// 检查 Daytona 沙盒是否存活
pub async fn check_sandbox_alive(cfg: &SandboxConfig, id: &str) -> bool {
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

pub async fn set_sandbox_public(
    cfg: &SandboxConfig,
    sandbox_id: &str,
    is_public: bool,
) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let url = format!("{}/api/sandbox/{}/public/{}", base, sandbox_id, is_public);

    let res = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    let status = res.status();
    if status.is_success() {
        Ok(())
    } else {
        let err_body = res.text().await.unwrap_or_default();
        crate::emit_info(&flock_core::tr(
            &format!("设置沙盒 public 属性失败 (HTTP {}): {}", status, err_body),
            &format!("Failed to set sandbox public attribute (HTTP {}): {}", status, err_body)
        ));
        anyhow::bail!("{}", flock_core::tr(
            &format!("设置沙盒 public 属性失败: {}", err_body),
            &format!("Failed to set sandbox public attribute: {}", err_body)
        ))
    }
}
