use serde::{Deserialize, Serialize};
use sqlx::Row;

use super::DbManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub schedule_kind: String,
    pub schedule_value: String,
    pub schedule_desc: String,
    pub execution_mode: String,
    pub prompt: String,
    pub workspace_id: String,
    pub assistant_id: String,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub last_status: String,
    pub last_error: Option<String>,
    pub run_count: i64,
    pub last_conversation_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertCronJob {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub schedule_kind: String,
    pub schedule_value: String,
    pub schedule_desc: String,
    pub execution_mode: String,
    pub prompt: String,
    pub workspace_id: String,
    pub assistant_id: String,
}

impl DbManager {
    /// 列出所有定时任务，按创建时间降序
    pub async fn list_cron_jobs(&self) -> anyhow::Result<Vec<CronJobRecord>> {
        let rows = sqlx::query(
            "SELECT id, name, description, enabled, schedule_kind, schedule_value, schedule_desc,
                    execution_mode, prompt, workspace_id, assistant_id, next_run_at, last_run_at,
                    last_status, last_error, run_count, last_conversation_id, created_at, updated_at
             FROM cron_job
             ORDER BY created_at DESC",
        )
        .fetch_all(self.pool())
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(parse_row(&row)?);
        }
        Ok(result)
    }

    /// 获取单个定时任务
    pub async fn get_cron_job(&self, id: &str) -> anyhow::Result<Option<CronJobRecord>> {
        let row = sqlx::query(
            "SELECT id, name, description, enabled, schedule_kind, schedule_value, schedule_desc,
                    execution_mode, prompt, workspace_id, assistant_id, next_run_at, last_run_at,
                    last_status, last_error, run_count, last_conversation_id, created_at, updated_at
             FROM cron_job WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(self.pool())
        .await?;

        match row {
            Some(r) => Ok(Some(parse_row(&r)?)),
            None => Ok(None),
        }
    }

    /// 创建定时任务，自动计算 next_run_at 的逻辑在调度器层处理，这里先入库
    pub async fn create_cron_job(&self, input: &UpsertCronJob) -> anyhow::Result<CronJobRecord> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = input.id.clone().unwrap_or_else(|| {
            format!("cron_{}", uuid_like())
        });

        sqlx::query(
            "INSERT INTO cron_job
             (id, name, description, enabled, schedule_kind, schedule_value, schedule_desc,
              execution_mode, prompt, workspace_id, assistant_id, next_run_at, last_run_at,
              last_status, last_error, run_count, last_conversation_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL, NULL, 'ok', NULL, 0, NULL, ?12, ?12)",
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.enabled as i64)
        .bind(&input.schedule_kind)
        .bind(&input.schedule_value)
        .bind(&input.schedule_desc)
        .bind(&input.execution_mode)
        .bind(&input.prompt)
        .bind(&input.workspace_id)
        .bind(&input.assistant_id)
        .bind(&now)
        .execute(self.pool())
        .await?;

        Ok(CronJobRecord {
            id,
            name: input.name.clone(),
            description: input.description.clone(),
            enabled: input.enabled,
            schedule_kind: input.schedule_kind.clone(),
            schedule_value: input.schedule_value.clone(),
            schedule_desc: input.schedule_desc.clone(),
            execution_mode: input.execution_mode.clone(),
            prompt: input.prompt.clone(),
            workspace_id: input.workspace_id.clone(),
            assistant_id: input.assistant_id.clone(),
            next_run_at: None,
            last_run_at: None,
            last_status: "ok".to_string(),
            last_error: None,
            run_count: 0,
            last_conversation_id: None,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// 更新定时任务，排除 next_run_at，last_run_at 等状态，这些由运行期动态更新
    pub async fn update_cron_job(&self, id: &str, input: &UpsertCronJob) -> anyhow::Result<CronJobRecord> {
        let now = chrono::Utc::now().to_rfc3339();

        let rows_affected = sqlx::query(
            "UPDATE cron_job SET
                name = ?1, description = ?2, enabled = ?3, schedule_kind = ?4,
                schedule_value = ?5, schedule_desc = ?6, execution_mode = ?7,
                prompt = ?8, workspace_id = ?9, assistant_id = ?10, updated_at = ?11
             WHERE id = ?12",
        )
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.enabled as i64)
        .bind(&input.schedule_kind)
        .bind(&input.schedule_value)
        .bind(&input.schedule_desc)
        .bind(&input.execution_mode)
        .bind(&input.prompt)
        .bind(&input.workspace_id)
        .bind(&input.assistant_id)
        .bind(&now)
        .bind(id)
        .execute(self.pool())
        .await?
        .rows_affected();

        if rows_affected == 0 {
            anyhow::bail!("Cron job '{}' not found", id);
        }

        self.get_cron_job(id).await?.ok_or_else(|| anyhow::anyhow!("Cron job '{}' not found after update", id))
    }

    /// 删除定时任务
    pub async fn delete_cron_job(&self, id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM cron_job WHERE id = ?1")
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    /// 启用/禁用定时任务
    pub async fn set_cron_job_enabled(&self, id: &str, enabled: bool) -> anyhow::Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE cron_job SET enabled = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(enabled as i64)
            .bind(&now)
            .bind(id)
            .execute(self.pool())
            .await?;
        Ok(())
    }

    /// 更新定时任务执行后的状态、时间和会话记录
    pub async fn update_cron_job_status(
        &self,
        id: &str,
        last_status: &str,
        last_error: Option<&str>,
        last_run_at: Option<i64>,
        next_run_at: Option<i64>,
        last_conversation_id: Option<&str>,
    ) -> anyhow::Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE cron_job SET
                last_status = ?1,
                last_error = ?2,
                last_run_at = COALESCE(?3, last_run_at),
                next_run_at = ?4,
                run_count = case when ?3 is not null then run_count + 1 else run_count end,
                last_conversation_id = COALESCE(?5, last_conversation_id),
                updated_at = ?6
             WHERE id = ?7",
        )
        .bind(last_status)
        .bind(last_error)
        .bind(last_run_at)
        .bind(next_run_at)
        .bind(last_conversation_id)
        .bind(&now)
        .bind(id)
        .execute(self.pool())
        .await?;
        Ok(())
    }
}

fn parse_row(row: &sqlx::sqlite::SqliteRow) -> anyhow::Result<CronJobRecord> {
    let enabled: i64 = row.get("enabled");
    Ok(CronJobRecord {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        enabled: enabled != 0,
        schedule_kind: row.get("schedule_kind"),
        schedule_value: row.get("schedule_value"),
        schedule_desc: row.get("schedule_desc"),
        execution_mode: row.get("execution_mode"),
        prompt: row.get("prompt"),
        workspace_id: row.get("workspace_id"),
        assistant_id: row.get("assistant_id"),
        next_run_at: row.try_get("next_run_at").ok(),
        last_run_at: row.try_get("last_run_at").ok(),
        last_status: row.get("last_status"),
        last_error: row.try_get("last_error").ok(),
        run_count: row.get("run_count"),
        last_conversation_id: row.try_get("last_conversation_id").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{:x}{:06x}", ts, (ts ^ (ts >> 16)) & 0xFFFFFF)
}
