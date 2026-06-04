import { invoke } from '@tauri-apps/api/core';
import type { Assistant, UpsertAssistant } from '@/types/assistant';

export interface I18nString {
  zh: string;
  en: string;
}

export type RawAssistant = Omit<Assistant, 'name' | 'description'> & {
  name: I18nString;
  description: I18nString;
};

export const assistantService = {
  async listAssistants(): Promise<RawAssistant[]> {
    return await invoke<RawAssistant[]>('list_assistants');
  },

  async createAssistant(payload: any): Promise<Assistant> {
    return await invoke<Assistant>('create_assistant', { input: payload });
  },

  async updateAssistant(id: string, payload: any): Promise<Assistant> {
    return await invoke<Assistant>('update_assistant', { id, input: payload });
  },

  async deleteAssistant(id: string): Promise<void> {
    await invoke('delete_assistant', { id });
  }
};
