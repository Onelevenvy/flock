import { useRef, useEffect, useState, useMemo } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Badge,
  ScrollArea,
  Stack,
  TextInput,
  Button,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconCheck,
  IconSend,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../../../components/chat/ChatPanel';
import { ChatMessage } from '../../../types/protocol';

export interface ExecutionMessage {
  type: 'text_delta' | 'thinking' | 'info' | 'error' | 'done';
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
  const [collapsed, setCollapsed] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [lastQuery, setLastQuery] = useState('');

  const logScrollRef = useRef<HTMLDivElement>(null);

  // 记录最后一次运行时的 query
  const handleStart = () => {
    if (!inputVal.trim()) return;
    setLastQuery(inputVal);
    startWorkflow(inputVal);
    setInputVal('');
  };

  // 自动滚动日志
  useEffect(() => {
    if (!collapsed) {
      logScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  // 1. 转换并聚合出 ChatPanel 可识别的 ChatMessage 数组
  const chatMessages = useMemo<ChatMessage[]>(() => {
    const result: ChatMessage[] = [];

    // 压入用户问题
    if (lastQuery) {
      result.push({
        id: 'user-query',
        role: 'user',
        chunks: [{ kind: 'text', text: lastQuery }],
        streaming: false,
        timestamp: messages.length > 0 ? messages[0].timestamp - 1 : Date.now(),
      });
    }

    // 按节点流式聚合所有的 text_delta 和 thinking
    let currentAssistantMsg: ChatMessage | null = null;

    for (const msg of messages) {
      if (msg.type === 'text_delta' || msg.type === 'thinking') {
        const nodeId = msg.nodeId || 'assistant';
        const displayNodeName = `**[${nodeId}]**\n`;

        // 如果还没有当前正在构建的 assistant 消息，或者虽然有但 nodeId 发生了变化，我们开启一条新的 assistant 消息
        if (!currentAssistantMsg || currentAssistantMsg.id !== `assistant-${nodeId}`) {
          if (currentAssistantMsg) {
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
  }, [messages, lastQuery, status]);

  // 2. 过滤出纯运行时日志
  const runLogs = useMemo(() => {
    return messages.filter((m) => m.type !== 'text_delta' && m.type !== 'thinking');
  }, [messages]);

  const isInterrupted =
    messages.length > 0 &&
    messages[messages.length - 1].content.includes('⏳ 正在等待人工确认');

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : 'gray';

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toTimeString().split(' ')[0];
  };

  return (
    <Box
      style={{
        borderTop: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-deepest)',
        height: collapsed ? 36 : 380, // 增高面板高度以获得完美的左右分栏沉浸体验
        transition: 'height 0.22s cubic-bezier(0.25, 0.8, 0.25, 1)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <Group
        px="sm"
        justify="space-between"
        style={{
          height: 36,
          flexShrink: 0,
          borderBottom: collapsed ? 'none' : '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        <Group gap="xs">
          <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <IconChevronRight size={13} /> : <IconChevronDown size={13} />}
          </ActionIcon>
          <IconTerminal2 size={13} style={{ color: 'var(--flock-text-muted)' }} />
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.03em' }}>
            {t('workflow.execution.title', 'Execution Output')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {t(`workflow.execution.${status}`, status.toUpperCase())}
          </Badge>
        </Group>

        <Group gap="xs">
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
            <IconX size={13} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Output Content area */}
      {!collapsed && (
        <Box style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* LEFT: Chat Console (65%) */}
          <Box
            style={{
              flex: '0 0 62%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--flock-border-subtle)',
              background: 'var(--flock-bg-base)',
              minHeight: 0,
            }}
          >
            {chatMessages.length === 0 ? (
              <Box
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                }}
              >
                <Text size="xs" c="dimmed" ta="center">
                  🤖 {t('workflow.execution.noOutput', 'No active execution. Enter initial query below to run.')}
                </Text>
              </Box>
            ) : (
              <ChatPanel messages={chatMessages} />
            )}

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
                    🧑‍💻 Human Review Required (需要人工确认)
                  </Text>
                  <Group gap="sm">
                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconCheck size={12} />}
                      onClick={() => resumeWorkflow({ choice: 'approved' })}
                    >
                      批准 (Approve)
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      leftSection={<IconX size={12} />}
                      onClick={() => resumeWorkflow({ choice: 'denied' })}
                    >
                      拒绝 (Deny)
                    </Button>
                  </Group>
                </Box>
              ) : (
                <Group gap="xs">
                  <TextInput
                    placeholder={t('workflow.execution.noOutput', 'Enter initial query...')}
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

          {/* RIGHT: Run Log (38%) */}
          <Box
            style={{
              flex: '0 0 38%',
              background: 'var(--flock-bg-deepest)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Box px="xs" py="xs" style={{ borderBottom: '1px solid var(--flock-border-subtle)' }}>
              <Text size="9px" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
                🚀 System Run Log (系统执行轨迹)
              </Text>
            </Box>
            <ScrollArea style={{ flex: 1 }} p="xs">
              <Stack gap={4} pr="xs">
                {runLogs.length === 0 ? (
                  <Text size="10px" c="dimmed" fs="italic" ta="center" py="xl">
                    Waiting for events...
                  </Text>
                ) : (
                  runLogs.map((msg, i) => {
                    const isError = msg.type === 'error';
                    const isDone = msg.type === 'done';
                    let logColor = 'var(--flock-text-muted)';
                    if (isError) logColor = 'var(--mantine-color-red-5)';
                    else if (isDone) logColor = 'var(--mantine-color-teal-5)';

                    return (
                      <Box
                        key={i}
                        style={{
                          fontFamily: 'var(--mantine-font-family-monospace)',
                          fontSize: '10px',
                          lineHeight: 1.5,
                          color: logColor,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        <Text component="span" c="dimmed" mr={4}>
                          [{formatTime(msg.timestamp)}]
                        </Text>
                        {msg.nodeId && (
                          <Text component="span" c="blue" fw={600} mr={4}>
                            [{msg.nodeId}]
                          </Text>
                        )}
                        {msg.content}
                      </Box>
                    );
                  })
                )}
                <div ref={logScrollRef} />
              </Stack>
            </ScrollArea>
          </Box>
        </Box>
      )}
    </Box>
  );
}
