import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { WorkflowRecord } from '../store/workflowStore';
import { formatError } from '../utils/error';

export type { WorkflowRecord };

export interface UpsertWorkflow {
  id?: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useWorkflowsQuery() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => invoke<WorkflowRecord[]>('list_workflows'),
  });
}

export function useWorkflowQuery(id: string | null) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => invoke<WorkflowRecord | null>('get_workflow', { id }),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateWorkflow() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (input: UpsertWorkflow) =>
      invoke<WorkflowRecord>('create_workflow', { input }),
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
    mutationFn: ({ id, input }: { id: string; input: UpsertWorkflow }) =>
      invoke<WorkflowRecord>('update_workflow', { id, input }),
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
