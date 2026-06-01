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
            prompt: "Hi XiaoF! 请帮我生成一份今天的智能工作简报。包括：1. 问候语；2. 建议的今日任务清单（根据我的日程或模拟）；3. 给我一条充满活力的早安寄语！".to_string(),
            workspace_id: "default".to_string(),
            assistant_id: "__xiaof__".to_string(), // 使用 xiaof 助手
        }
    ]
}
