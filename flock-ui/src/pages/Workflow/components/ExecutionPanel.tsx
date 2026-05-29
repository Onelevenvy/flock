import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Badge,
  TextInput,
  Button,
  Modal,
  NumberInput,
  Switch,
  Select,
  Stack,
  Textarea,
  ScrollArea,
  Input,
} from '@mantine/core';
import {
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconSend,
  IconPlus,
  IconUser,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../../../components/chat/ChatPanel';
import { ChatMessage } from '../../../types/protocol';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useUiStore } from '../../../store/uiStore';

export interface ExecutionMessage {
  type: 'user' | 'text_delta' | 'thinking' | 'info' | 'error' | 'done';
  content: string;
  nodeId?: string;
  timestamp: number;
}

interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: ExecutionMessage[];
  onClose: () => void;
  startWorkflow: (input: string) => Promise<void>;
  stopWorkflow: () => Promise<void>;
  resumeWorkflow: (choiceValue: unknown) => Promise<void>;
}

export function ExecutionPanel({
  status,
  messages,
  onClose,
  startWorkflow,
  stopWorkflow,
  resumeWorkflow,
}: ExecutionPanelProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { clearExecution } = useWorkflowStore();
  const [inputVal, setInputVal] = useState('');
  const [feedback, setFeedback] = useState('');

  const startNode = useWorkflowStore((s) => s.nodes.find((n) => n.type === 'start'));
  const startVariables = (startNode?.data?.variables as any[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true }
  ];

  const [formInputs, setFormInputs] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    startVariables.forEach((v) => {
      initial[v.name] = v.default_value ?? '';
    });
    setFormInputs(initial);
  }, [startVariables]);

  // 1. 转换并聚合出 ChatPanel 可识别的 ChatMessage 数组
  const chatMessages = useMemo<ChatMessage[]>(() => {
    const result: ChatMessage[] = [];

    // 按节点流式聚合所有的 text_delta 和 thinking，以及随时压入 user 消息
    let currentAssistantMsg: ChatMessage | null = null;

    for (const msg of messages) {
      if (msg.type === 'user') {
        // 先把之前的助理消息压入
        if (currentAssistantMsg) {
          result.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        // 压入用户消息
        result.push({
          id: `user-${msg.timestamp}`,
          role: 'user',
          chunks: [{ kind: 'text', text: msg.content }],
          streaming: false,
          timestamp: msg.timestamp,
        });
      } else if (msg.type === 'text_delta' || msg.type === 'thinking') {
        const nodeId = msg.nodeId || 'assistant';
        const displayNodeName = `**[${nodeId}]**\n`;

        // 如果还没有当前正在构建的 assistant 消息，或者虽然有则 nodeId 发生变化，开启新消息
        if (!currentAssistantMsg || currentAssistantMsg.id !== `assistant-${nodeId}`) {
          if (currentAssistantMsg) {
            currentAssistantMsg.streaming = false;
            result.push(currentAssistantMsg);
          }
          currentAssistantMsg = {
            id: `assistant-${nodeId}`,
            role: 'assistant',
            chunks: [],
            streaming: status === 'running',
            timestamp: msg.timestamp,
          };
        }

        if (msg.type === 'thinking') {
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'thinking') {
            lastChunk = {
              kind: 'thinking',
              text: msg.content,
              collapsed: false,
            };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        } else {
          // text_delta
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'text') {
            const prefix = currentAssistantMsg.chunks.length === 0 ? displayNodeName : '';
            lastChunk = {
              kind: 'text',
              text: prefix + msg.content,
            };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        }
      }
    }

    if (currentAssistantMsg) {
      if (status !== 'running') {
        currentAssistantMsg.streaming = false;
      }
      result.push(currentAssistantMsg);
    }

    return result;
  }, [messages, status]);

  const activeInterrupt = useWorkflowStore((s) => s.activeInterrupt);
  const isInterrupted = activeInterrupt !== null;

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : isInterrupted ? 'orange'
    : 'gray';

  const customVars = startVariables.filter(v => v.name !== 'query');

  // 中断后清空 feedback
  useEffect(() => {
    if (activeInterrupt) setFeedback('');
  }, [activeInterrupt]);

  const handleResume = useCallback((choiceKey: string) => {
    const payload: Record<string, unknown> = { choice: choiceKey };
    if (activeInterrupt?.enable_feedback && feedback.trim()) {
      payload.feedback = feedback.trim();
    }
    resumeWorkflow(payload);
    setFeedback('');
  }, [activeInterrupt, feedback, resumeWorkflow]);

  // 键盘快捷键：数字键快速选择 action
  useEffect(() => {
    if (!isInterrupted || !activeInterrupt?.actions) return;
    const actions = activeInterrupt.actions as { key: string; label: string }[];
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const idx = parseInt(e.key) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < actions.length) {
        e.preventDefault();
        handleResume(actions[idx].key);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isInterrupted, activeInterrupt, handleResume]);

  const handleStart = () => {
    // Validate required fields
    const missing = customVars.filter(v => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === ''));
    if (missing.length > 0) {
      alert(t('workflow.execution.missingParams', { 
        defaultValue: `Missing required parameter(s): ${missing.map(m => m.label || m.name).join(', ')}`,
        names: missing.map(m => m.label || m.name).join(', ')
      }));
      return;
    }

    const payload: Record<string, any> = { ...formInputs };
    payload['query'] = inputVal;
    startWorkflow(JSON.stringify(payload));
    setInputVal('');
  };

  return (
    <Box
      style={{
        borderLeft: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-deepest)',
        width: 380, // 完美的右侧栏宽度
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.08)',
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
          <IconTerminal2 size={14} style={{ color: 'var(--flock-text-muted)' }} />
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.03em' }}>
            {t('workflow.execution.title', 'Execution Output')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {isInterrupted
              ? t('workflow.execution.waiting', 'WAITING')
              : t(`workflow.execution.${status}`, status.toUpperCase())}
          </Badge>
        </Group>

        <Group gap="xs">
          {status !== 'running' && messages.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={clearExecution}
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
          <ActionIcon variant="subtle" size="xs" color="gray" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Main chat layout - occupies 100% space */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--flock-bg-base)',
          minHeight: 0,
        }}
      >
        <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {chatMessages.length === 0 ? (
            customVars.length > 0 ? (
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
                  
                  <Stack gap="sm" style={{ background: 'var(--flock-bg-surface)', padding: 12, borderRadius: 12, border: '1px solid var(--flock-border-subtle)' }}>
                    {customVars.map((v) => {
                      const label = `${v.label || v.name} (${v.name})`;
                      const required = v.required;
                      if (v.type === 'boolean') {
                        return (
                          <Switch
                            key={v.name}
                            label={label}
                            checked={!!formInputs[v.name]}
                            onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.currentTarget.checked })}
                            size="xs"
                          />
                        );
                      }
                      if (v.type === 'paragraph') {
                        return (
                          <Textarea
                            key={v.name}
                            label={label}
                            placeholder={v.default_value ?? ''}
                            value={formInputs[v.name] ?? ''}
                            onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
                            size="xs"
                            minRows={2}
                            required={required}
                          />
                        );
                      }
                      if (v.type === 'select') {
                        const selectOptions = (v.options as string[]) ?? [];
                        return (
                          <Select
                            key={v.name}
                            label={label}
                            placeholder={v.default_value ?? ''}
                            data={selectOptions.map((o) => ({ value: o, label: o }))}
                            value={formInputs[v.name] ?? ''}
                            onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val })}
                            size="xs"
                            required={required}
                            clearable
                          />
                        );
                      }
                      if (v.type === 'number') {
                        return (
                          <NumberInput
                            key={v.name}
                            label={label}
                            placeholder={String(v.default_value ?? '')}
                            value={formInputs[v.name]}
                            onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val !== '' && val !== undefined ? Number(val) : undefined })}
                            size="xs"
                            required={required}
                          />
                        );
                      }
                      return (
                        <TextInput
                          key={v.name}
                          label={label}
                          placeholder={v.default_value ?? ''}
                          value={formInputs[v.name] ?? ''}
                          onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
                          size="xs"
                          required={required}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </ScrollArea>
            ) : (
              <Box
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  padding: 20,
                }}
              >
                <Text size="xs" c="dimmed" ta="center">
                  🤖 {t('workflow.execution.noOutput', 'No active execution. Enter initial query below to run.')}
                </Text>
              </Box>
            )
          ) : (
            <ChatPanel messages={chatMessages} />
          )}
        </Box>

        {/* Chat Input Area */}
        <Box p="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
          {isInterrupted ? (
            <Box
              style={{
                borderRadius: 10,
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              {/* 标题行 */}
              <Box
                style={{
                  padding: '8px 12px',
                  background: 'var(--flock-bg-surface)',
                  borderBottom: '1px solid var(--flock-border-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconUser size={13} style={{ color: 'var(--flock-accent)' }} />
                <Text size="xs" fw={600} c={isDark ? 'orange.3' : 'orange.8'}>
                  {activeInterrupt?.title || t('workflow.execution.humanReview', 'Human Review Required')}
                </Text>
              </Box>

              {/* 操作区 */}
              <Box
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {/* Action 按钮列表 */}
                {Array.isArray(activeInterrupt?.actions) && activeInterrupt.actions.length > 0 ? (
                  activeInterrupt.actions.map((act: any, idx: number) => {
                    const colors = ['teal', 'blue', 'violet', 'grape', 'pink', 'red'];
                    const color = colors[idx % colors.length];
                    return (
                      <Group
                        key={act.key}
                        gap={6}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleResume(act.key)}
                        className="approval-btn"
                      >
                        <Box
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: 'var(--flock-bg-surface)',
                            border: '1px solid var(--flock-border-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Text size="xs" fw={700} style={{ fontSize: 10 }}>{idx + 1}</Text>
                        </Box>
                        <Text size="xs" c={isDark ? `${color}.4` : `${color}.8`} fw={600}>
                          {act.label || act.key}
                        </Text>
                      </Group>
                    );
                  })
                ) : (
                  <Group gap={6} style={{ cursor: 'pointer' }} onClick={() => handleResume('approved')} className="approval-btn">
                    <Box style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text size="xs" fw={700} style={{ fontSize: 10 }}>1</Text>
                    </Box>
                    <Text size="xs" c={isDark ? 'teal.4' : 'teal.8'} fw={600}>
                      {t('workflow.execution.approve', 'Approve')}
                    </Text>
                  </Group>
                )}

                {/* 补充信息输入框（enable_feedback 时显示） */}
                {activeInterrupt?.enable_feedback && (
                  <Input
                    placeholder={t('workflow.execution.feedbackPlaceholder', 'Add optional comment (Enter to skip)...')}
                    value={feedback}
                    onChange={(e) => setFeedback(e.currentTarget.value)}
                    size="xs"
                    mt={2}
                    styles={{
                      input: {
                        height: 26,
                        fontSize: '11px',
                        backgroundColor: 'var(--flock-bg-deepest)',
                        border: '1px solid var(--flock-border-dim)',
                        color: 'var(--flock-text-primary)',
                        borderRadius: '4px',
                      },
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        // Enter 在输入框里代表确认选第一个 action
                        const acts = activeInterrupt?.actions as { key: string }[] | undefined;
                        if (acts && acts.length > 0) handleResume(acts[0].key);
                      }
                    }}
                  />
                )}
              </Box>
            </Box>
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
