import { invoke } from '@tauri-apps/api/core';
import type { WorkflowRecord } from '@/store/workflowStore';

export interface I18nString {
  zh: string;
  en: string;
}

export type RawWorkflowRecord = Omit<WorkflowRecord, 'name' | 'description'> & {
  name: I18nString | string;
  description: I18nString | string;
};

export interface UpsertWorkflow {
  id?: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

export const workflowService = {
  async listWorkflows(): Promise<RawWorkflowRecord[]> {
    return await invoke<RawWorkflowRecord[]>('list_workflows');
  },

  async getWorkflow(id: string | null): Promise<RawWorkflowRecord | null> {
    return await invoke<RawWorkflowRecord | null>('get_workflow', { id });
  },

  async createWorkflow(payload: unknown): Promise<WorkflowRecord> {
    return await invoke<WorkflowRecord>('create_workflow', { input: payload });
  },

  async updateWorkflow(id: string, payload: unknown): Promise<WorkflowRecord> {
    return await invoke<WorkflowRecord>('update_workflow', { id, input: payload });
  },

  async deleteWorkflow(id: string): Promise<void> {
    await invoke<void>('delete_workflow', { id });
  }
};
