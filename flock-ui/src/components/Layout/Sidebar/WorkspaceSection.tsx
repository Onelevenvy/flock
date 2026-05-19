import { useState, useEffect } from 'react';
import {
  Box,
  Tooltip,
  ActionIcon,
  Text,
  Group,
  ScrollArea,
  Button,
  Modal,
  TextInput,
  Stack,
} from '@mantine/core';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useUiStore } from '../../../store/uiStore';
import { useAgentStore } from '../../../store/agentStore';
import { WorkspaceTreeNode } from './WorkspaceTreeNode';
import {
  useWorkspacesQuery,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useCreateConversationMutation,
  useDeleteConversationMutation,
  useUpdateConversationTitleMutation,
} from '../../../hooks/useWorkspaces';
import { useTranslation } from 'react-i18next';

export function WorkspaceSection() {
  const { t } = useTranslation();
  const { setCurrentView } = useUiStore();
  const {
    activeWorkspaceId,
    activeConversationId,
    setActiveWorkspace,
    setActiveConversation,
  } = useWorkspaceStore();

  const { data: workspaces = [], refetch: refetchWorkspaces } = useWorkspacesQuery();
  const { mutateAsync: createWorkspace } = useCreateWorkspaceMutation();
  const { mutateAsync: deleteWorkspace } = useDeleteWorkspaceMutation();
  const { mutateAsync: createConversation } = useCreateConversationMutation();
  const { mutateAsync: deleteConversation } = useDeleteConversationMutation();
  const { mutateAsync: updateConversationTitle } = useUpdateConversationTitleMutation();

  const setWorkdir = useAgentStore((s) => s.setWorkdir);
  const setStatus = useAgentStore((s) => s.setStatus);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const loadHistory = useAgentStore((s) => s.loadHistory);

  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creating, setCreating] = useState(false);

  // Tree states
  const [expandedWs, setExpandedWs] = useState<Record<string, boolean>>({});

  // 挂载时，若存在已激活工作区，则默认展开它
  useEffect(() => {
    if (activeWorkspaceId) {
      setExpandedWs(prev => ({ ...prev, [activeWorkspaceId]: true }));
    }
  }, [activeWorkspaceId]);

  const toggleWs = (wsId: string) => {
    setExpandedWs(prev => ({ ...prev, [wsId]: !prev[wsId] }));
  };

  const startAgentForWorkspace = async (wsPath: string, sessionId?: string | null) => {
    const assistants = useWorkspaceStore.getState().conversationAssistants;
    const assistantId = sessionId ? (assistants[sessionId] || null) : null;

    try {
      setWorkdir(wsPath);
      setStatus('connecting');
      await invoke('start_agent', {
        workdir: wsPath,
        sessionId: sessionId || null,
        assistantId: assistantId === '__xiaof__' ? null : assistantId,
        projectDir: null,
        apiKey: null,
        extraArgs: null,
      });
      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      useAgentStore.getState().setError(String(e));
    }
  };

  const handleSelectConversation = async (wsId: string, convId: string) => {
    if (wsId !== activeWorkspaceId) {
      setActiveWorkspace(wsId);
    }
    setActiveConversation(convId);
    await loadHistory(wsId, convId);
    const ws = workspaces.find(w => w.id === wsId);
    if (ws) {
      startAgentForWorkspace(ws.path, convId);
    }
    // 切换回主视图（修复从插件/构建页点击对话不跳转的 bug）
    setCurrentView('home');
  };

  const handleNewConversation = async (wsId: string) => {
    if (wsId !== activeWorkspaceId) {
      setActiveWorkspace(wsId);
    }
    try {
      const conv = await createConversation({ workspaceId: wsId, title: '' });
      clearMessages();
      setActiveConversation(conv.id);
      setStatus('disconnected');
      // 切换回主视图（显示 HomeView 欢迎页面，以便在开始对话前选择想要绑定的助手）
      setCurrentView('home');
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(newWsName.trim());
      setNewWsName('');
      setShowNewWs(false);
      setExpandedWs(prev => ({ ...prev, [ws.id]: true }));
    } catch (e: any) {
      useWorkspaceStore.getState().setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkspace = async (wsId: string) => {
    if (window.confirm(t('sidebar.deleteWorkspaceConfirm'))) {
      try {
        await deleteWorkspace(wsId);
      } catch (e: any) {
        useWorkspaceStore.getState().setError(String(e));
      }
    }
  };

  const handleDeleteConversation = async (wsId: string, convId: string) => {
    if (window.confirm(t('sidebar.deleteConversationConfirm'))) {
      try {
        await deleteConversation({ workspaceId: wsId, convId });
      } catch (e) {
        console.error('Failed to delete conversation:', e);
      }
    }
  };

  const handleRenameConversation = async (wsId: string, convId: string, title: string) => {
    try {
      await updateConversationTitle({ workspaceId: wsId, convId, title });
    } catch (e) {
      console.error('Failed to rename conversation:', e);
    }
  };

  return (
    <>
      <Box
        style={{
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('sidebar.workspace')}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t('sidebar.refresh')} withArrow>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => refetchWorkspaces()}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('sidebar.newWorkspace')} withArrow>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setShowNewWs(true)}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <ScrollArea style={{ flex: 1 }} p={12}>
        {workspaces.length === 0 ? (
          <Box py={24} style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed" mb={12}>{t('sidebar.noWorkspace')}</Text>
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={() => setShowNewWs(true)}
            >
              {t('sidebar.newWorkspace')}
            </Button>
          </Box>
        ) : (
          workspaces.map(ws => (
            <WorkspaceTreeNode
              key={ws.id}
              ws={ws}
              isExpanded={!!expandedWs[ws.id]}
              onToggle={() => toggleWs(ws.id)}
              activeWorkspaceId={activeWorkspaceId}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteWorkspace={handleDeleteWorkspace}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
              onNewConversation={handleNewConversation}
            />
          ))
        )}
      </ScrollArea>

      {/* 新建工作空间 Modal */}
      <Modal
        opened={showNewWs}
        onClose={() => { setShowNewWs(false); setNewWsName(''); }}
        title={
          <Group gap="xs">
            <IconPlus size={18} color="var(--flock-accent)" />
            <Text fw={600} size="md">{t('sidebar.newWorkspace')}</Text>
          </Group>
        }
        size="sm"
        styles={{
          content: {
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-dim)',
          },
          header: {
            background: 'var(--flock-bg-raised)',
            borderBottom: '1px solid var(--flock-border-subtle)',
          },
        }}
      >
        <Stack gap="md" pt="xs">
          <TextInput
            label={t('sidebar.workspaceName')}
            description={t('sidebar.workspaceNameDesc')}
            placeholder={t('sidebar.workspacePlaceholder')}
            value={newWsName}
            onChange={(e) => setNewWsName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
            autoFocus
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowNewWs(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              color="blue"
              loading={creating}
              onClick={handleCreateWorkspace}
              disabled={!newWsName.trim()}
              leftSection={<IconPlus size={16} />}
            >
              {t('common.create')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
