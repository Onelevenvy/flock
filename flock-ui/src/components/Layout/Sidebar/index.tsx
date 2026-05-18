import { useState, useEffect } from 'react';
import {
  Box,
  Tooltip,
  ActionIcon,
  Stack,
  Text,
  Group,
  Button,
  Modal,
  TextInput,
  ScrollArea,
  Collapse,
  UnstyledButton,
  Avatar,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconPlus,
  IconHome,
  IconChevronRight,
  IconChevronDown,
  IconUserCircle,
  IconRefresh,
  IconSettings,
  IconRobot,
  IconRoute,
  IconBoxMultiple,
  IconBolt,
  IconCalendarTime,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useUiStore } from '../../../store/uiStore';
import { useAgentStore } from '../../../store/agentStore';
import SettingsModal from '../../Settings/SettingsModal';
import { FlockLogo } from './FlockLogo';
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

export function Sidebar() {
  const { t } = useTranslation();
  const { isSidebarCollapsed, isSettingsOpen, setSettingsOpen, currentView, setCurrentView } = useUiStore();
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
  const [moreOpened, setMoreOpened] = useState(false);

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

  const PRIMARY_MENUS = [
    { label: t('sidebar.home'), icon: IconHome, view: 'home' as const },
    { label: t('sidebar.assistant'), icon: IconRobot, view: 'assistant' as const },
    { label: t('sidebar.skills'), icon: IconBolt, view: 'skills' as const },
  ];

  const SECONDARY_MENUS = [
    { label: t('sidebar.workflow'), icon: IconRoute, view: 'workflow' as const },
    { label: t('sidebar.collaboration'), icon: IconBoxMultiple, view: 'collaboration' as const },
    { label: t('sidebar.schedule'), icon: IconCalendarTime, view: 'schedule' as const },
  ];

  if (isSidebarCollapsed) return null;

  return (
    <>
      <Box
        style={{
          width: 260,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--flock-bg-base)',
          border: '1px solid var(--flock-border-subtle)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <FlockLogo />

        <Stack gap={2} px="md" py="xs">
          {PRIMARY_MENUS.map(menu => {
            const isActive = currentView === menu.view && (menu.view !== 'home' || !activeConversationId);
            return (
              <UnstyledButton
                key={menu.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: isActive ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
                  background: isActive ? 'var(--flock-accent-soft)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setCurrentView(menu.view);
                  if (menu.view === 'home') setActiveConversation(null);
                }}
              >
                <menu.icon size={20} />
                <Text size="sm">{menu.label}</Text>
              </UnstyledButton>
            );
          })}

          <UnstyledButton
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 8,
              color: 'var(--flock-text-secondary)',
              marginTop: 4,
            }}
            onClick={() => setMoreOpened(!moreOpened)}
          >
            <Group gap={12}>
              <IconLayoutGrid size={20} />
              <Text size="sm" fw={500}>{t('sidebar.more')}</Text>
            </Group>
            {moreOpened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </UnstyledButton>

          <Collapse in={moreOpened}>
            <Stack gap={2} mt={2}>
              {SECONDARY_MENUS.map(menu => {
                const isActive = currentView === menu.view;
                return (
                  <UnstyledButton
                    key={menu.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      color: isActive ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
                      background: isActive ? 'var(--flock-accent-soft)' : 'transparent',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => setCurrentView(menu.view)}
                  >
                    <menu.icon size={20} />
                    <Text size="sm">{menu.label}</Text>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </Collapse>
        </Stack>

        <Divider color="dark.6" mx="md" my="sm" style={{ borderColor: 'var(--flock-border-subtle)' }} />

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
                color="indigo"
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

        {/* 底部设置按钮 */}
        <Box style={{ padding: '16px', borderTop: '1px solid var(--flock-border-dim)' }}>
          <UnstyledButton
            onClick={() => setSettingsOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}
            className="hover-bg-raised"
          >
            <Avatar src={null} alt="jimmy" radius="xl" color="indigo" size="md">
              <IconUserCircle size={26} />
            </Avatar>
            <Box style={{ flex: 1, overflow: 'hidden' }}>
              <Text size="sm" fw={600} truncate>Jimmy</Text>
            </Box>
            <IconSettings size={18} color="var(--flock-text-dim)" />
          </UnstyledButton>
        </Box>
      </Box>

      {/* 新建工作空间 Modal */}
      <Modal
        opened={showNewWs}
        onClose={() => { setShowNewWs(false); setNewWsName(''); }}
        title={
          <Group gap="xs">
            <IconPlus size={18} color="#6366f1" />
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
              color="indigo"
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

      {/* 设置 Modal */}
      <SettingsModal
        opened={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
