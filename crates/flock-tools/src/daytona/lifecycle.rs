use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;
use crate::daytona::state::get_sandbox_id_mutex;
use crate::daytona::config::{get_sandbox_config, get_api_base};

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

    crate::emit_info(&flock_core::tr(&format!("正在销毁 Daytona 沙盒 {}...", sandbox_id), &format!("Destroying Daytona sandbox {}...", sandbox_id)));
    let del_url = format!("{}/api/sandbox/{}", base, sandbox_id);
    match client.delete(&del_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                crate::emit_info(&flock_core::tr(&format!("Daytona 沙盒 {} 已销毁。", sandbox_id), &format!("Daytona sandbox {} has been destroyed.", sandbox_id)));
            } else {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                crate::emit_info(&flock_core::tr(&format!("销毁沙盒返回非成功状态 (HTTP {}): {}", status, body), &format!("Destroying sandbox returned non-success status (HTTP {}): {}", status, body)));
            }
        }
        Err(e) => {
            crate::emit_info(&flock_core::tr(&format!("销毁沙盒请求失败: {}", e), &format!("Destroying sandbox request failed: {}", e)));
        }
    }

    *lock = None;
    Ok(())
}

/// 获取或创建活跃的沙盒 ID
pub async fn get_or_create_active_sandbox(db: &DbManager) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr("云端 Daytona 沙箱未启用或未配置。请在系统设置中配置有效的 API 地址和密钥。", "Cloud Daytona sandbox not enabled or configured. Please configure a valid API URL and Key in system settings.")))?;

    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    
    // 如果缓存中有 ID，进行探活
    if let Some(id) = lock.as_ref() {
        // crate::emit_info(&format!("正在检查 Daytona 沙盒 {} 的健康状态...", id));
        if check_sandbox_alive(&cfg, id).await {
            // crate::emit_info(&format!("Daytona 沙盒 {} 已就绪 (复用中)", id));
            // 复用时也尝试将其设为 public，忽略可能的报错，确保老沙盒也被激活为 public，免除网关警告页
            let _ = set_sandbox_public(&cfg, id, true).await;
            return Ok(id.clone());
        }
        crate::emit_info(&flock_core::tr(&format!("Daytona 沙盒 {} 已失效，准备重新创建...", id), &format!("Daytona sandbox {} has expired, preparing to recreate...", id)));
        *lock = None;
    }

    // crate::emit_info("正在向云端申请创建新 Daytona 沙盒...");
    crate::emit_info(&flock_core::tr("正在向云端申请启动沙盒...", "Requesting to start sandbox from the cloud..."));
    
    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    // 构造创建请求 body，如果配置了 snapshot 则使用它，同时加上 "public": true
    let create_body = if let Some(ref snap_name) = cfg.snapshot {
        if !snap_name.trim().is_empty() {
            // crate::emit_info(&format!("使用自定义 Snapshot: {}...", snap_name));
            serde_json::json!({ "snapshot": snap_name.trim(), "public": true })
        } else {
            serde_json::json!({ "public": true })
        }
    } else {
        serde_json::json!({ "public": true })
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
            "{}", flock_core::tr(
                &format!("解析沙盒创建响应为 JSON 失败: {}. HTTP 状态码: {}, 原始响应体: {}", e, status, res_text),
                &format!("Failed to parse sandbox creation response as JSON: {}. HTTP status code: {}, original response body: {}", e, status, res_text)
            )
        ),
    };
    
    // 灵活支持 id/sandboxId 扁平或 data 嵌套结构
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

    // 轮询等待沙盒变为 "started" 状态
    // crate::emit_info(&format!("Daytona 沙盒创建成功 (ID: {})。启动中，正在等待网络与系统就绪...", sandbox_id));
    
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
                    } else {
                        last_status = flock_core::tr("读取响应体失败", "Failed to read response body");
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
                &format!("正在等待沙盒启动 (当前状态: {}, 已等待 {} 秒)...", last_status, i),
                &format!("Waiting for sandbox startup (current state: {}, waited {} seconds)...", last_status, i)
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
    // 显式将新创建的沙盒设为 public，双重保险
    let _ = set_sandbox_public(&cfg, &sandbox_id, true).await;
    *lock = Some(sandbox_id.clone());
    Ok(sandbox_id)
}

/// 检查沙盒是否还存活
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

/// 设置沙盒的公开/私有状态 (POST /api/sandbox/{id}/public/{is_public})
pub async fn set_sandbox_public(
    cfg: &SandboxConfig,
    sandbox_id: &str,
    is_public: bool,
) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let url = format!("{}/api/sandbox/{}/public/{}", base, sandbox_id, is_public);
    // crate::emit_info(&format!("正在设置 Daytona 沙盒 {} 的 public 属性为 {}...", sandbox_id, is_public));
    
    let res = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    let status = res.status();
    if status.is_success() {
        crate::emit_info(&flock_core::tr(
            &format!("Daytona 沙盒 {} 的 public 属性设置成功。", sandbox_id),
            &format!("Daytona sandbox {} public attribute set successfully.", sandbox_id)
        ));
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
