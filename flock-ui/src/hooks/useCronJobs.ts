import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CronJob } from '@/pages/Schedule/types';
import { cronService, type I18nString, type RawCronJob, type UpsertCronJobInput } from '@/services/cronService';
import { useTranslation } from 'react-i18next';

// ==================== CronJob Queries & Mutations ====================

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
      const data = await cronService.listCronJobs();
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
      return cronService.createCronJob(payload);
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
      return cronService.updateCronJob(id, payload);
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
    mutationFn: (id: string) => cronService.deleteCronJob(id),
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
      cronService.setCronJobEnabled(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
    },
  });
}

/** 立即触发执行一次 */
export function useRunCronJobNowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cronService.runCronJobNow(id),
    onSuccess: () => {
      // 延迟刷新，让后台启动有一点时间
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }, 1500);
    },
  });
}
