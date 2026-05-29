import { useState, useCallback, useRef, KeyboardEvent, useEffect } from 'react';
import { Box } from '@mantine/core';
import { IconShieldCheck, IconBolt, IconFlame, } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { useAgentStore } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkspacesQuery, useCreateConversationMutation } from '../../hooks/useWorkspaces';
import { type Assistant } from '../../types/assistant';

import { AssistantPicker, XIAOF_AGENT } from './AssistantPicker';
import { useUiStore } from '../../store/uiStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { useWorkflowsQuery, type WorkflowRecord } from '../../hooks/useWorkflow';

import { useAssistantsQuery } from '../../hooks/useAssistants';
import { useTranslation } from 'react-i18next';
import { WelcomeHeader } from './components/WelcomeHeader';
import { InputCard } from './components/InputCard';
import { StatusIndicator } from './components/StatusIndicator';

export function HomeView() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [selectedType, setSelectedType] = useState<'assistant' | 'workflow'>('assistant');
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant>(XIAOF_AGENT);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRecord | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const status = useAgentStore(s => s.status);
  const addUserMessage = useAgentStore(s => s.addUserMessage);
  const setWorkdir = useAgentStore(s => s.setWorkdir);
  const setStatus = useAgentStore(s => s.setStatus);
  const clearMessages = useAgentStore(s => s.clearMessages);
  const messages = useAgentStore(s => s.messages);
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
  const { data: workflows = [] } = useWorkflowsQuery();

  const MODE_OPTIONS = [
    { value: 'default', label: t('home.approval'), icon: IconShieldCheck, color: 'blue' },
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

  // Synchronize default workflow when workflows load
  useEffect(() => {
    if (selectedType === 'workflow' && !selectedWorkflow && workflows.length > 0) {
      setSelectedWorkflow(workflows[0]);
    }
  }, [selectedType, selectedWorkflow, workflows]);

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const isStreaming = !!activeConversationId && status === 'thinking';
  const canSend = (status === 'ready' || (status === 'thinking' && !activeConversationId) || selectedType === 'workflow') && value.trim().length > 0 && !!activeWorkspaceId;



  const placeholder = !activeWorkspaceId
    ? t('home.selectWorkspaceFirst')
    : isStreaming
      ? t('home.thinking')
      : selectedType === 'workflow'
        ? t('home.sendMessage', { name: selectedWorkflow?.name ?? '' })
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

  const handlePickerSelect = useCallback(async (type: 'assistant' | 'workflow', id: string, item: Assistant | WorkflowRecord | null) => {
    setSelectedType(type);
    if (type === 'assistant' && item) {
      const assistantItem = item as Assistant;
      setSelectedAssistant(assistantItem);
      if (activeConversationId) {
        setConversationAssistant(activeConversationId, assistantItem.id);
      }
      // If workspace already active, restart agent with new assistant
      if (activeWs && status === 'ready') {
        setStatus('connecting');
        try {
          await invoke('start_agent', {
            workdir: activeWs.path,
            sessionId: activeConversationId || null,
            assistantId: assistantItem.id === '__xiaof__' ? null : assistantItem.id,
            projectDir: null,
            apiKey: null,
            extraArgs: null,
          });
          setStatus('ready');
        } catch (e: any) {
          setStatus('error');
        }
      }
    } else if (type === 'workflow') {
      setSelectedWorkflow(item as WorkflowRecord);
    }
  }, [activeWs, status, activeConversationId, setConversationAssistant, setStatus]);
  const handleSend = async () => {
    if (!canSend || !activeWs) return;
    const content = value.trim();

    let convId = activeConversationId;
    const isNewOrEmpty = !convId || messages.length === 0;

    if (selectedType === 'workflow' && selectedWorkflow) {
      try {
        setStatus('connecting');
        if (!convId || isNewOrEmpty) {
          const conv = await createConversation({ workspaceId: activeWorkspaceId!, title: '' });
          convId = conv.id;
          setActiveConversation(convId);
        }
        clearMessages();

        // Save workflow as the active assistant for this conversation
        setConversationAssistant(convId, `workflow:${selectedWorkflow.id}`);
        setStatus('thinking');

        const userUiId = `user-${uuidv4()}`;
        setValue('');
        addUserMessage(userUiId, content);

        await invoke('run_workflow', {
          workflowId: selectedWorkflow.id,
          input: content,
          threadId: convId,
        });
      } catch (e: any) {
        setStatus('error');
        setError(e.message || String(e));
      }
      return;
    }

    // 如果当前是没有消息的新对话，先进行创建（如果需要）并初始化 Agent
    if (isNewOrEmpty) {
      try {
        setStatus('connecting');
        if (!convId) {
          const conv = await createConversation({ workspaceId: activeWorkspaceId!, title: '' });
          convId = conv.id;
          setActiveConversation(convId);
        }
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

  const handleRetry = async () => {
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
  };

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
      <WelcomeHeader t={t} />

      {/* 助手选择器 */}
      <Box mb={16} style={{ width: '100%', maxWidth: 680 }}>
        <AssistantPicker
          selectedType={selectedType}
          selectedId={selectedType === 'assistant' ? selectedAssistant.id : (selectedWorkflow?.id ?? '')}
          onSelect={handlePickerSelect}
        />
      </Box>

      {/* 输入框卡片 */}
      <InputCard
        t={t}
        textareaRef={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={setValue}
        onKeyDown={handleKeyDown}
        disabled={!activeWorkspaceId || status === 'connecting'}
        activeWorkspaceId={activeWorkspaceId}
        status={status}
        capabilities={capabilities}
        currentMode={currentMode}
        activeOption={activeOption}
        modeOptions={MODE_OPTIONS}
        onModeChange={handleModeChange}
        isStreaming={isStreaming}
        canSend={canSend}
        onSend={handleSend}
        onStop={handleStop}
        onSelectWorkspace={handleSelectWorkspace}
      />

      {/* 状态提示 */}
      <StatusIndicator
        t={t as any}
        status={status}
        selectedAssistant={selectedAssistant}
        activeWs={activeWs}
        activeWorkspaceId={activeWorkspaceId}
        onRetry={handleRetry}
      />
    </Box>
  );
}
