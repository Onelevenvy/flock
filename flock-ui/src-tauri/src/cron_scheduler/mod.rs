use std::sync::Arc;
use std::time::Duration;
use chrono::Local;
use tauri::{AppHandle, Emitter};

use flock_core::db::DbManager;
use crate::commands::SharedAgentState;

pub mod cron_parser;
pub mod executor;

pub use cron_parser::calculate_next_run;
pub use executor::trigger_job_execution;

pub async fn start(
    db: Arc<DbManager>,
    agent_state: SharedAgentState,
    app: AppHandle,
) {
    log::info!("[CronScheduler] Background scheduler actor started.");
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        interval.tick().await;

        let now_ms = Local::now().timestamp_millis();
        let active_jobs = match db.list_cron_jobs().await {
            Ok(jobs) => jobs,
            Err(e) => {
                log::error!("[CronScheduler] Failed to query jobs: {}", e);
                continue;
            }
        };

        for job in active_jobs {
            // 只触发启用且已到期的任务
            if !job.enabled {
                continue;
            }

            // 手动触发任务永远不由调度器自动执行
            if job.schedule_kind == "manual" {
                continue;
            }

            if let Some(next_ms) = job.next_run_at {
                if now_ms >= next_ms {
                    // 立即把 next_run_at 推进到下次时间，防止 5s 内再次触发（乐观锁防重）
                    let new_next = calculate_next_run(&job.schedule_kind, &job.schedule_value);
                    let _ = db.update_cron_job_status(&job.id, &job.last_status, None, None, new_next, None).await;

                    // 后台异步 spawn 触发
                    let db_clone = db.clone();
                    let agent_clone = agent_state.clone();
                    let app_clone = app.clone();
                    tokio::spawn(async move {
                        if let Err(e) = trigger_job_execution(&job.id, db_clone, agent_clone, app_clone).await {
                            log::error!("[CronScheduler] Job {} execution failed: {}", job.id, e);
                        }
                    });
                }
            } else {
                // 如果是启用状态，但 next_run_at 为空，进行初始化计算
                if let Some(next_ms) = calculate_next_run(&job.schedule_kind, &job.schedule_value) {
                    let _ = db.update_cron_job_status(&job.id, &job.last_status, None, None, Some(next_ms), None).await;
                    let _ = app.emit("cron-job-updated", &job.id);
                }
            }
        }
    }
}
