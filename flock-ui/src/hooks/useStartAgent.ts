import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useAgentStore } from '@/store/agentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useCreateConversationMutation, useWorkspacesQuery } from './useWorkspaces';
import { useWorkflowStore } from '@/store/workflowStore';
import type { Assistant } from '@/types/assistant';
import type { WorkflowRecord } from './useWorkflow';

export function useStartAgent() {
  const { t } = useTranslation();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: workspaces = [] } = useWorkspacesQuery();
  const { mutateAsync: createConversation } = useCreateConversationMutation();

  const setStatus = useAgentStore((s) => s.setStatus);
  const setWorkdir = useAgentStore((s) => s.setWorkdir);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const setError = useAgentStore((s) => s.setError);

  const {
    activeWorkspaceId,
    setActiveConversation,
    setConversationAssistant,
  } = useWorkspaceStore();

  const setCurrentView = useUiStore((s) => s.setCurrentView);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const ensureWorkspace = useCallback(() => {
    if (activeWorkspace) return true;
    notifications.show({
      title: t('home.explorer.workspaceRequiredTitle'),
      message: t('home.pleaseSelectWorkspace'),
      color: 'orange',
    });
    return false;
  }, [activeWorkspace, t]);

  const startAssistant = useCallback(async (assistant: Assistant) => {
    if (!ensureWorkspace() || !activeWorkspace) return;

    setLoadingId(assistant.id);
    setStatus('connecting');
    try {
      const conversation = await createConversation({
        workspaceId: activeWorkspace.id,
        title: '',
      });
      clearMessages();
      setActiveConversation(conversation.id);
      setConversationAssistant(conversation.id, assistant.id);
      setWorkdir(activeWorkspace.path);
      
      // 直接把视图切回 'home'。
      // 因为在 MainLayout 里面，当 currentView === 'home' 且 activeConversationId 不为空时，会自动进入 WorkspaceView（对话页面）
      setCurrentView('home');

      await invoke('start_agent', {
        workdir: activeWorkspace.path,
        sessionId: conversation.id,
        assistantId: assistant.id === '__xiaof__' ? null : assistant.id,
        projectDir: null,
        apiKey: null,
        extraArgs: null,
      });

      setStatus('ready');
    } catch (error: any) {
      setStatus('error');
      setError(error.message || String(error));
    } finally {
      setLoadingId(null);
    }
  }, [
    activeWorkspace,
    clearMessages,
    createConversation,
    ensureWorkspace,
    setActiveConversation,
    setConversationAssistant,
    setError,
    setStatus,
    setWorkdir,
    setCurrentView,
  ]);

  const startWorkflow = useCallback(async (workflow: WorkflowRecord) => {
    if (!ensureWorkspace() || !activeWorkspace) return;

    setLoadingId(workflow.id);
    try {
      const conversation = await createConversation({
        workspaceId: activeWorkspace.id,
        title: '',
      });

      clearMessages();
      setActiveConversation(conversation.id);
      setConversationAssistant(conversation.id, `workflow:${workflow.id}`);
      useWorkflowStore.getState().setPendingStartInput(null);
      useWorkflowStore.getState().setPendingStartQuery(null);
      useWorkflowStore.getState().setActiveExecutionThreadId(conversation.id);
      setWorkdir(activeWorkspace.path);
      
      // 直接切换到 home 渲染 WorkspaceView，从而完成“直接进入对话”
      setCurrentView('home');
      setStatus('ready');
    } catch (error: any) {
      setStatus('error');
      setError(error.message || String(error));
    } finally {
      setLoadingId(null);
    }
  }, [
    activeWorkspace,
    clearMessages,
    createConversation,
    ensureWorkspace,
    setActiveConversation,
    setConversationAssistant,
    setError,
    setStatus,
    setWorkdir,
    setCurrentView,
  ]);

  return {
    startAssistant,
    startWorkflow,
    loadingId,
  };
}
