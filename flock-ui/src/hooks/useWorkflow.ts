import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { WorkflowRecord } from '@/store/workflowStore';
import { formatError } from '@/utils/error';

export type { WorkflowRecord };

export interface I18nString {
  zh: string;
  en: string;
}

export interface UpsertWorkflow {
  id?: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

// ── Queries ─────────────────────────────────────────────────────────────────

type RawWorkflowRecord = Omit<WorkflowRecord, 'name' | 'description'> & {
  name: I18nString | string;
  description: I18nString | string;
};

function parseWorkflowMultiLang(fieldVal: I18nString | string | undefined | null, lang: string): string {
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

export function useWorkflowsQuery() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  return useQuery({
    queryKey: ['workflows', currentLang],
    queryFn: async () => {
      const data = await invoke<RawWorkflowRecord[]>('list_workflows');
      return data.map(w => ({
        ...w,
        name: parseWorkflowMultiLang(w.name, currentLang),
        description: parseWorkflowMultiLang(w.description, currentLang),
      })) as WorkflowRecord[];
    },
  });
}

export function useWorkflowQuery(id: string | null) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  return useQuery({
    queryKey: ['workflow', id, currentLang],
    queryFn: async () => {
      const w = await invoke<RawWorkflowRecord | null>('get_workflow', { id });
      if (!w) return null;
      return {
        ...w,
        name: parseWorkflowMultiLang(w.name, currentLang),
        description: parseWorkflowMultiLang(w.description, currentLang),
      } as WorkflowRecord;
    },
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateWorkflow() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (input: UpsertWorkflow) => {
      const payload = {
        ...input,
        name: { zh: input.name, en: input.name },
        description: { zh: input.description, en: input.description },
      };
      return invoke<WorkflowRecord>('create_workflow', { input: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      notifications.show({
        message: t('workflow.createdToast'),
        color: 'green',
      });
    },
    onError: (e) => {
      notifications.show({
        message: formatError(e),
        color: 'red',
      });
    },
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertWorkflow }) => {
      const payload = {
        ...input,
        name: { zh: input.name, en: input.name },
        description: { zh: input.description, en: input.description },
      };
      return invoke<WorkflowRecord>('update_workflow', { id, input: payload });
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', id] });
      notifications.show({
        message: t('workflow.savedToast'),
        color: 'green',
      });
    },
    onError: (e) => {
      notifications.show({
        message: formatError(e),
        color: 'red',
      });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => invoke<void>('delete_workflow', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      notifications.show({
        message: t('workflow.deletedToast'),
        color: 'green',
      });
    },
    onError: (e) => {
      notifications.show({
        message: formatError(e),
        color: 'red',
      });
    },
  });
}
