import { useState, useMemo, useEffect } from 'react';
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
} from '@mantine/core';
import {
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconCheck,
  IconSend,
  IconPlus,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../../../components/chat/ChatPanel';
import { ChatMessage } from '../../../types/protocol';
import { useWorkflowStore } from '../../../store/workflowStore';

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
  const { clearExecution } = useWorkflowStore();
  const [inputVal, setInputVal] = useState('');

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

  const isInterrupted =
    messages.length > 0 &&
    (messages[messages.length - 1].content.includes('⏳ 正在等待人工确认') ||
     messages[messages.length - 1].content.includes('⏳ Waiting for human review'));

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : 'gray';

  const activeInterrupt = useWorkflowStore((s) => s.activeInterrupt);
  const customVars = startVariables.filter(v => v.name !== 'query');

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
            {t(`workflow.execution.${status}`, status.toUpperCase())}
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
              p="xs"
              style={{
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-subtle)',
                borderRadius: 8,
              }}
            >
              <Text size="xs" fw={600} mb="xs" style={{ color: 'var(--flock-text-bright)' }}>
                🧑‍💻 {activeInterrupt?.title || t('workflow.execution.humanReview', 'Human Review Required')}
              </Text>
              <Group gap="sm">
                {activeInterrupt?.actions && Array.isArray(activeInterrupt.actions) ? (
                  activeInterrupt.actions.map((act: any) => (
                    <Button
                      key={act.key}
                      size="xs"
                      color="blue"
                      onClick={() => resumeWorkflow({ choice: act.key })}
                    >
                      {act.label || act.key}
                    </Button>
                  ))
                ) : (
                  <>
                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconCheck size={12} />}
                      onClick={() => resumeWorkflow({ choice: 'approved' })}
                    >
                      {t('workflow.execution.approve', 'Approve')}
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      leftSection={<IconX size={12} />}
                      onClick={() => resumeWorkflow({ choice: 'denied' })}
                    >
                      {t('workflow.execution.deny', 'Deny')}
                    </Button>
                  </>
                )}
              </Group>
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
