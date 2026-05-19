use tauri::{AppHandle, State};
use flock_core::db::{CronJobRecord, UpsertCronJob};
use crate::SharedDbManager;
use crate::commands::SharedAgentState;
use crate::cron_scheduler;

#[tauri::command]
pub async fn list_cron_jobs(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<CronJobRecord>, String> {
    db.list_cron_jobs()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_cron_job(
    db: State<'_, SharedDbManager>,
    input: UpsertCronJob,
) -> Result<CronJobRecord, String> {
    let mut record = db.create_cron_job(&input)
        .await
        .map_err(|e| e.to_string())?;

    // 新增任务时，若为开启状态，立即计算下一次执行时间
    if record.enabled && record.schedule_kind != "manual" {
        if let Some(next_ms) = cron_scheduler::calculate_next_run(&record.schedule_kind, &record.schedule_value) {
            db.update_cron_job_status(&record.id, "ok", None, None, Some(next_ms), None)
                .await
                .map_err(|e| e.to_string())?;
            record.next_run_at = Some(next_ms);
        }
    }

    Ok(record)
}

#[tauri::command]
pub async fn update_cron_job(
    db: State<'_, SharedDbManager>,
    id: String,
    input: UpsertCronJob,
) -> Result<CronJobRecord, String> {
    let mut record = db.update_cron_job(&id, &input)
        .await
        .map_err(|e| e.to_string())?;

    // 更新任务时，若为开启状态，重新计算下一次执行时间
    if record.enabled && record.schedule_kind != "manual" {
        if let Some(next_ms) = cron_scheduler::calculate_next_run(&record.schedule_kind, &record.schedule_value) {
            db.update_cron_job_status(&record.id, &record.last_status, None, None, Some(next_ms), None)
                .await
                .map_err(|e| e.to_string())?;
            record.next_run_at = Some(next_ms);
        }
    } else {
        // 若被禁用或设为手动，清除下次执行时间
        db.update_cron_job_status(&record.id, &record.last_status, None, None, None, None)
            .await
            .map_err(|e| e.to_string())?;
        record.next_run_at = None;
    }

    Ok(record)
}

#[tauri::command]
pub async fn delete_cron_job(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_cron_job(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_cron_job_enabled(
    db: State<'_, SharedDbManager>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    db.set_cron_job_enabled(&id, enabled)
        .await
        .map_err(|e| e.to_string())?;

    let job = db.get_cron_job(&id)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(record) = job {
        if record.enabled && record.schedule_kind != "manual" {
            // 启用时计算下次执行时间
            if let Some(next_ms) = cron_scheduler::calculate_next_run(&record.schedule_kind, &record.schedule_value) {
                db.update_cron_job_status(&record.id, &record.last_status, None, None, Some(next_ms), None)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        } else {
            // 禁用时清空下次执行时间
            db.update_cron_job_status(&record.id, &record.last_status, None, None, None, None)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn run_cron_job_now(
    db: State<'_, SharedDbManager>,
    agent_state: State<'_, SharedAgentState>,
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let db_pool = db.inner().clone();
    let state_pool = agent_state.inner().clone();
    let app_handle = app.clone();

    // 在后台独立异步线程立即触发，不阻塞前端界面
    tokio::spawn(async move {
        if let Err(e) = cron_scheduler::trigger_job_execution(&id, db_pool, state_pool, app_handle).await {
            log::error!("[TauriIPC] Firing run_cron_job_now failed for job {}: {}", id, e);
        }
    });

    Ok(())
}
