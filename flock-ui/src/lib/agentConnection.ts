import { invoke } from '@tauri-apps/api/core';
import { useAgentStore } from '../store/agentStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { ConversationInfo, WorkspaceInfo } from '../types/workspace';

export async function reconnectCurrentAgent(workspaces: WorkspaceInfo[]) {
  const {
    activeWorkspaceId,
    activeConversationId,
    conversationAssistants,
  } = useWorkspaceStore.getState();

  if (!activeWorkspaceId) return false;

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  if (!workspace) return false;

  let sessionId = activeConversationId;
  if (sessionId) {
    try {
      const conversations = await invoke<ConversationInfo[]>('list_conversations', {
        workspaceId: activeWorkspaceId,
      });
      if (!conversations.some((conv) => conv.id === sessionId)) {
        sessionId = null;
        useWorkspaceStore.getState().setActiveConversation(null);
      }
    } catch {
      sessionId = null;
    }
  }

  const assistantId = sessionId
    ? conversationAssistants[sessionId] || null
    : null;

  const agentStore = useAgentStore.getState();
  agentStore.setStatus('connecting');
  agentStore.setWorkdir(workspace.path);
  agentStore.setError(null);

  try {
    await invoke('start_agent', {
      workdir: workspace.path,
      sessionId,
      assistantId: assistantId === '__xiaof__' ? null : assistantId,
      projectDir: null,
      apiKey: null,
      extraArgs: ['--force-restart'],
    });
    useAgentStore.getState().setStatus('ready');
    return true;
  } catch (e) {
    const message = String(e);
    useAgentStore.getState().setStatus('error');
    useAgentStore.getState().setError(message);
    return false;
  }
}
