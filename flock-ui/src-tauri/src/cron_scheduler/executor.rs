use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;
use chrono::Local;
use tauri::{AppHandle, Emitter, Manager};

use flock_core::db::DbManager;
use crate::commands::SharedAgentState;
use flock_core::ipc_interface::commands::SessionMode;

use super::cron_parser::calculate_next_run;

type SharedDbManager = Arc<DbManager>;

/// 后台静默执行单个定时任务
pub async fn trigger_job_execution(
    job_id: &str,
    db: Arc<DbManager>,
    agent_state: SharedAgentState,
    app: AppHandle,
) -> anyhow::Result<()> {
    log::info!("[CronScheduler] Triggering job: {}", job_id);

    let job = db.get_cron_job(job_id).await?
        .ok_or_else(|| anyhow::anyhow!("Job {} not found", job_id))?;

    // 1. 解析或新建对话 session_id
    let mut conv_id = String::new();
    let mut needs_create = true;

    if job.execution_mode == "existing" {
        if let Some(ref last_id) = job.last_conversation_id {
            if db.has_conversation(last_id).await.unwrap_or(false) {
                conv_id = last_id.clone();
                needs_create = false;
            }
        }
    }

    if needs_create {
        let title = format!("🕒 ：{}", job.name.zh);
        let target_assistant = if let Some(ref wf_id) = job.workflow_id {
            if !wf_id.trim().is_empty() {
                Some(format!("workflow:{}", wf_id))
            } else {
                job.assistant_id.clone()
            }
        } else {
            job.assistant_id.clone()
        };
        let conv_info = db.create_conversation(&job.workspace_id, &title, target_assistant).await?;
        conv_id = conv_info.id;
    }

    // 立即更新任务状态为 "running" 并广播
    db.update_cron_job_status(
        job_id,
        "running",
        None,
        None,
        None,
        Some(&conv_id),
    ).await?;
    let _ = app.emit("cron-job-updated", job_id);

    // 如果 workflow_id 存在且不为空，执行工作流
    if let Some(ref workflow_id) = job.workflow_id {
        if !workflow_id.trim().is_empty() {
            let db_state = app.state::<SharedDbManager>();
            let exec_state = app.state::<Arc<crate::commands::WorkflowExecutionState>>();
            let agent_state_state = app.state::<SharedAgentState>();

            // 设置为静默自动审批 YOLO 模式
            {
                let s = agent_state_state.lock().await;
                s.approval_manager.set_mode(SessionMode::Yolo);
            }

            if let Err(e) = crate::commands::run_workflow(
                app.clone(),
                db_state,
                exec_state.clone(),
                agent_state_state,
                workflow_id.clone(),
                Some(job.prompt.clone()),
                None,
                Some(conv_id.clone()),
                None,
            ).await {
                db.update_cron_job_status(
                    job_id,
                    "error",
                    Some(&e.to_string()),
                    Some(Local::now().timestamp_millis()),
                    calculate_next_run(&job.schedule_kind, &job.schedule_value),
                    Some(&conv_id),
                ).await?;
                let _ = app.emit("cron-job-updated", job_id);
                anyhow::bail!("Failed to start workflow: {}", e);
            }

            // 等待工作流执行完毕
            tokio::time::sleep(Duration::from_millis(500)).await;
            let mut run_success = false;

            for _ in 0..1800 { // 最多执行 15 分钟
                tokio::time::sleep(Duration::from_secs(1)).await;
                let executions = exec_state.executions.lock().unwrap();
                if !executions.contains_key(workflow_id) {
                    run_success = true;
                    break;
                }
            }

            let now_ms = Local::now().timestamp_millis();
            let next_run = calculate_next_run(&job.schedule_kind, &job.schedule_value);

            if job.schedule_kind == "at" {
                let _ = db.set_cron_job_enabled(job_id, false).await;
            }

            if run_success {
                db.update_cron_job_status(job_id, "ok", None, Some(now_ms), next_run, Some(&conv_id)).await?;
            } else {
                let err_desc = "Workflow execution timeout (15 mins limit)";
                db.update_cron_job_status(job_id, "error", Some(err_desc), Some(now_ms), next_run, Some(&conv_id)).await?;
            }

            let _ = app.emit("cron-job-updated", job_id);
            log::info!("[CronScheduler] Workflow job {} execution finished.", job_id);
            return Ok(());
        }
    }

    // 2. 拼接工作空间的绝对路径
    let workspace_root = db_path::workspace_root();
    let workdir = workspace_root.join(&job.workspace_id);

    // 3. 启动 Agent
    let extra_args = vec![];
    let selected_assistant = job.assistant_id.clone().unwrap_or_else(|| "__xiaof__".to_string());
    let emitter = Arc::new(crate::ipc::emitter::TauriProtocolEmitter::new(app.clone()));
    let output = emitter.clone() as Arc<dyn flock_agent::sinks::OutputSink + Send + Sync>;
    if let Err(e) = crate::commands::assistant::start_agent_engine(
        db.clone(),
        agent_state.clone(),
        workdir,
        Some(conv_id.clone()),
        Some(selected_assistant),
        extra_args,
        emitter.clone(),
        output.clone(),
    ).await {
        db.update_cron_job_status(
            job_id,
            "error",
            Some(&e.to_string()),
            Some(Local::now().timestamp_millis()),
            calculate_next_run(&job.schedule_kind, &job.schedule_value),
            Some(&conv_id),
        ).await?;
        let _ = app.emit("cron-job-updated", job_id);
        anyhow::bail!("Failed to start agent: {}", e);
    }

    // 4. 等待 Agent 初始化
    let mut handle_exists = false;
    for _ in 0..30 {
        tokio::time::sleep(Duration::from_millis(200)).await;
        let s = agent_state.lock().await;
        if s.metadata.contains_key(&conv_id) {
            handle_exists = true;
            break;
        }
    }

    if !handle_exists {
        db.update_cron_job_status(
            job_id,
            "error",
            Some("Agent session handle initialization timeout"),
            Some(Local::now().timestamp_millis()),
            calculate_next_run(&job.schedule_kind, &job.schedule_value),
            Some(&conv_id),
        ).await?;
        let _ = app.emit("cron-job-updated", job_id);
        anyhow::bail!("Agent session handle initialization timeout for conv: {}", conv_id);
    }

    // 5. 设置为静默自动审批 YOLO 模式
    {
        let s = agent_state.lock().await;
        s.approval_manager.set_mode(SessionMode::Yolo);
    }

    // 6. 发送提示词
    let msg_id = format!("msg_{}", uuid_like());
    let prompt_content = job.prompt.clone();

    if let Err(e) = crate::commands::assistant::send_message_to_engine(
        agent_state.clone(),
        Some(conv_id.clone()),
        msg_id,
        prompt_content,
        db.clone(),
        emitter,
        output,
    ).await {
        db.update_cron_job_status(
            job_id,
            "error",
            Some(&e.to_string()),
            Some(Local::now().timestamp_millis()),
            calculate_next_run(&job.schedule_kind, &job.schedule_value),
            Some(&conv_id),
        ).await?;
        let _ = app.emit("cron-job-updated", job_id);
        anyhow::bail!("Failed to send message: {}", e);
    }

    // 7. 轮询等待 Agent 运行结束
    tokio::time::sleep(Duration::from_secs(1)).await;
    let mut run_success = false;
    let mut run_error_msg = None;

    for _ in 0..1800 { // 最多执行 15 分钟
        tokio::time::sleep(Duration::from_secs(1)).await;
        let s = agent_state.lock().await;
        if let Some(handle) = s.sessions.get(&conv_id) {
            if !handle.is_running.load(Ordering::SeqCst) {
                run_success = true;
                break;
            }
        } else {
            run_error_msg = Some("Session evicted during execution");
            break;
        }
    }

    // 8. 运行完毕，更新数据库状态
    let now_ms = Local::now().timestamp_millis();
    let next_run = calculate_next_run(&job.schedule_kind, &job.schedule_value);

    if job.schedule_kind == "at" {
        let _ = db.set_cron_job_enabled(job_id, false).await;
    }

    if run_success && run_error_msg.is_none() {
        db.update_cron_job_status(job_id, "ok", None, Some(now_ms), next_run, Some(&conv_id)).await?;
    } else {
        let err_desc = run_error_msg.unwrap_or("Job execution timeout (15 mins limit)");
        db.update_cron_job_status(job_id, "error", Some(err_desc), Some(now_ms), next_run, Some(&conv_id)).await?;
    }

    let _ = app.emit("cron-job-updated", job_id);
    log::info!("[CronScheduler] Job {} execution finished successfully.", job_id);

    Ok(())
}

pub(super) fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{:x}{:06x}", ts, (ts ^ (ts >> 16)) & 0xFFFFFF)
}

// 供获取 workspace_root 用的内部代理
mod db_path {
    use std::path::PathBuf;
    pub fn workspace_root() -> PathBuf {
        flock_core::config::db_path::workspace_root()
    }
}
