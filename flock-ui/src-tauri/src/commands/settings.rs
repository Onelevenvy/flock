use tauri::State;
use crate::SharedDbManager;
use flock_core::config::settings::SandboxProviderConfig;

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
                match &mut sandbox_cfg.provider {
                    SandboxProviderConfig::E2b { api_key, api_key_encrypted, api_key_nonce, .. } => {
                        if api_key_encrypted.is_some() {
                            *api_key = Some("••••••••".to_string());
                        } else {
                            *api_key = None;
                        }
                        *api_key_encrypted = None;
                        *api_key_nonce = None;
                    }
                    SandboxProviderConfig::Daytona { api_key, api_key_encrypted, api_key_nonce, .. } => {
                        if api_key_encrypted.is_some() {
                            *api_key = Some("••••••••".to_string());
                        } else {
                            *api_key = None;
                        }
                        *api_key_encrypted = None;
                        *api_key_nonce = None;
                    }
                    _ => {}
                }
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
            
            let salt = db_inner.get_or_create_salt().await.map_err(|e| e.to_string())?;

            match &mut sandbox_cfg.provider {
                SandboxProviderConfig::E2b { api_key, api_key_encrypted, api_key_nonce, .. } => {
                    let old_keys = old_sandbox.as_ref().and_then(|old| {
                        match &old.provider {
                            SandboxProviderConfig::E2b { api_key_encrypted: ae, api_key_nonce: an, .. } => {
                                Some((ae.clone(), an.clone()))
                            }
                            _ => None,
                        }
                    });

                    if let Some(key_str) = api_key.clone() {
                        if key_str == "••••••••" {
                            if let Some((ae, an)) = old_keys {
                                *api_key_encrypted = ae;
                                *api_key_nonce = an;
                            }
                            *api_key = None;
                        } else if key_str.is_empty() {
                            *api_key_encrypted = None;
                            *api_key_nonce = None;
                            *api_key = None;
                        } else {
                            if let Ok((ct, n)) = flock_core::crypto::encrypt_value(&key_str, &salt) {
                                *api_key_encrypted = Some(ct);
                                *api_key_nonce = Some(n);
                                *api_key = None;
                            }
                        }
                    } else {
                        *api_key_encrypted = None;
                        *api_key_nonce = None;
                    }
                }
                SandboxProviderConfig::Daytona { api_key, api_key_encrypted, api_key_nonce, .. } => {
                    let old_keys = old_sandbox.as_ref().and_then(|old| {
                        match &old.provider {
                            SandboxProviderConfig::Daytona { api_key_encrypted: ae, api_key_nonce: an, .. } => {
                                Some((ae.clone(), an.clone()))
                            }
                            _ => None,
                        }
                    });

                    if let Some(key_str) = api_key.clone() {
                        if key_str == "••••••••" {
                            if let Some((ae, an)) = old_keys {
                                *api_key_encrypted = ae;
                                *api_key_nonce = an;
                            }
                            *api_key = None;
                        } else if key_str.is_empty() {
                            *api_key_encrypted = None;
                            *api_key_nonce = None;
                            *api_key = None;
                        } else {
                            if let Ok((ct, n)) = flock_core::crypto::encrypt_value(&key_str, &salt) {
                                *api_key_encrypted = Some(ct);
                                *api_key_nonce = Some(n);
                                *api_key = None;
                            }
                        }
                    } else {
                        *api_key_encrypted = None;
                        *api_key_nonce = None;
                    }
                }
                _ => {}
            }
            
            final_value = serde_json::to_value(&sandbox_cfg).unwrap_or(final_value);
        }
    }

    db.set_config(&key, &final_value).await
        .map_err(|e| flock_core::tr(
            &format!("保存配置 '{}' 失败: {}", key, e),
            &format!("Failed to save config '{}': {}", key, e)
        ))?;

    if key == "sandbox" {
        let enabled = final_value.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
        if !enabled {
            let _ = db.set_tool_provider_available("sandbox", false).await;
        }
        
        let _ = flock_tools::sandbox_core::manager::clear_active_sandbox_id().await;
    }

    Ok(())
}

/// 自动构建 E2B 专属模板
#[tauri::command]
pub async fn build_e2b_template(
    app: tauri::AppHandle,
    db: State<'_, SharedDbManager>,
    name: String,
) -> Result<String, String> {
    use flock_tools::sandbox_core::config::get_sandbox_config;
    
    let cfg = get_sandbox_config(&db).await
        .ok_or_else(|| "沙盒未配置".to_string())?;
        
    let api_key = cfg.api_key()
        .ok_or_else(|| "E2B API Key 未配置".to_string())?;

    let template_id = flock_tools::sandbox_core::e2b::builder::build_enhanced_template(
        api_key,
        cfg.api_url(),
        &name,
        move |log| {
            print!("{}", log);
            use std::io::Write;
            let _ = std::io::stdout().flush();
            use tauri::Emitter;
            let _ = app.emit("e2b-build-log", log);
        }
    ).await.map_err(|e| e.to_string())?;

    Ok(template_id)
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
            let old_key = if provider == "e2b" {
                match &cfg.provider {
                    SandboxProviderConfig::E2b { api_key: ak, api_key_encrypted: ae, api_key_nonce: an, .. } => {
                        if let (Some(ct), Some(n)) = (ae, an) {
                            if let Ok(salt) = db.get_or_create_salt().await {
                                flock_core::crypto::decrypt_value(ct, n, &salt).ok()
                            } else {
                                None
                            }
                        } else {
                            ak.clone()
                        }
                    }
                    _ => None,
                }
            } else {
                match &cfg.provider {
                    SandboxProviderConfig::Daytona { api_key: ak, api_key_encrypted: ae, api_key_nonce: an, .. } => {
                        if let (Some(ct), Some(n)) = (ae, an) {
                            if let Ok(salt) = db.get_or_create_salt().await {
                                flock_core::crypto::decrypt_value(ct, n, &salt).ok()
                            } else {
                                None
                            }
                        } else {
                            ak.clone()
                        }
                    }
                    _ => None,
                }
            };
            if let Some(k) = old_key {
                api_key = k;
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
        let base_url = api_url.trim_end_matches('/');
        (format!("{}/sandboxes", base_url), true)
    } else {
        let base = flock_tools::sandbox_core::config::get_api_base(&api_url);
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
    flock_tools::sandbox_core::daytona::create_playwright_snapshot(
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

    let provider = cfg.provider.name();
    // E2B 不显示 instances，Daytona 会有残留需要手动销毁
    if provider == "e2b" || provider == "local" {
        return Ok(serde_json::json!([]));
    }

    let base = flock_tools::sandbox_core::config::get_api_base(cfg.api_url().unwrap_or(""));
    let api_key = cfg.api_key().unwrap_or("");

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
    use flock_tools::sandbox_core::config::get_sandbox_config;

    let db_ref: &DbManager = &*db;
    let cfg = get_sandbox_config(db_ref).await
        .ok_or_else(|| flock_core::tr("沙盒未配置或未启用", "Sandbox not configured or enabled"))?;

    let provider = cfg.provider.name();
    if provider == "e2b" || provider == "local" {
        return Ok(());
    }

    let base = flock_tools::sandbox_core::config::get_api_base(cfg.api_url().unwrap_or(""));
    let api_key = cfg.api_key().unwrap_or("");

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
        if let Some(active_id) = flock_tools::sandbox_core::manager::get_active_sandbox_id().await {
            if active_id == id {
                flock_tools::sandbox_core::manager::clear_active_sandbox_id().await;
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
    let cfg = flock_tools::sandbox_core::config::get_sandbox_config(db_ref).await
        .ok_or_else(|| flock_core::tr("沙盒未配置或未启用", "Sandbox not configured or enabled"))?;

    // 验证沙盒是否存活
    if !flock_tools::sandbox_core::manager::check_sandbox_alive(&cfg, &sandbox_id).await {
        return Err(flock_core::tr(
            &format!("沙盒 {} 不存在或已停止", sandbox_id),
            &format!("Sandbox {} does not exist or has stopped", sandbox_id)
        ));
    }

    // 设置为活跃沙盒
    let mutex = flock_tools::sandbox_core::manager::get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    *lock = Some(sandbox_id.clone());

    Ok(flock_core::tr(
        &format!("已切换到沙盒 {}", sandbox_id),
        &format!("Switched to sandbox {}", sandbox_id)
    ))
}

// List all templates
#[tauri::command]
pub async fn list_sandbox_templates(
    db: State<'_, SharedDbManager>,
    provider: Option<String>,
    api_key: Option<String>,
) -> Result<serde_json::Value, String> {
    use flock_core::db::DbManager;

    let db_ref: &DbManager = &*db;
    let mut cfg = get_sandbox_config_regardless(db_ref).await.unwrap_or_default();
    if let Some(p) = provider {
        if p == "e2b" {
            cfg.provider = SandboxProviderConfig::E2b {
                api_key: None,
                api_key_encrypted: None,
                api_key_nonce: None,
                api_url: None,
            };
        } else if p == "daytona" {
            cfg.provider = SandboxProviderConfig::Daytona {
                api_url: None,
                api_key: None,
                api_key_encrypted: None,
                api_key_nonce: None,
            };
        } else {
            cfg.provider = SandboxProviderConfig::Local;
        }
    }
    if let Some(k) = api_key {
        if !k.is_empty() && !k.contains('*') && !k.contains('•') {
            match &mut cfg.provider {
                SandboxProviderConfig::E2b { api_key: ak, .. } => {
                    *ak = Some(k);
                }
                SandboxProviderConfig::Daytona { api_key: ak, .. } => {
                    *ak = Some(k);
                }
                _ => {}
            }
        }
    }

    let provider_name = cfg.provider.name();
    let provider_impl = flock_tools::sandbox_core::manager::get_provider(provider_name);
    provider_impl.list_templates(db_ref, &cfg)
        .await
        .map_err(|e| e.to_string())
}

// Delete specified Daytona/E2B snapshot/template
#[tauri::command]
pub async fn delete_sandbox_template(
    db: State<'_, SharedDbManager>,
    id: String,
    provider: Option<String>,
) -> Result<(), String> {
    use flock_core::db::DbManager;

    let db_ref: &DbManager = &*db;
    let mut cfg = get_sandbox_config_regardless(db_ref).await
        .ok_or_else(|| flock_core::tr("Sandbox not configured", "Sandbox not configured"))?;
    if let Some(p) = provider {
        if p == "e2b" {
            cfg.provider = SandboxProviderConfig::E2b {
                api_key: None,
                api_key_encrypted: None,
                api_key_nonce: None,
                api_url: None,
            };
        } else if p == "daytona" {
            cfg.provider = SandboxProviderConfig::Daytona {
                api_url: None,
                api_key: None,
                api_key_encrypted: None,
                api_key_nonce: None,
            };
        } else {
            cfg.provider = SandboxProviderConfig::Local;
        }
    }

    let provider_name = cfg.provider.name();
    let provider_impl = flock_tools::sandbox_core::manager::get_provider(provider_name);
    provider_impl.delete_template(db_ref, &cfg, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_locale(locale: String) {
    flock_core::set_locale(&locale);
}

async fn get_sandbox_config_regardless(db: &flock_core::db::DbManager) -> Option<flock_core::config::settings::SandboxConfig> {
    let mut cfg: flock_core::config::settings::SandboxConfig = db.get_config("sandbox").await?;
    
    if let Ok(salt) = db.get_or_create_salt().await {
        match &mut cfg.provider {
            SandboxProviderConfig::E2b { api_key, api_key_encrypted, api_key_nonce, .. } => {
                if let (Some(ct), Some(n)) = (api_key_encrypted, api_key_nonce) {
                    if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                        *api_key = Some(decrypted);
                    }
                }
            }
            SandboxProviderConfig::Daytona { api_key, api_key_encrypted, api_key_nonce, .. } => {
                if let (Some(ct), Some(n)) = (api_key_encrypted, api_key_nonce) {
                    if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                        *api_key = Some(decrypted);
                    }
                }
            }
            _ => {}
        }
    }
    
    Some(cfg)
}

