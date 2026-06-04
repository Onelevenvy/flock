import { invoke } from '@tauri-apps/api/core';
import type { CronJob } from '@/pages/Schedule/types';

export interface I18nString {
  zh: string;
  en: string;
}

export type RawCronJob = Omit<CronJob, 'name' | 'description'> & {
  name: I18nString | string;
  description: I18nString | string;
};

export interface UpsertCronJobInput {
  id: string | null;
  name: string;
  description: string;
  enabled: boolean;
  schedule_kind: string;
  schedule_value: string;
  schedule_desc: string;
  execution_mode: string;
  prompt: string;
  workspace_id: string;
  assistant_id?: string | null;
  workflow_id?: string | null;
}

export const cronService = {
  async listCronJobs(): Promise<RawCronJob[]> {
    return await invoke<RawCronJob[]>('list_cron_jobs');
  },

  async createCronJob(payload: any): Promise<CronJob> {
    return await invoke<CronJob>('create_cron_job', { input: payload });
  },

  async updateCronJob(id: string, payload: any): Promise<CronJob> {
    return await invoke<CronJob>('update_cron_job', { id, input: payload });
  },

  async deleteCronJob(id: string): Promise<void> {
    await invoke('delete_cron_job', { id });
  },

  async setCronJobEnabled(id: string, enabled: boolean): Promise<void> {
    await invoke('set_cron_job_enabled', { id, enabled });
  },

  async runCronJobNow(id: string): Promise<void> {
    await invoke('run_cron_job_now', { id });
  }
};
