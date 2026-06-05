import { useState, useRef, KeyboardEvent } from 'react';
import { ChatInput } from '@/components/chat/shared/ChatInput';
import {
  Group,
  Text,
  Box,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { taskService } from '@/services/taskService';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@/store/agentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';
import { v4 as uuidv4 } from 'uuid';
import { IconShieldCheck, IconBolt, IconFlame } from '@tabler/icons-react';
import { ActionIcon, Tooltip, Menu, Button } from '@mantine/core';
import { ActiveModelPicker } from '@/components/Common/ActiveModelPicker';

const MODE_OPTIONS = [
  { value: 'default', labelKey: 'chat.mode.default', labelDefault: 'Approval Mode', icon: IconShieldCheck, color: 'blue' },
  { value: 'auto_edit', labelKey: 'chat.mode.autoEdit', labelDefault: 'AutoEdit', icon: IconBolt, color: 'teal' },
  { value: 'yolo', labelKey: 'chat.mode.yolo', labelDefault: 'YOLO', icon: IconFlame, color: 'red' },
];

function ModeSelector() {
  const { t } = useTranslation();
  const capabilities = useAgentStore((s) => s.capabilities);
  const status = useAgentStore((s) => s.status);
  const setCapabilities = useAgentStore((s) => s.setCapabilities);
  const currentMode = capabilities?.current_mode ?? 'default';

  const handleModeChange = async (mode: string) => {
    if (!mode) return;
    try {
      await invoke('set_mode', { mode });
      if (capabilities) {
        setCapabilities({ ...capabilities, current_mode: mode });
      }
    } catch (e) {
      console.error('set_mode error:', e);
    }
  };

  const activeOption = MODE_OPTIONS.find(o => o.value === currentMode) || MODE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;
  const activeLabel = activeOption.labelKey ? t(activeOption.labelKey, activeOption.labelDefault) : activeOption.labelDefault;

  if (status === 'disconnected' || status === 'error' || !capabilities) {
    return null;
  }

  return (
    <Menu shadow="md" width={140} position="top-end">
      <Menu.Target>
        <Tooltip label={`${t('chat.runningMode')}: ${activeLabel}`} withArrow>
          <ActionIcon size="md" variant="subtle" color={activeOption.color} radius="md">
            <ActiveIcon size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('chat.runningMode')}</Menu.Label>
        {MODE_OPTIONS.map(opt => {
          const label = opt.labelKey ? t(opt.labelKey, opt.labelDefault) : opt.labelDefault;
          return (
            <Menu.Item
              key={opt.value}
              leftSection={<opt.icon size={14} color={`var(--mantine-color-${opt.color}-5)`} />}
              onClick={() => handleModeChange(opt.value)}
              style={{ fontWeight: currentMode === opt.value ? 600 : 400 }}
            >
              {label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

export function AssistantChatInput() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const status = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const addUserMessage = useAgentStore((s) => s.addUserMessage);
  const setError = useAgentStore((s) => s.setError);
  const { activeWorkspaceId, activeConversationId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const isStreaming = status === 'thinking';
  const canSend = status === 'ready' && value.trim().length > 0 && !!activeWorkspaceId;

  const placeholder = !activeWorkspaceId
    ? t('chat.chooseWorkspace')
    : status === 'disconnected'
      ? t('chat.agentDisconnected')
      : status === 'connecting'
        ? t('chat.agentConnecting')
        : status === 'error'
          ? t('chat.agentConnectFailed')
          : isStreaming
            ? t('chat.agentThinking')
            : t('chat.inputPlaceholder');

  const handleSend = async () => {
    if (!canSend) return;
    const content = value.trim();
    const userUiId = `user-${uuidv4()}`;
    const streamMsgId = uuidv4();
    setValue('');
    addUserMessage(userUiId, content);

    const assistants = useWorkspaceStore.getState().conversationAssistants;
    const activeAsst = activeConversationId ? assistants[activeConversationId] : null;

    if (activeAsst && activeAsst.startsWith('workflow:')) {
      const workflowId = activeAsst.replace('workflow:', '');
      setStatus('thinking');
      try {
        await taskService.runWorkflow({
          workflowId,
          input: content,
          threadId: activeConversationId,
        });
      } catch (e: any) {
        setStatus('error');
        setError(e.message || String(e));
      }
      return;
    }

    try {
      await invoke('send_message', {
        sessionId: activeConversationId || null,
        msgId: streamMsgId,
        content
      });
    } catch (e: any) {
      console.error('send_message error:', e);
      setError(e.message || String(e));
    }
  };

  const handleStop = async () => {
    const assistants = useWorkspaceStore.getState().conversationAssistants;
    const activeAsst = activeConversationId ? assistants[activeConversationId] : null;

    const state = useAgentStore.getState();
    const lastMsg = state.messages[state.messages.length - 1];
    const activeMsgId = lastMsg && lastMsg.role === 'assistant' && lastMsg.streaming ? lastMsg.id : null;

    if (activeAsst && activeAsst.startsWith('workflow:')) {
      const workflowId = activeAsst.replace('workflow:', '');
      try {
        await taskService.stopWorkflow(workflowId);
        setStatus('ready');
        if (activeMsgId) {
          state.handleEvent({
            type: 'text_delta',
            msg_id: activeMsgId,
            text: t('chat.aborted', '\n\n*🚫 Dialogue aborted by user*'),
          });
          state.handleEvent({
            type: 'stream_end',
            msg_id: activeMsgId,
          });
        }
      } catch (e: any) {
        console.error('stop_workflow error:', e);
        setError(e.message || String(e));
      }
      return;
    }

    try {
      await taskService.stopAgent(activeConversationId || null);
      setStatus('ready');
      if (activeMsgId) {
        state.handleEvent({
          type: 'text_delta',
          msg_id: activeMsgId,
          text: t('chat.aborted', '\n\n*🚫 Dialogue aborted by user*'),
        });
        state.handleEvent({
          type: 'stream_end',
          msg_id: activeMsgId,
        });
      }
    } catch (e: any) {
      console.error('stop_agent error:', e);
      setError(e.message || String(e));
    }
  };

  return (
    <Box
      style={{
        background: 'var(--flock-bg-surface)',
        padding: '12px 16px 14px',
        flexShrink: 0,
      }}
    >
      {status === 'error' && (
        <Group gap={6} mb={8} justify="center">
          <Text size="xs" color="red" style={{ opacity: 0.8 }}>
            {t('chat.agentError')}
          </Text>
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '12px',
              color: 'var(--flock-accent)',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
            onClick={async () => {
              if (!activeWorkspaceId) return;
              const targetWs = workspaces.find(w => w.id === activeWorkspaceId);
              if (!targetWs) return;
              const assistants = useWorkspaceStore.getState().conversationAssistants;
              const assistantId = activeConversationId ? (assistants[activeConversationId] || null) : null;
              setStatus('connecting');
              try {
                await taskService.startAgent({
                  workdir: targetWs.path,
                  sessionId: activeConversationId || null,
                  assistantId: assistantId === '__xiaof__' ? null : assistantId,
                  projectDir: null,
                  apiKey: null,
                  extraArgs: null,
                });
                setStatus('ready');
              } catch (e: any) {
                setStatus('error');
                setError(String(e));
              }
            }}
          >
            {t('chat.retry')}
          </button>
        </Group>
      )}

      <ChatInput
        value={value}
        onChange={setValue}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={!activeWorkspaceId || status === 'disconnected' || status === 'connecting'}
        placeholder={placeholder}
        leftExtra={
          <>
            <ActiveModelPicker />
            {value.length > 0 ? (
              <Text size="xs" style={{ color: 'var(--flock-text-dim)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {value.length} {t('chat.characterCount')}
              </Text>
            ) : undefined}</>
        }
        rightExtra={
          <>
            {canSend && (
              <Text size="xs" style={{ color: 'var(--flock-text-dim)', opacity: 0.8, fontSize: 11, whiteSpace: 'nowrap' }}>
                {t('chat.enterToSend')}
              </Text>
            )}
            <ModeSelector />
          </>
        }
        sendLabel={canSend ? t('chat.sendEnter') : placeholder}
      />

      <Text size="xs" style={{ color: 'var(--flock-text-dim)', textAlign: 'center', opacity: 0.8, fontSize: 11 }} mt={6}>
        {t('chat.disclaimer')}
      </Text>
    </Box>
  );
}
