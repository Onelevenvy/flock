import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { CronJob } from '../pages/Schedule/types';

// ==================== CronJob Queries & Mutations ====================

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
  assistant_id: string;
}

import { useTranslation } from 'react-i18next';

export interface I18nString {
  zh: string;
  en: string;
}

type RawCronJob = Omit<CronJob, 'name' | 'description'> & {
  name: I18nString | string;
  description: I18nString | string;
};

function parseCronMultiLang(fieldVal: I18nString | string | undefined | null, lang: string): string {
  if (!fieldVal) return '';
  if (typeof fieldVal === 'string') {
    if (fieldVal.startsWith('{') && fieldVal.endsWith('}')) {
      try {
        const parsed = JSON.parse(fieldVal) as I18nString;
        const currentLang = ((lang || 'zh').split('-')[0]) as 'zh' | 'en';
        return parsed[currentLang] || parsed['en'] || parsed['zh'] || '';
      } catch (e) {
        return fieldVal;
      }
    }
    return fieldVal;
  }
  const currentLang = ((lang || 'zh').split('-')[0]) as 'zh' | 'en';
  return fieldVal[currentLang] || fieldVal['en'] || fieldVal['zh'] || '';
}

/** 获取所有定时任务列表 */
export function useCronJobsQuery() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  return useQuery<CronJob[]>({
    queryKey: ['cron_jobs', currentLang],
    queryFn: async () => {
      const data = await invoke<RawCronJob[]>('list_cron_jobs');
      return data.map(job => ({
        ...job,
        name: parseCronMultiLang(job.name, currentLang),
        description: parseCronMultiLang(job.description, currentLang),
      })) as CronJob[];
    },
    staleTime: 30 * 1000, // 30s 缓存，任务状态变动较频繁
    refetchInterval: 10 * 1000, // 每 10s 自动刷新（后台调度可能更新 next_run_at）
  });
}

/** 创建定时任务 */
export function useCreateCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCronJobInput) => {
      const payload = {
        ...input,
        name: { zh: input.name, en: input.name },
        description: { zh: input.description, en: input.description },
      };
      return invoke<CronJob>('create_cron_job', { input: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
    },
  });
}

/** 更新定时任务 */
export function useUpdateCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertCronJobInput }) => {
      const payload = {
        ...input,
        name: { zh: input.name, en: input.name },
        description: { zh: input.description, en: input.description },
      };
      return invoke<CronJob>('update_cron_job', { id, input: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
    },
  });
}

/** 删除定时任务 */
export function useDeleteCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('delete_cron_job', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
    },
  });
}

/** 切换启用/禁用 */
export function useToggleCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      invoke('set_cron_job_enabled', { id, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
    },
  });
}

/** 立即触发执行一次 */
export function useRunCronJobNowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('run_cron_job_now', { id }),
    onSuccess: () => {
      // 延迟刷新，让后台启动有一点时间
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
      }, 1500);
    },
  });
}
