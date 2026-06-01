export interface CronJob {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule_kind: 'manual' | 'at' | 'every' | 'cron';
  schedule_value: string;
  schedule_desc: string;
  execution_mode: 'new_conversation' | 'existing';
  prompt: string;
  workspace_id: string;
  assistant_id?: string | null;
  workflow_id?: string | null;
  next_run_at: number | null;
  last_run_at: number | null;
  last_status: 'ok' | 'error' | 'skipped' | 'missed';
  last_error: string | null;
  run_count: number;
  last_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}
