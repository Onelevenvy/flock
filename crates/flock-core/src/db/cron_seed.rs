use crate::types::tool::I18nString;
use super::cron::UpsertCronJob;

/// Default built-in automation tasks seeded on every startup.
pub fn builtin_cron_jobs() -> Vec<UpsertCronJob> {
    vec![
        UpsertCronJob {
            id: Some("builtin-cron-xiaof-report".to_string()),
            name: I18nString::new("小F早间工作简报", "XiaoF Morning Work Briefing"),
            description: I18nString::new(
                "每天早上8点自动触发，由小F助手为您整理今日工作计划、系统健康度并给出温馨提示。",
                "Triggers automatically at 8:00 AM daily. XiaoF compiles today's plan, system health, and warm tips for you."
            ),
            enabled: true,
            schedule_kind: "manual".to_string(), 
            schedule_value: "".to_string(),
            schedule_desc: "Manual".to_string(),
            execution_mode: "new_conversation".to_string(),
            prompt: "Hi XiaoF! Please generate an intelligent morning work briefing for me today. It should include: 1. A warm greeting; 2. A recommended task list for today (based on my calendar or simulated tasks); 3. A vibrant and motivating morning message to start my day!".to_string(),
            workspace_id: "default".to_string(),
            assistant_id: "__xiaof__".to_string(), // 使用 xiaof 助手
        }
    ]
}
