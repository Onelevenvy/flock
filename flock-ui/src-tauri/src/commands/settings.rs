use tauri::State;
use crate::SharedDbManager;

/// 获取指定 Key 的 app_config 配置
#[tauri::command]
pub async fn get_app_config(
    db: State<'_, SharedDbManager>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let mut config: Option<serde_json::Value> = db.get_config(&key).await;
    if key == "sandbox" {
        if let Some(ref mut val) = config {
            if let Ok(mut sandbox_cfg) = serde_json::from_value::<flock_core::config::settings::SandboxConfig>(val.clone()) {
                if sandbox_cfg.api_key_encrypted.is_some() {
                    sandbox_cfg.api_key = Some("••••••••".to_string());
                } else {
                    sandbox_cfg.api_key = None;
                }
                sandbox_cfg.api_key_encrypted = None;
                sandbox_cfg.api_key_nonce = None;

                if sandbox_cfg.e2b_api_key_encrypted.is_some() {
                    sandbox_cfg.e2b_api_key = Some("••••••••".to_string());
                } else {
                    sandbox_cfg.e2b_api_key = None;
                }
                sandbox_cfg.e2b_api_key_encrypted = None;
                sandbox_cfg.e2b_api_key_nonce = None;

                *val = serde_json::to_value(&sandbox_cfg).unwrap_or_default();
            }
        }
    }
    Ok(config)
}

/// 保存指定 Key 的 app_config 配置
#[tauri::command]
pub async fn set_app_config(
    db: State<'_, SharedDbManager>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut final_value = value.clone();
    
    if key == "sandbox" {
        if let Ok(mut sandbox_cfg) = serde_json::from_value::<flock_core::config::settings::SandboxConfig>(value.clone()) {
            let db_inner = db.inner().clone();
            let old_sandbox: Option<flock_core::config::settings::SandboxConfig> = db_inner.get_config("sandbox").await;
            
            // Daytona api key
            let resolved_api_key = sandbox_cfg.api_key.clone();
            if let Some(ref key_str) = resolved_api_key {
                if key_str == "••••••••" {
                    if let Some(ref old) = old_sandbox {
                        sandbox_cfg.api_key_encrypted = old.api_key_encrypted.clone();
                        sandbox_cfg.api_key_nonce = old.api_key_nonce.clone();
                    }
                    sandbox_cfg.api_key = None;
                } else if key_str.is_empty() {
                    sandbox_cfg.api_key_encrypted = None;
                    sandbox_cfg.api_key_nonce = None;
                    sandbox_cfg.api_key = None;
                } else {
                    if let Ok(salt) = db_inner.get_or_create_salt().await {
                        if let Ok((ct, n)) = flock_core::crypto::encrypt_value(key_str, &salt) {
                            sandbox_cfg.api_key_encrypted = Some(ct);
                            sandbox_cfg.api_key_nonce = Some(n);
                            sandbox_cfg.api_key = None;
                        }
                    }
                }
            } else {
                sandbox_cfg.api_key_encrypted = None;
                sandbox_cfg.api_key_nonce = None;
            }

            // E2B api key
            let resolved_e2b_key = sandbox_cfg.e2b_api_key.clone();
            if let Some(ref key_str) = resolved_e2b_key {
                if key_str == "••••••••" {
                    if let Some(ref old) = old_sandbox {
                        sandbox_cfg.e2b_api_key_encrypted = old.e2b_api_key_encrypted.clone();
                        sandbox_cfg.e2b_api_key_nonce = old.e2b_api_key_nonce.clone();
                    }
                    sandbox_cfg.e2b_api_key = None;
                } else if key_str.is_empty() {
                    sandbox_cfg.e2b_api_key_encrypted = None;
                    sandbox_cfg.e2b_api_key_nonce = None;
                    sandbox_cfg.e2b_api_key = None;
                } else {
                    if let Ok(salt) = db_inner.get_or_create_salt().await {
                        if let Ok((ct, n)) = flock_core::crypto::encrypt_value(key_str, &salt) {
                            sandbox_cfg.e2b_api_key_encrypted = Some(ct);
                            sandbox_cfg.e2b_api_key_nonce = Some(n);
                            sandbox_cfg.e2b_api_key = None;
                        }
                    }
                }
            } else {
                sandbox_cfg.e2b_api_key_encrypted = None;
                sandbox_cfg.e2b_api_key_nonce = None;
            }
            
            final_value = serde_json::to_value(&sandbox_cfg).unwrap_or(final_value);
        }
    }

    db.set_config(&key, &final_value).await
        .map_err(|e| flock_core::tr(
            &format!("保存配置 '{}' 失败: {}", key, e),
            &format!("Failed to save config '{}': {}", key, e)
        ))?;

    // 当 sandbox 被禁用时，将其 provider 标记为不可用。同时，清空当前活跃沙盒的内存缓存。
    if key == "sandbox" {
        let enabled = final_value.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
        if !enabled {
            let _ = db.set_tool_provider_available("sandbox", false).await;
        }
        
        // 关键修复：清除旧的活跃沙盒缓存，防止状态穿透
        let _ = flock_tools::sandbox_manager::clear_active_sandbox_id().await;
    }

    Ok(())
}

/// 测试云端沙盒（E2B 或 Daytona）的连通性，成功后将 sandbox provider 标记为可用
#[tauri::command]
pub async fn test_sandbox_connection(
    db: State<'_, SharedDbManager>,
    provider: String,
    api_url: String,
    mut api_key: String,
) -> Result<String, String> {
    if api_key == "••••••••" {
        let old_sandbox: Option<flock_core::config::settings::SandboxConfig> = db.get_config("sandbox").await;
        if let Some(cfg) = old_sandbox {
            if provider == "e2b" {
                if let (Some(ct), Some(n)) = (cfg.e2b_api_key_encrypted, cfg.e2b_api_key_nonce) {
                    if let Ok(salt) = db.get_or_create_salt().await {
                        if let Ok(decrypted) = flock_core::crypto::decrypt_value(&ct, &n, &salt) {
                            api_key = decrypted;
                        }
                    }
                } else if let Some(key) = cfg.e2b_api_key {
                    api_key = key;
                }
            } else {
                if let (Some(ct), Some(n)) = (cfg.api_key_encrypted, cfg.api_key_nonce) {
                    if let Ok(salt) = db.get_or_create_salt().await {
                        if let Ok(decrypted) = flock_core::crypto::decrypt_value(&ct, &n, &salt) {
                            api_key = decrypted;
                        }
                    }
                } else if let Some(key) = cfg.api_key {
                    api_key = key;
                }
            }
        }
    }

    if provider == "local" {
        db.set_tool_provider_available("sandbox", true)
            .await
            .map_err(|e| e.to_string())?;
        return Ok(flock_core::tr("本地沙盒已启用", "Local sandbox enabled"));
    }

    let client = reqwest::Client::new();
    let (url, is_e2b) = if provider == "e2b" {
        ("https://api.e2b.app/sandboxes".to_string(), true)
    } else {
        let base = flock_tools::daytona::get_api_base(&api_url);
        (format!("{}/api/sandbox", base), false)
    };

    let request_builder = client.get(&url);
    let request_builder = if is_e2b {
        request_builder.header("X-API-Key", &api_key)
    } else {
        request_builder.header("Authorization", format!("Bearer {}", api_key))
    };

    let send_result = request_builder.send().await;

    let res = match send_result {
        Ok(r) => r,
        Err(e) => {
            let _ = db.set_tool_provider_available("sandbox", false).await;
            return Err(flock_core::tr(
                &format!("无法连接到沙盒服务器: {}", e),
                &format!("Failed to connect to sandbox server: {}", e)
            ));
        }
    };

    if res.status().is_success() {
        db.set_tool_provider_available("sandbox", true)
            .await
            .map_err(|e| flock_core::tr(
                &format!("更新沙盒可用状态失败: {}", e),
                &format!("Failed to update sandbox availability: {}", e)
            ))?;
        Ok(flock_core::tr("连接成功", "Connection successful"))
    } else {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        let _ = db.set_tool_provider_available("sandbox", false).await;
        Err(flock_core::tr(
            &format!("验证失败，HTTP 状态码: {}。错误详情: {}", status, err_body),
            &format!("Verification failed, HTTP status code: {}. Details: {}", status, err_body)
        ))
    }
}


/// 创建一个预装 Playwright 的 Daytona Snapshot
/// 需要约 3-5 分钟，完成后返回 Snapshot 名称。
#[tauri::command]
pub async fn create_playwright_snapshot(
    db: State<'_, SharedDbManager>,
    snapshot_name: String,
) -> Result<String, String> {
    flock_tools::daytona::create_playwright_snapshot(
        &*db,
        &snapshot_name,
    )
    .await
    .map_err(|e| e.to_string())
}

/// 列出 Daytona 沙盒实例（E2B 不显示实例列表）
#[tauri::command]
pub async fn list_sandboxes(
    db: State<'_, SharedDbManager>,
) -> Result<serde_json::Value, String> {
    use flock_core::db::DbManager;

    let db_ref: &DbManager = &*db;
    let cfg = match get_sandbox_config_regardless(db_ref).await {
        Some(c) => c,
        None => return Ok(serde_json::json!([])),
    };

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    // E2B 不显示 instances，Daytona 会有残留需要手动销毁
    if provider == "e2b" || provider == "local" {
        return Ok(serde_json::json!([]));
    }

    let base = flock_tools::daytona::get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let url = format!("{}/api/sandbox", base);
    let resp = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| flock_core::tr(
            &format!("请求沙盒列表失败: {}", e),
            &format!("Failed to request sandbox list: {}", e)
        ))?;

    let text = resp.text().await.unwrap_or_default();
    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| flock_core::tr(
            &format!("解析沙盒列表失败: {}", e),
            &format!("Failed to parse sandbox list: {}", e)
        ))?;

    Ok(val)
}

/// 删除指定 Daytona 沙盒（E2B 不需要此操作）
#[tauri::command]
pub async fn delete_sandbox(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    use flock_core::db::DbManager;
    use flock_tools::daytona::get_sandbox_config;

    let db_ref: &DbManager = &*db;
    let cfg = get_sandbox_config(db_ref).await
        .ok_or_else(|| flock_core::tr("沙盒未配置或未启用", "Sandbox not configured or enabled"))?;

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    if provider == "e2b" || provider == "local" {
        return Ok(());
    }

    let base = flock_tools::daytona::get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let url = format!("{}/api/sandbox/{}", base, id);
    let resp = client.delete(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| flock_core::tr(
            &format!("发送删除沙盒请求失败: {}", e),
            &format!("Failed to send delete sandbox request: {}", e)
        ))?;

    if resp.status().is_success() {
        // 如果删除的是当前活跃的沙盒，清理本地缓存
        if let Some(active_id) = flock_tools::sandbox_manager::get_active_sandbox_id().await {
            if active_id == id {
                flock_tools::sandbox_manager::clear_active_sandbox_id().await;
            }
        }
        Ok(())
    } else {
        Err(flock_core::tr(
            &format!("删除沙盒失败，HTTP 状态码: {}", resp.status()),
            &format!("Failed to delete sandbox, HTTP status code: {}", resp.status())
        ))
    }
}

/// 复用指定的沙盒（设置为当前活跃沙盒）
#[tauri::command]
pub async fn reuse_sandbox(
    db: State<'_, SharedDbManager>,
    sandbox_id: String,
) -> Result<String, String> {
    use flock_core::db::DbManager;

    let db_ref: &DbManager = &*db;
    let cfg = flock_tools::daytona::get_sandbox_config(db_ref).await
        .ok_or_else(|| flock_core::tr("沙盒未配置或未启用", "Sandbox not configured or enabled"))?;

    // 验证沙盒是否存活
    if !flock_tools::sandbox_manager::check_sandbox_alive(&cfg, &sandbox_id).await {
        return Err(flock_core::tr(
            &format!("沙盒 {} 不存在或已停止", sandbox_id),
            &format!("Sandbox {} does not exist or has stopped", sandbox_id)
        ));
    }

    // 设置为活跃沙盒
    let mutex = flock_tools::sandbox_manager::get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    *lock = Some(sandbox_id.clone());

    Ok(flock_core::tr(
        &format!("已切换到沙盒 {}", sandbox_id),
        &format!("Switched to sandbox {}", sandbox_id)
    ))
}

/// 列出所有 Daytona/E2B 快照/自定义模板
#[tauri::command]
pub async fn list_sandbox_templates(
    db: State<'_, SharedDbManager>,
    provider: Option<String>,
    api_key: Option<String>,
) -> Result<serde_json::Value, String> {
    use flock_core::db::DbManager;

    let active_provider = provider.unwrap_or_else(|| "e2b".to_string());
    if active_provider == "e2b" {
        let key = if let Some(ref k) = api_key {
            if k.is_empty() {
                let db_ref: &DbManager = &*db;
                let cfg = get_sandbox_config_regardless(db_ref).await.unwrap_or_default();
                cfg.e2b_api_key.unwrap_or_default()
            } else {
                k.clone()
            }
        } else {
            let db_ref: &DbManager = &*db;
            let cfg = get_sandbox_config_regardless(db_ref).await.unwrap_or_default();
            cfg.e2b_api_key.unwrap_or_default()
        };

        log::info!("list_daytona_snapshots: active_provider = E2B, key len = {}, key starts with: {}", key.len(), &key[..std::cmp::min(5, key.len())]);
        if key.is_empty() {
            return Ok(serde_json::json!([]));
        }

        let client = reqwest::Client::new();
        let url = "https://api.e2b.app/templates";
        let resp = client.get(url)
            .header("X-API-Key", key)
            .send()
            .await
            .map_err(|e| flock_core::tr(
                &format!("请求 E2B 模板列表失败: {}", e),
                &format!("Failed to request E2B template list: {}", e)
            ))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        log::info!("list_daytona_snapshots: E2B templates status = {}, text = {}", status, text);
        if !status.is_success() {
            return Err(flock_core::tr(
                &format!("E2B API 错误 ({}): {}", status, text),
                &format!("E2B API error ({}): {}", status, text)
            ));
        }

        let mut mapped: Vec<serde_json::Value> = vec![
            serde_json::json!({
                "id": "desktop",
                "name": "desktop (GUI Desktop / VNC)",
                "status": "active"
            }),
            serde_json::json!({
                "id": "base",
                "name": "base (Standard Python/Bash)",
                "status": "active"
            }),
            serde_json::json!({
                "id": "code-interpreter",
                "name": "code-interpreter",
                "status": "active"
            }),
            serde_json::json!({
                "id": "browser",
                "name": "browser",
                "status": "active"
            }),
        ];

        let list_val: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| flock_core::tr(
                &format!("解析 E2B 模板列表失败: {}", e),
                &format!("Failed to parse E2B template list: {}", e)
            ))?;

        if let Some(arr) = list_val.as_array() {
            for item in arr {
                let id = item.get("templateID")
                    .or_else(|| item.get("snapshotID"))
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                let name = item.get("aliases")
                    .and_then(|a| a.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_str())
                    .unwrap_or(id);
                if !id.is_empty() && !mapped.iter().any(|m| m.get("id").and_then(|v| v.as_str()) == Some(id)) {
                    mapped.push(serde_json::json!({
                        "id": id,
                        "name": name,
                        "status": "active"
                    }));
                }
            }
        }
        return Ok(serde_json::json!(mapped));
    } else if active_provider == "local" {
        return Ok(serde_json::json!([]));
    }

    let db_ref: &DbManager = &*db;
    let cfg = match get_sandbox_config_regardless(db_ref).await {
        Some(c) => c,
        None => return Ok(serde_json::json!([])),
    };

    let base = flock_tools::daytona::get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let url = format!("{}/api/snapshots", base);
    let resp = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| flock_core::tr(
            &format!("请求快照列表失败: {}", e),
            &format!("Failed to request snapshot list: {}", e)
        ))?;

    let text = resp.text().await.unwrap_or_default();
    let val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| flock_core::tr(
            &format!("解析快照列表失败: {}", e),
            &format!("Failed to parse snapshot list: {}", e)
        ))?;

    Ok(val)
}

/// 删除指定 Daytona/E2B 快照/模板
#[tauri::command]
pub async fn delete_sandbox_template(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    use flock_core::db::DbManager;

    let db_ref: &DbManager = &*db;
    let cfg = get_sandbox_config_regardless(db_ref).await
        .ok_or_else(|| flock_core::tr("沙盒未配置", "Sandbox not configured"))?;

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    if provider == "e2b" {
        let api_key = cfg.e2b_api_key.as_ref().unwrap();
        let client = reqwest::Client::new();
        let url = format!("https://api.e2b.app/snapshots/{}", id);
        let resp = client.delete(&url)
            .header("X-API-Key", api_key)
            .send()
            .await
            .map_err(|e| flock_core::tr(
                &format!("发送删除 E2B 快照请求失败: {}", e),
                &format!("Failed to send delete E2B snapshot request: {}", e)
            ))?;

        if resp.status().is_success() || resp.status().as_u16() == 204 {
            return Ok(());
        } else {
            return Err(flock_core::tr(
                &format!("删除 E2B 快照失败，HTTP 状态码: {}", resp.status()),
                &format!("Failed to delete E2B snapshot, HTTP status code: {}", resp.status())
            ));
        }
    } else if provider == "local" {
        return Ok(());
    }

    let base = flock_tools::daytona::get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();

    let client = reqwest::Client::new();
    let url = format!("{}/api/snapshots/{}", base, id);
    let resp = client.delete(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| flock_core::tr(
            &format!("发送删除快照请求失败: {}", e),
            &format!("Failed to send delete snapshot request: {}", e)
        ))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(flock_core::tr(
            &format!("删除快照失败，HTTP 状态码: {}", resp.status()),
            &format!("Failed to delete snapshot, HTTP status code: {}", resp.status())
        ))
    }
}

#[tauri::command]
pub fn set_locale(locale: String) {
    flock_core::set_locale(&locale);
}

async fn get_sandbox_config_regardless(db: &flock_core::db::DbManager) -> Option<flock_core::config::settings::SandboxConfig> {
    let mut cfg: flock_core::config::settings::SandboxConfig = db.get_config("sandbox").await?;
    
    // Decrypt Daytona key
    if let (Some(ct), Some(n)) = (&cfg.api_key_encrypted, &cfg.api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.api_key = Some(decrypted);
            }
        }
    }
    
    // Decrypt E2B key
    if let (Some(ct), Some(n)) = (&cfg.e2b_api_key_encrypted, &cfg.e2b_api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.e2b_api_key = Some(decrypted);
            }
        }
    }
    
    Some(cfg)
}

