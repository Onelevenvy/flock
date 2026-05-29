import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node } from 'reactflow';
import { Box, Button, Group, ScrollArea, Stack, Text, Badge, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconPlayerStop, IconSend } from '@tabler/icons-react';
import { useWorkflowChatExecution } from '../../../../hooks/useWorkflowChatExecution';
import { ChatPanel } from '../../../../components/chat/ChatPanel';
import { StartParametersForm } from '../../../Workflow/components/ExecutionPanel/StartParametersForm';
import { HumanReviewCard } from '../../../Workflow/components/ExecutionPanel/HumanReviewCard';
import { useAgentStore } from '../../../../store/agentStore';
import { useUiStore } from '../../../../store/uiStore';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { ChatMessage } from '../../../../types/protocol';

interface WorkflowChatPanelProps {
  workflowId: string;
  workflowName: string;
  threadId: string;
  /** 初始 query（首页带过来的第一条消息） */
  initialQuery?: string;
  /** 工作流定义中的 start 节点变量（用于初始参数表单） */
  startVariables?: any[];
  /** ReactFlow nodes 用于解析友好名称（可以是空数组，名称降级到类型名） */
  nodes?: Node[];
}

export function WorkflowChatPanel({
  workflowId,
  workflowName,
  threadId,
  initialQuery,
  startVariables,
  nodes = [],
}: WorkflowChatPanelProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [activeInterrupt, setActiveInterrupt] = useState<any>(null);
  const [inputVal, setInputVal] = useState('');

  const agentMessages = useAgentStore((s) => s.messages);

  const startNode = nodes.find((n: any) => n.type === 'start');
  const vars = startVariables ?? (startNode?.data?.variables as any[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true }
  ];
  const customVars = vars.filter((v: any) => v.name !== 'query');

  const [formInputs, setFormInputs] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    vars.forEach((v) => {
      initial[v.name] = v.default_value ?? '';
    });
    setFormInputs(initial);
  }, [vars]);

  const currentAssistantMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentAssistantMsgIdRef.current = null;
  }, [threadId]);

  const appendMessage = useCallback((msg: any) => {
    const now = Date.now();

    if (msg.type === 'user') {
      const newUserMsg: ChatMessage = {
        id: `user-${now}`,
        role: 'user',
        chunks: [{ kind: 'text', text: msg.content }],
        streaming: false,
        timestamp: msg.timestamp || now,
      };
      currentAssistantMsgIdRef.current = null;
      useAgentStore.setState((s) => ({
        messages: [...s.messages, newUserMsg],
      }));
    } else if (msg.type === 'info' || msg.type === 'text_delta' || msg.type === 'thinking') {
      let runId = currentAssistantMsgIdRef.current;
      const existingMessages = [...useAgentStore.getState().messages];
      let assistantMsg = runId ? existingMessages.find((m) => m.id === runId) : null;

      if (!assistantMsg) {
        runId = `assistant-wf-${now}`;
        currentAssistantMsgIdRef.current = runId;
        assistantMsg = {
          id: runId,
          role: 'assistant',
          chunks: [],
          streaming: true,
          timestamp: msg.timestamp || now,
        };
        existingMessages.push(assistantMsg);
      }

      const chunks = [...assistantMsg.chunks];

      if (msg.type === 'info') {
        chunks.push({ kind: 'info', message: msg.content });
      } else if (msg.type === 'text_delta') {
        const last = chunks[chunks.length - 1];
        if (last && last.kind === 'text') {
          chunks[chunks.length - 1] = { kind: 'text', text: last.text + msg.content };
        } else {
          chunks.push({ kind: 'text', text: msg.content });
        }
      } else if (msg.type === 'thinking') {
        const last = chunks[chunks.length - 1];
        if (last && last.kind === 'thinking') {
          chunks[chunks.length - 1] = { kind: 'thinking', text: last.text + msg.content, collapsed: last.collapsed };
        } else {
          chunks.push({ kind: 'thinking', text: msg.content, collapsed: false });
        }
      }

      const updatedMessages = existingMessages.map((m) =>
        m.id === runId ? { ...m, chunks } : m
      );
      useAgentStore.setState({ messages: updatedMessages });
    } else if (msg.type === 'done' || msg.type === 'error') {
      const runId = currentAssistantMsgIdRef.current;
      if (runId) {
        useAgentStore.setState((s) => ({
          messages: s.messages.map((m) =>
            m.id === runId
              ? {
                  ...m,
                  streaming: false,
                  chunks: m.chunks.map((c) =>
                    c.kind === 'thinking' ? { ...c, collapsed: true } : c
                  ),
                }
              : m
          ),
        }));
      }
      currentAssistantMsgIdRef.current = null;
    }
  }, []);

  const { startWorkflow, resumeWorkflow, stopWorkflow } = useWorkflowChatExecution({
    workflowId,
    threadId,
    onMessage: appendMessage,
    onStatusChange: setStatus,
    onInterrupt: setActiveInterrupt,
  });

  const handleClearExecution = useCallback(() => {
    useAgentStore.getState().clearMessages();
    setStatus('idle');
    setActiveInterrupt(null);
  }, []);

  // 首页带来的初始 query：在组件挂载后立即执行（优先用 pendingStartQuery，再用 initialQuery prop）
  const pendingStartQuery = useWorkflowStore((s) => s.pendingStartQuery);
  const initialQueryFiredRef = useRef(false);

  useEffect(() => {
    const q = pendingStartQuery ?? initialQuery;
    if (q && !initialQueryFiredRef.current && status === 'idle' && agentMessages.length === 0) {
      initialQueryFiredRef.current = true;
      useWorkflowStore.getState().setPendingStartQuery(null);

      const hasCustomVars = customVars.length > 0;
      if (hasCustomVars) {
        setInputVal(q);
        setFormInputs((prev) => ({ ...prev, query: q }));
      } else {
        const payload: Record<string, any> = { ...formInputs };
        payload['query'] = q;
        startWorkflow(JSON.stringify(payload));
        setInputVal('');
      }
    }
  }, [pendingStartQuery, initialQuery, status, agentMessages.length, customVars.length, formInputs, startWorkflow]);

  const handleStart = () => {
    const missing = customVars.filter((v: any) => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === ''));
    if (missing.length > 0) {
      alert(t('workflow.execution.missingParams', {
        defaultValue: `Missing required parameter(s): ${missing.map((m: any) => m.label || m.name).join(', ')}`,
        names: missing.map((m: any) => m.label || m.name).join(', ')
      }));
      return;
    }
    const payload: Record<string, any> = { ...formInputs };
    payload['query'] = inputVal;
    startWorkflow(JSON.stringify(payload));
    setInputVal('');
  };

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : activeInterrupt !== null ? 'orange'
    : 'gray';

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--flock-bg-base)',
      }}
    >
      {/* Panel header */}
      <Group
        px="sm"
        justify="space-between"
        style={{
          height: 48,
          flexShrink: 0,
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        <Group gap="xs">
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)' }}>
            ⚡ {workflowName || t('workflow.execution.title', 'Execution Output')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {activeInterrupt !== null
              ? t('workflow.execution.waiting', 'WAITING')
              : t(`workflow.execution.${status}`, status.toUpperCase())}
          </Badge>
        </Group>

        <Group gap="xs">
          {status !== 'running' && activeInterrupt === null && agentMessages.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={handleClearExecution}
              style={{ height: 24, fontSize: 10, padding: '0 8px' }}
            >
              {t('workflow.execution.newChat', 'New Chat')}
            </Button>
          )}
          {status === 'running' && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconPlayerStop size={12} />}
              onClick={stopWorkflow}
              style={{ height: 24, fontSize: 10, padding: '0 8px' }}
            >
              {t('common.stop', 'Stop')}
            </Button>
          )}
        </Group>
      </Group>

      {/* Main content */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'var(--flock-bg-base)',
        }}
      >
        {agentMessages.length === 0 && customVars.length > 0 ? (
          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="md" style={{ padding: 12 }}>
              <Box>
                <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                  ✨ {t('workflow.execution.inputsTitle', 'Start Parameters')}
                </Text>
                <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                  {t('workflow.execution.inputsDesc', 'Please configure initial parameters for the workflow before running.')}
                </Text>
              </Box>
              <StartParametersForm
                customVars={customVars}
                formInputs={formInputs}
                setFormInputs={setFormInputs}
              />
            </Stack>
          </ScrollArea>
        ) : (
          <ChatPanel messages={agentMessages} />
        )}

        {/* Human review card */}
        {activeInterrupt && (
          <Box px="md" py="sm" style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
            <HumanReviewCard
              interruptData={activeInterrupt}
              onResume={(choice: string, feedback?: string) => {
                const choiceText = feedback ? `Choice: ${choice}\nFeedback: ${feedback}` : `Choice: ${choice}`;
                const newUserMsg: ChatMessage = {
                  id: `user-choice-${Date.now()}`,
                  role: 'user',
                  chunks: [{ kind: 'text', text: choiceText }],
                  streaming: false,
                  timestamp: Date.now(),
                };
                useAgentStore.setState((s) => ({
                  messages: [...s.messages, newUserMsg],
                }));
                resumeWorkflow({ choice, feedback });
                setActiveInterrupt(null);
              }}
              isDark={isDark}
              isResolved={false}
              displayName={t('workflow.execution.waiting', 'WAITING')}
            />
          </Box>
        )}

        {/* Bottom input area */}
        <Box p="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
          {activeInterrupt !== null ? (
            <Text size="xs" c="dimmed" ta="center" style={{ padding: '4px 0' }}>
              ⏳ {t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
            </Text>
          ) : (
            <Group gap="xs">
              <TextInput
                placeholder={t('workflow.execution.inputPlaceholder', 'Enter initial query...')}
                size="xs"
                value={inputVal}
                onChange={(e) => setInputVal(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStart();
                }}
                disabled={status === 'running'}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: 'var(--flock-bg-base)',
                    borderColor: 'var(--flock-border-dim)',
                  }
                }}
              />
              <Button
                size="xs"
                color="blue"
                onClick={handleStart}
                disabled={!inputVal.trim() || status === 'running'}
                leftSection={<IconSend size={12} />}
              >
                {t('workflow.execution.run', 'Send')}
              </Button>
            </Group>
          )}
        </Box>
      </Box>
    </Box>
  );
}
