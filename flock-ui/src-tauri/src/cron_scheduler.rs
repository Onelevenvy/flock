use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;
use chrono::{DateTime, Datelike, Local, Timelike, TimeZone};
use tauri::{AppHandle, Emitter};

use flock_core::db::DbManager;
use crate::commands::SharedAgentState;
use flock_core::ipc_interface::commands::SessionMode;

// ==========================================
// 1. Cron 表达式解析器
// ==========================================

#[derive(Debug, Clone)]
pub struct CronParser {
    minutes: Vec<u32>,
    hours: Vec<u32>,
    days: Vec<u32>,
    months: Vec<u32>,
    days_of_week: Vec<u32>,
}

impl CronParser {
    pub fn parse(expr: &str) -> Option<Self> {
        let parts: Vec<&str> = expr.split_whitespace().collect();
        if parts.len() != 5 {
            return None;
        }

        let minutes = parse_field(parts[0], 0, 59)?;
        let hours = parse_field(parts[1], 0, 23)?;
        let days = parse_field(parts[2], 1, 31)?;
        let months = parse_field(parts[3], 1, 12)?;
        let days_of_week = parse_field(parts[4], 0, 6)?; // 0 = Sun, 6 = Sat

        Some(Self {
            minutes,
            hours,
            days,
            months,
            days_of_week,
        })
    }

    pub fn next_run_from(&self, current: DateTime<Local>) -> Option<DateTime<Local>> {
        let mut check = current + chrono::Duration::minutes(1);
        // 向后扫描最多 60 天 (60 * 24 * 60 = 86400 分钟)
        for _ in 0..86400 {
            let min = check.minute();
            let hr = check.hour();
            let day = check.day();
            let mon = check.month();
            let wday = match check.weekday() {
                chrono::Weekday::Sun => 0,
                chrono::Weekday::Mon => 1,
                chrono::Weekday::Tue => 2,
                chrono::Weekday::Wed => 3,
                chrono::Weekday::Thu => 4,
                chrono::Weekday::Fri => 5,
                chrono::Weekday::Sat => 6,
            };

            if self.minutes.contains(&min)
                && self.hours.contains(&hr)
                && self.days.contains(&day)
                && self.months.contains(&mon)
                && self.days_of_week.contains(&wday)
            {
                if let Some(aligned) = Local.with_ymd_and_hms(check.year(), check.month(), check.day(), check.hour(), check.minute(), 0).single() {
                    return Some(aligned);
                }
            }
            check = check + chrono::Duration::minutes(1);
        }
        None
    }
}

fn parse_field(field: &str, min_val: u32, max_val: u32) -> Option<Vec<u32>> {
    let mut values = Vec::new();
    if field == "*" {
        return Some((min_val..=max_val).collect());
    }

    for part in field.split(',') {
        if part.contains('/') {
            let subparts: Vec<&str> = part.split('/').collect();
            if subparts.len() != 2 {
                return None;
            }
            let step: u32 = subparts[1].parse().ok()?;
            let range_str = subparts[0];
            let (start, end) = if range_str == "*" {
                (min_val, max_val)
            } else if range_str.contains('-') {
                let range_parts: Vec<&str> = range_str.split('-').collect();
                if range_parts.len() != 2 {
                    return None;
                }
                (range_parts[0].parse().ok()?, range_parts[1].parse().ok()?)
            } else {
                (range_str.parse().ok()?, max_val)
            };
            let mut i = start;
            while i <= end {
                values.push(i);
                i += step;
            }
        } else if part.contains('-') {
            let range_parts: Vec<&str> = part.split('-').collect();
            if range_parts.len() != 2 {
                return None;
            }
            let start: u32 = range_parts[0].parse().ok()?;
            let end: u32 = range_parts[1].parse().ok()?;
            for i in start..=end {
                values.push(i);
            }
        } else {
            let val: u32 = part.parse().ok()?;
            values.push(val);
        }
    }
    values.sort();
    values.dedup();
    Some(values)
}

// 计算下一次执行时间
pub fn calculate_next_run(kind: &str, value: &str) -> Option<i64> {
    let now = Local::now();
    match kind {
        "at" => {
            // 一次性时间戳
            let ms: i64 = value.parse().ok()?;
            if ms > now.timestamp_millis() {
                Some(ms)
            } else {
                None
            }
        }
        "every" => {
            // 间隔运行，单位分钟
            let mins: i64 = value.parse().ok()?;
            if mins <= 0 {
                return None;
            }
            Some((now + chrono::Duration::minutes(mins)).timestamp_millis())
        }
        "cron" => {
            // Cron 表达式
            let parser = CronParser::parse(value)?;
            let next_dt = parser.next_run_from(now)?;
            Some(next_dt.timestamp_millis())
        }
        _ => None,
    }
}

// ==========================================
// 2. 调度执行系统
// ==========================================

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

            if let Some(next_ms) = job.next_run_at {
                if now_ms >= next_ms {
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
            } else if job.schedule_kind != "manual" {
                // 如果是启用状态，但是 next_run_at 为空，可能是新创建或刚开启的任务，进行初始化计算
                if let Some(next_ms) = calculate_next_run(&job.schedule_kind, &job.schedule_value) {
                    let _ = db.update_cron_job_status(&job.id, &job.last_status, None, None, Some(next_ms), None).await;
                    let _ = app.emit("cron-job-updated", &job.id);
                }
            }
        }
    }
}

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
            // 验证会话在数据库中是否真实存在
            if db.has_conversation(last_id).await.unwrap_or(false) {
                conv_id = last_id.clone();
                needs_create = false;
            }
        }
    }

    if needs_create {
        let title = format!("🕒 定时自动：{}", job.name);
        let conv_info = db.create_conversation(&job.workspace_id, &title).await?;
        conv_id = conv_info.id;
    }

    // 2. 拼接工作空间的绝对路径
    let workspace_root = db_path::workspace_root();
    let workdir = workspace_root.join(&job.workspace_id);

    // 3. 启动 Agent
    let extra_args = vec![];
    
    // 静默在后台启动 Agent
    if let Err(e) = crate::agent::start_agent(
        app.clone(),
        agent_state.clone(),
        workdir,
        Some(conv_id.clone()),
        Some(job.assistant_id.clone()),
        extra_args,
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

    // 4. 等待 Agent 初始化并在底层加载 session 句柄
    let mut handle_exists = false;
    for _ in 0..30 {
        tokio::time::sleep(Duration::from_millis(200)).await;
        let s = agent_state.lock().await;
        if s.sessions.contains_key(&conv_id) {
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

    if let Err(e) = crate::agent::send_message(
        agent_state.clone(),
        Some(conv_id.clone()),
        msg_id,
        prompt_content,
        app.clone(),
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

    // 7. 轮询等待 Agent 运行结束 (is_running 从 true 到 false)
    tokio::time::sleep(Duration::from_secs(1)).await; // 给予少量消息分发反应时间
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

    // 8. 运行完毕，计算下一次运行时间并更新数据库状态
    let now_ms = Local::now().timestamp_millis();
    let next_run = calculate_next_run(&job.schedule_kind, &job.schedule_value);

    // 如果是一次性任务 at，执行完成后将 enabled 设为 0，防止重复触发
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

fn uuid_like() -> String {
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
