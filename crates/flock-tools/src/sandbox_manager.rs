/// sandbox_manager.rs — 沙盒管理中间层
///
/// 职责：
/// - 维护全局活跃沙盒 ID 的状态（ACTIVE_SANDBOX_ID）
/// - 根据 provider 字段分发到具体 provider 实现
/// - 暴露统一接口：get_or_create、destroy、check_alive、get_vnc_url、execute_command

use std::sync::OnceLock;
use tokio::sync::Mutex;
use flock_core::db::DbManager;
use crate::daytona::get_sandbox_config;

static ACTIVE_SANDBOX_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

pub fn get_sandbox_id_mutex() -> &'static Mutex<Option<String>> {
    ACTIVE_SANDBOX_ID.get_or_init(|| Mutex::new(None))
}

pub async fn get_active_sandbox_id() -> Option<String> {
    let mutex = get_sandbox_id_mutex();
    let lock = mutex.lock().await;
    lock.clone()
}

/// 清空活跃沙盒缓存（配置变更时调用）
pub async fn clear_active_sandbox_id() {
    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    *lock = None;
}

/// 检查沙盒是否存活（provider dispatch）
pub async fn check_sandbox_alive(cfg: &flock_core::config::settings::SandboxConfig, id: &str) -> bool {
    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    match provider {
        "e2b" => crate::e2b::check_alive(cfg, id).await,
        "local" => true,
        _ => crate::daytona::check_sandbox_alive(cfg, id).await,
    }
}

/// 获取或创建活跃沙盒，返回 sandbox_id
pub async fn get_or_create_active_sandbox(db: &DbManager) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr(
            "沙盒未启用或未配置。请在系统设置中配置有效的 API Key。",
            "Sandbox not enabled or configured. Please configure a valid API Key in system settings."
        )))?;

    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;

    if let Some(id) = lock.as_ref() {
        if check_sandbox_alive(&cfg, id).await {
            // Daytona 需要额外 set_public
            if cfg.provider.as_deref().unwrap_or("e2b") == "daytona" {
                let _ = crate::daytona::set_sandbox_public(&cfg, id, true).await;
            }
            return Ok(id.clone());
        }
        crate::emit_info(&flock_core::tr(
            &format!("沙盒 {} 已失效，准备重新创建...", id),
            &format!("Sandbox {} has expired, preparing to recreate...", id)
        ));
        *lock = None;
    }

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    let sandbox_id = match provider {
        "e2b" => {
            let id = crate::e2b::create_sandbox(&cfg).await?;
            // 同步本地 workspace 到 E2B
            if let Some(ws_path) = crate::get_workspace_dir() {
                if let Err(e) = crate::daytona::sync::sync_up(db, &id, &ws_path).await {
                    crate::emit_info(&format!("E2B Sync Up failed: {}", e));
                }
            }
            id
        }
        "local" => {
            crate::emit_info(&flock_core::tr("正在启动本地 Mock 沙盒 (占位)...", "Starting local mock sandbox (placeholder)..."));
            "local".to_string()
        }
        _ => {
            // Daytona
            crate::daytona::create_sandbox(db, &cfg).await?
        }
    };

    *lock = Some(sandbox_id.clone());
    Ok(sandbox_id)
}

/// 销毁当前活跃沙盒
pub async fn destroy_active_sandbox(db: &DbManager) -> anyhow::Result<()> {
    let cfg = match get_sandbox_config(db).await {
        Some(c) => c,
        None => return Ok(()),
    };

    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;

    let sandbox_id = match lock.as_ref() {
        Some(id) => id.clone(),
        None => return Ok(()),
    };

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    match provider {
        "e2b" => {
            if let Err(e) = crate::e2b::destroy_sandbox(&cfg, &sandbox_id).await {
                crate::emit_info(&flock_core::tr(
                    &format!("销毁 E2B 沙盒请求失败: {}", e),
                    &format!("Destroying E2B sandbox request failed: {}", e)
                ));
            }
        }
        "local" => {}
        _ => {
            // Daytona: sync down 然后销毁
            if let Some(ws_path) = crate::get_workspace_dir() {
                if let Err(e) = crate::daytona::sync::sync_down(db, &sandbox_id, &ws_path).await {
                    crate::emit_info(&format!("Sync Down failed: {}", e));
                }
            }
            if let Err(e) = crate::daytona::destroy_daytona_sandbox(&cfg, &sandbox_id).await {
                crate::emit_info(&flock_core::tr(
                    &format!("销毁 Daytona 沙盒请求失败: {}", e),
                    &format!("Destroying Daytona sandbox request failed: {}", e)
                ));
            }
        }
    }

    *lock = None;
    Ok(())
}

/// 在沙盒中执行命令（provider dispatch）
pub async fn execute_command_in_sandbox(
    db: &DbManager,
    sandbox_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("沙箱未配置或未启用"))?;

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    match provider {
        "e2b" => crate::e2b::execute_command(&cfg, sandbox_id, command).await,
        "local" => Ok((format!("Local mock execution placeholder: executing '{}'", command), 0)),
        _ => crate::daytona::execute_command_in_sandbox(db, sandbox_id, command).await,
    }
}

/// 获取沙盒 VNC URL（provider dispatch）
pub async fn get_sandbox_vnc_url(db: &DbManager, sandbox_id: &str) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr(
            "沙盒未配置或未启用",
            "Sandbox not configured or enabled"
        )))?;

    let provider = cfg.provider.as_deref().unwrap_or("e2b");
    match provider {
        "e2b" => Ok(crate::e2b::exec::get_vnc_url(sandbox_id)),
        "local" => anyhow::bail!("Local sandbox does not support VNC"),
        _ => crate::daytona::get_sandbox_vnc_url(db, sandbox_id).await,
    }
}
