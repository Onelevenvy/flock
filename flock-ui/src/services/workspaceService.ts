import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceInfo, ConversationInfo } from '@/types/workspace';

export const workspaceService = {
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    return await invoke<WorkspaceInfo[]>('list_workspaces');
  },

  async createWorkspace(name: string): Promise<WorkspaceInfo> {
    return await invoke<WorkspaceInfo>('create_workspace', { name });
  },

  async deleteWorkspace(id: string): Promise<void> {
    await invoke('delete_workspace', { id });
  },

  async listConversations(workspaceId: string): Promise<ConversationInfo[]> {
    return await invoke<ConversationInfo[]>('list_conversations', { workspaceId });
  },

  async createConversation(workspaceId: string, title: string, assistantId?: string | null): Promise<ConversationInfo> {
    return await invoke<ConversationInfo>('create_conversation', { workspaceId, title, assistantId });
  },

  async deleteConversation(workspaceId: string, convId: string): Promise<void> {
    await invoke('delete_conversation', { workspaceId, convId });
  },

  async updateConversationTitle(workspaceId: string, convId: string, title: string): Promise<void> {
    await invoke('update_conversation_title', { workspaceId, convId, title });
  }
};
