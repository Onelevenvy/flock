import { useEffect } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './App.css';

import { useEventStream } from './hooks/useEventStream';
import { useAgentStore } from './store/agentStore';
import { useUiStore } from './store/uiStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useWorkspacesQuery } from './hooks/useWorkspaces';
import { invoke } from '@tauri-apps/api/core';
import { MainLayout } from './components/Layout/MainLayout';
import { useTranslation } from 'react-i18next';

const mantineTheme = createTheme({
  fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  primaryColor: 'indigo',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#d1d2e3', '#a5a7bf', '#8b8da5', '#6b6d85', '#3d3f52',
      '#2a2c3d', '#21222f', '#171824', '#13141f', '#10111a',
    ],
    indigo: [
      '#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8',
      '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
    ],
  },
});

function AppInner() {
  useEventStream();
  const { t } = useTranslation();

  const errorMessage = useAgentStore((s) => s.errorMessage);
  const setError = useAgentStore((s) => s.setError);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);
  const conversationAssistants = useWorkspaceStore((s) => s.conversationAssistants);
  const status = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setWorkdir = useAgentStore((s) => s.setWorkdir);
  const { data: workspaces = [] } = useWorkspacesQuery();

  // 全局自动连接：只要有活跃的工作空间且处于 disconnected 状态，立刻初始化 Agent
  useEffect(() => {
    let active = true;
    if (activeWorkspaceId && status === 'disconnected' && workspaces.length > 0) {
      const targetWs = workspaces.find((w) => w.id === activeWorkspaceId);
      if (targetWs) {
        const assistantId = activeConversationId
          ? conversationAssistants[activeConversationId] || null
          : null;
        setStatus('connecting');
        setWorkdir(targetWs.path);
        invoke('start_agent', {
          workdir: targetWs.path,
          sessionId: activeConversationId || null,
          assistantId: assistantId === '__xiaof__' ? null : assistantId,
          projectDir: null,
          apiKey: null,
          extraArgs: null,
        })
          .then(() => {
            if (active) {
              setStatus('ready');
            }
          })
          .catch((e) => {
            if (active) {
              console.error('Failed to auto-connect agent:', e);
              setStatus('error');
              setError(String(e));
            }
          });
      }
    }
    return () => {
      active = false;
    };
  }, [
    activeWorkspaceId,
    status,
    workspaces,
    activeConversationId,
    conversationAssistants,
    setStatus,
    setWorkdir,
    setError,
  ]);

  useEffect(() => {
    if (errorMessage) {
      notifications.show({
        title: t('common.error'),
        message: errorMessage,
        color: 'red',
        autoClose: 6000,
        onClose: () => setError(null),
      });
    }
  }, [errorMessage, t, setError]);

  return <MainLayout />;
}

export default function App() {
  const themeMode = useUiStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={themeMode}>
      <Notifications position="top-right" zIndex={9999} />
      <AppInner />
    </MantineProvider>
  );
}
