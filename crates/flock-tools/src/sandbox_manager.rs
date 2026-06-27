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
use crate::sandbox_provider::SandboxProvider;

static ACTIVE_SANDBOX_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

pub fn get_sandbox_id_mutex() -> &'static Mutex<Option<String>> {
    ACTIVE_SANDBOX_ID.get_or_init(|| Mutex::new(None))
}

pub async fn get_active_sandbox_id() -> Option<String> {
    let mutex = get_sandbox_id_mutex();
    let lock = mutex.lock().await;
    lock.clone()
}

pub async fn clear_active_sandbox_id() {
    let mutex = get_sandbox_id_mutex();
    let mut lock = mutex.lock().await;
    *lock = None;
}

/// 获取当前配置对应的 SandboxProvider 实现
pub fn get_provider(provider_name: &str) -> Box<dyn SandboxProvider> {
    match provider_name {
        "e2b" => Box::new(crate::e2b::provider::E2bProvider),
        "local" => Box::new(crate::local_provider::LocalSandboxProvider),
        _ => Box::new(crate::daytona::provider::DaytonaProvider),
    }
}

pub async fn check_sandbox_alive(cfg: &flock_core::config::settings::SandboxConfig, id: &str) -> bool {
    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);
    provider.check_alive(cfg, id).await
}

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
            // Daytona 需要额外 set_public（这个也可以封装到 check_alive 或独立方法中，但为了兼容暂时保留这里，
            // 更好的做法是将其放在 create_sandbox 内部，不过目前我们在检测到复用时也可能需要）
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

    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);
    
    let sandbox_id = provider.create_sandbox(db, &cfg).await?;
    
    if let Some(ws_path) = crate::get_workspace_dir() {
        if let Err(e) = provider.sync_up(db, &sandbox_id, &ws_path).await {
            crate::emit_info(&format!("Sync Up failed: {}", e));
        }
    }

    *lock = Some(sandbox_id.clone());
    Ok(sandbox_id)
}

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

    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);

    if let Some(ws_path) = crate::get_workspace_dir() {
        if let Err(e) = provider.sync_down(db, &sandbox_id, &ws_path).await {
            crate::emit_info(&format!("Sync Down failed: {}", e));
        }
    }

    if let Err(e) = provider.destroy_sandbox(db, &cfg, &sandbox_id).await {
        crate::emit_info(&format!("Destroying sandbox request failed: {}", e));
    }

    *lock = None;
    Ok(())
}

pub async fn execute_command_in_sandbox(
    db: &DbManager,
    sandbox_id: &str,
    command: &str,
) -> anyhow::Result<(String, i32)> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("沙箱未配置或未启用"))?;

    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);
    
    provider.execute_command(db, &cfg, sandbox_id, command).await
}

pub async fn get_sandbox_vnc_url(db: &DbManager, sandbox_id: &str) -> anyhow::Result<String> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!(flock_core::tr(
            "沙盒未配置或未启用",
            "Sandbox not configured or enabled"
        )))?;

    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);
    
    provider.get_vnc_url(db, &cfg, sandbox_id).await
}

pub async fn ensure_vnc_running_in_sandbox(db: &DbManager, sandbox_id: &str) -> anyhow::Result<()> {
    let cfg = get_sandbox_config(db).await
        .ok_or_else(|| anyhow::anyhow!("沙盒未配置"))?;

    let provider_name = cfg.provider.as_deref().unwrap_or("e2b");
    let provider = get_provider(provider_name);
    
    provider.ensure_vnc_running(db, &cfg, sandbox_id).await
}
