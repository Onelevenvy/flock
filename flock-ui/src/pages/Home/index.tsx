import { useState, useCallback, useRef, KeyboardEvent, useEffect } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Textarea,
  Menu,
} from '@mantine/core';
import {
  IconSend,
  IconPlayerStop,
  IconShieldCheck,
  IconBolt,
  IconFlame,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { useAgentStore } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkspacesQuery, useCreateConversationMutation } from '../../hooks/useWorkspaces';
import { type Assistant } from '../../types/assistant';
import { ModelSelector } from '../../components/Settings/ModelSelector';
import { AssistantPicker, XIAOF_AGENT } from './AssistantPicker';
import { WorkspacePicker } from './WorkspacePicker';
import { useAssistantsQuery } from '../../hooks/useAssistants';
import { useTranslation } from 'react-i18next';

export function HomeView() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant>(XIAOF_AGENT);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const status = useAgentStore(s => s.status);
  const addUserMessage = useAgentStore(s => s.addUserMessage);
  const setWorkdir = useAgentStore(s => s.setWorkdir);
  const setStatus = useAgentStore(s => s.setStatus);
  const clearMessages = useAgentStore(s => s.clearMessages);
  const capabilities = useAgentStore(s => s.capabilities);
  const setCapabilities = useAgentStore(s => s.setCapabilities);
  const setError = useAgentStore(s => s.setError);

  const {
    activeWorkspaceId, activeConversationId,
    setActiveWorkspace, setActiveConversation,
    conversationAssistants, setConversationAssistant,
    selectedHomeAssistantId, setSelectedHomeAssistantId,
  } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { mutateAsync: createConversation } = useCreateConversationMutation();
  const { data: assistants = [] } = useAssistantsQuery();

  const MODE_OPTIONS = [
    { value: 'default', label: t('home.approval'), icon: IconShieldCheck, color: 'indigo' },
    { value: 'auto_edit', label: 'AutoEdit', icon: IconBolt, color: 'teal' },
    { value: 'yolo', label: 'YOLO', icon: IconFlame, color: 'red' },
  ];

  // 🚀 Sync the selectedAssistant state with the persisted assistant for the active conversation or direct jump selection
  useEffect(() => {
    const allAgents = [XIAOF_AGENT, ...assistants];
    if (selectedHomeAssistantId) {
      const match = allAgents.find(a => a.id === selectedHomeAssistantId);
      if (match) {
        setSelectedAssistant(match);
        // Clear it so it won't keep resetting on subsequent renders
        setSelectedHomeAssistantId(null);
      }
    } else if (activeConversationId) {
      const persistedAsstId = conversationAssistants[activeConversationId];
      if (persistedAsstId) {
        const match = allAgents.find(a => a.id === persistedAsstId);
        if (match && match.id !== selectedAssistant.id) {
          setSelectedAssistant(match);
        }
      }
    }
  }, [selectedHomeAssistantId, activeConversationId, conversationAssistants, selectedAssistant.id, assistants, setSelectedHomeAssistantId]);

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const isStreaming = !!activeConversationId && status === 'thinking';
  const canSend = (status === 'ready' || (status === 'thinking' && !activeConversationId)) && value.trim().length > 0 && !!activeWorkspaceId;



  const placeholder = !activeWorkspaceId
    ? t('home.selectWorkspaceFirst')
    : isStreaming
    ? t('home.thinking')
    : t('home.sendMessage', { name: selectedAssistant.name });

  const handleSelectWorkspace = useCallback(async (wsId: string, wsPath: string, _wsName: string) => {
    if (wsId !== activeWorkspaceId) {
      setActiveWorkspace(wsId);
    }
    setWorkdir(wsPath);
    setStatus('connecting');
    try {
      // Start agent for this workspace (will resume or create)
      await invoke('start_agent', {
        workdir: wsPath,
        sessionId: activeConversationId || null,
        assistantId: selectedAssistant.id === '__xiaof__' ? null : selectedAssistant.id,
        projectDir: null,
        apiKey: null,
        extraArgs: null,
      });
      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      useAgentStore.getState().setError(String(e));
    }
  }, [activeWorkspaceId, selectedAssistant, activeConversationId, setActiveWorkspace, setWorkdir, setStatus]);

  const handleAssistantSelect = useCallback(async (a: Assistant) => {
    setSelectedAssistant(a);
    if (activeConversationId) {
      setConversationAssistant(activeConversationId, a.id);
    }
    // If workspace already active, restart agent with new assistant
    if (activeWs && status === 'ready') {
      setStatus('connecting');
      try {
        await invoke('start_agent', {
          workdir: activeWs.path,
          sessionId: activeConversationId || null,
          assistantId: a.id === '__xiaof__' ? null : a.id,
          projectDir: null,
          apiKey: null,
          extraArgs: null,
        });
        setStatus('ready');
      } catch (e: any) {
        setStatus('error');
      }
    }
  }, [activeWs, status, activeConversationId, setConversationAssistant, setStatus]);

  const handleSend = async () => {
    if (!canSend || !activeWs) return;
    const content = value.trim();
    
    let convId = activeConversationId;
    
    // 如果当前没有激活的对话，先创建一个
    if (!convId) {
      try {
        setStatus('connecting');
        const conv = await createConversation({ workspaceId: activeWorkspaceId!, title: '' });
        convId = conv.id;
        setActiveConversation(convId);
        clearMessages();
        
        // 🚀 Save the chosen assistant to the conversation map!
        setConversationAssistant(convId, selectedAssistant.id);

        // 启动 Agent 并绑定当前选择的助手
        await invoke('start_agent', {
          workdir: activeWs.path,
          sessionId: convId,
          assistantId: selectedAssistant.id === '__xiaof__' ? null : selectedAssistant.id,
          projectDir: null,
          apiKey: null,
          extraArgs: null,
        });
        setStatus('ready');
      } catch (e: any) {
        setStatus('error');
        console.error('Failed to start conversation:', e);
        return;
      }
    }

    const userUiId = `user-${uuidv4()}`;
    const streamMsgId = uuidv4();
    setValue('');
    addUserMessage(userUiId, content);
    try {
      await invoke('send_message', { 
        sessionId: convId || null, 
        msgId: streamMsgId, 
        content 
      });
    } catch (e: any) {
      console.error('send_message error:', e);
      setError(e.message || String(e));
    }
  };

  const handleStop = async () => {
    try { 
      await invoke('stop_agent', { sessionId: activeConversationId || null }); 
    } catch (e: any) { 
      console.error(e); 
      setError(e.message || String(e));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleModeChange = async (mode: string) => {
    try {
      await invoke('set_mode', { mode });
      if (capabilities) setCapabilities({ ...capabilities, current_mode: mode });
    } catch (e) { console.error(e); }
  };

  const currentMode = capabilities?.current_mode ?? 'default';
  const activeOption = MODE_OPTIONS.find(o => o.value === currentMode) || MODE_OPTIONS[0];
  const ActiveModeIcon = activeOption.icon;

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        minWidth: 0,
        padding: '24px 32px',
        gap: 0,
      }}
    >
      {/* 欢迎语 */}
      <Text
        fw={700}
        style={{
          fontSize: 28,
          color: 'var(--flock-text-bright)',
          marginBottom: 24,
          letterSpacing: '-0.5px',
        }}
      >
        {t('home.welcome')}
      </Text>

      {/* 助手选择器 */}
      <Box mb={16} style={{ width: '100%', maxWidth: 680 }}>
        <AssistantPicker selected={selectedAssistant} onSelect={handleAssistantSelect} />
      </Box>

      {/* 输入框卡片 */}
      <Box
        style={{
          width: '100%',
          maxWidth: 680,
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-base)',
          borderRadius: 16,
          padding: '12px 14px 10px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
        className="home-input-card"
      >
        {/* 文本输入 */}
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={!activeWorkspaceId || status === 'connecting'}
          autosize
          minRows={2}
          maxRows={10}
          styles={{
            input: {
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--flock-text-primary)',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              boxShadow: 'none',
            },
          }}
        />

        {/* 底部工具栏 */}
        <Group justify="space-between" mt={10}>
          {/* 左侧：工作区 + 模型 */}
          <Group gap={8} wrap="nowrap">
            <WorkspacePicker onSelect={handleSelectWorkspace} />
            <ModelSelector />
          </Group>

          {/* 右侧：模式 + 发送 */}
          <Group gap={6} wrap="nowrap">
            {/* 审批模式 */}
            {status === 'ready' && capabilities && (
              <Menu shadow="md" width={140} position="top-end">
                <Menu.Target>
                  <Tooltip label={`${t('home.runMode')}: ${activeOption.label}`} withArrow>
                    <ActionIcon size="sm" variant="subtle" color={activeOption.color} radius="md">
                      <ActiveModeIcon size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('home.runMode')}</Menu.Label>
                  {MODE_OPTIONS.map(opt => (
                    <Menu.Item
                      key={opt.value}
                      leftSection={<opt.icon size={13} color={`var(--mantine-color-${opt.color}-5)`} />}
                      onClick={() => handleModeChange(opt.value)}
                      style={{ fontWeight: currentMode === opt.value ? 600 : 400 }}
                    >
                      {opt.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}

            {isStreaming ? (
              <Tooltip label={t('home.stopGeneration', { defaultValue: '停止生成' })} withArrow>
                <ActionIcon size="md" color="red" variant="light" radius="xl" onClick={handleStop}>
                  <IconPlayerStop size={15} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label={canSend ? t('home.sendEnter') : !activeWorkspaceId ? t('home.pleaseSelectWorkspace') : t('home.sendMessagePlaceholder')} withArrow>
                <ActionIcon
                  size="md"
                  color="indigo"
                  variant={canSend ? 'filled' : 'subtle'}
                  radius="xl"
                  onClick={handleSend}
                  disabled={!canSend}
                  style={{
                    background: canSend ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : undefined,
                    boxShadow: canSend ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <IconSend size={15} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Box>

      {/* 状态提示 */}
      {status === 'connecting' && (
        <Text size="xs" c="dimmed" mt={12} style={{ opacity: 0.6 }}>
          {t('home.connectingAgent', { name: selectedAssistant.name })}
        </Text>
      )}
      {status === 'error' && (
        <Group gap={6} mt={12}>
          <Text size="xs" color="red" style={{ opacity: 0.8 }}>
            Agent 连接失败
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
              if (!activeWorkspaceId || !activeWs) return;
              setStatus('connecting');
              try {
                await invoke('start_agent', {
                  workdir: activeWs.path,
                  sessionId: activeConversationId || null,
                  assistantId: selectedAssistant.id === '__xiaof__' ? null : selectedAssistant.id,
                  projectDir: null,
                  apiKey: null,
                  extraArgs: null,
                });
                setStatus('ready');
              } catch (e: any) {
                setStatus('error');
                useAgentStore.getState().setError(String(e));
              }
            }}
          >
            点击重试
          </button>
        </Group>
      )}
      {status === 'ready' && activeWs && (
        <Text size="xs" c="dimmed" mt={10} style={{ opacity: 0.45, fontSize: 11 }}>
          {t('home.disclaimer', { name: selectedAssistant.name, workspace: activeWs.name })}
        </Text>
      )}
      {!activeWorkspaceId && (
        <Text size="xs" c="dimmed" mt={10} style={{ opacity: 0.5 }}>
          {t('home.startDialogHelp')}
        </Text>
      )}
    </Box>
  );
}
