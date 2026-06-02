import { useEffect, useRef } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './App.css';

import { useEventStream } from './hooks/useEventStream';
import { useAgentStore } from './store/agentStore';
import { useUiStore } from './store/uiStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useConversationsQuery, useWorkspacesQuery } from './hooks/useWorkspaces';
import { invoke } from '@tauri-apps/api/core';
import { MainLayout } from './components/Layout/MainLayout';
import { useTranslation } from 'react-i18next';

const mantineTheme = createTheme({
  fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  primaryColor: 'blue',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a',
      '#52525b', '#3f3f46', '#27272a', '#18181b', '#09090b',
    ],
    blue: [
      '#edf5ff', '#d0e5ff', '#a5cdff', '#76aeff', '#438bff',
      '#155aef', '#1c64f2', '#003bb3', '#002a80', '#00174d',
    ],
  },
});

function AppInner() {
  useEventStream();
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    invoke('set_locale', { locale: language }).catch(err => console.error("set_locale failed:", err));
  }, [language]);

  const errorMessage = useAgentStore((s) => s.errorMessage);
  const setError = useAgentStore((s) => s.setError);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);
  const conversationAssistants = useWorkspaceStore((s) => s.conversationAssistants);
  const setActiveConversation = useWorkspaceStore((s) => s.setActiveConversation);
  const status = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setWorkdir = useAgentStore((s) => s.setWorkdir);
  const messages = useAgentStore((s) => s.messages);
  const loadHistory = useAgentStore((s) => s.loadHistory);
  const { data: workspaces = [] } = useWorkspacesQuery();
  const {
    data: conversations = [],
    isFetched: conversationsFetched,
    isFetching: conversationsFetching,
  } = useConversationsQuery(activeWorkspaceId);

  const setConversationAssistant = useWorkspaceStore((s) => s.setConversationAssistant);
  const isHistoryRestored = useRef(false);

  // 同步对话与助手的数据库元数据映射关系，保证本地存储或后台新生成的对话状态在前端完全自动同步
  useEffect(() => {
    if (!conversationsFetched || conversations.length === 0) return;
    conversations.forEach((conv) => {
      if (conv.assistant_id) {
        setConversationAssistant(conv.id, conv.assistant_id);
      }
    });
  }, [conversations, conversationsFetched, setConversationAssistant]);

  useEffect(() => {
    if (!activeConversationId || !conversationsFetched || conversationsFetching) return;
    if (!conversations.some((conv) => conv.id === activeConversationId)) {
      setActiveConversation(null);
    }
  }, [activeConversationId, conversations, conversationsFetched, conversationsFetching, setActiveConversation]);

  // 当 activeConversationId 存在且有效，且尚未恢复过历史时，在应用初始化时仅加载一次历史以恢复界面状态
  useEffect(() => {
    if (!conversationsFetched || conversationsFetching) return;

    if (activeWorkspaceId && activeConversationId && !isHistoryRestored.current) {
      if (conversations.some((conv) => conv.id === activeConversationId)) {
        loadHistory(activeWorkspaceId, activeConversationId);
      }
    }
    isHistoryRestored.current = true;
  }, [
    activeWorkspaceId,
    activeConversationId,
    conversationsFetched,
    conversationsFetching,
    conversations,
    loadHistory,
  ]);

  // 全局自动连接：只要有活跃的工作空间且处于 disconnected 状态，立刻初始化 Agent
  useEffect(() => {
    let active = true;
    if (activeWorkspaceId && status === 'disconnected' && workspaces.length > 0) {
      if (activeConversationId && (!conversationsFetched || conversationsFetching)) {
        return () => {
          active = false;
        };
      }

      const targetWs = workspaces.find((w) => w.id === activeWorkspaceId);
      if (targetWs) {
        const sessionExists = !!activeConversationId
          && conversationsFetched
          && !conversationsFetching
          && conversations.some((conv) => conv.id === activeConversationId);
        const sessionId = sessionExists ? activeConversationId : null;
        const assistantId = sessionId
          ? conversationAssistants[sessionId] || null
          : null;
        if (assistantId?.startsWith('workflow:')) {
          setWorkdir(targetWs.path);
          setStatus('ready');
          return () => {
            active = false;
          };
        }
        setStatus('connecting');
        setWorkdir(targetWs.path);
        invoke('start_agent', {
          workdir: targetWs.path,
          sessionId,
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
    conversations,
    conversationsFetched,
    conversationsFetching,
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
