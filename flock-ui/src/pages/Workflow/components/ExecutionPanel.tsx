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
  Divider,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconX,
  IconTerminal2,
  IconPlayerPlay,
  IconPlayerStop,
  IconCheck,
  IconSend,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export interface ExecutionMessage {
  type: 'text_delta' | 'info' | 'error' | 'done';
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

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  // 记录最后一次运行时的 query
  const handleStart = () => {
    if (!inputVal.trim()) return;
    setLastQuery(inputVal);
    startWorkflow(inputVal);
    setInputVal('');
  };

  // 自动滚动
  useEffect(() => {
    if (!collapsed) {
      chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  useEffect(() => {
    if (!collapsed) {
      logScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  // 1. 过滤 & 聚合出 Chat 气泡
  const chatBubbles = useMemo(() => {
    const bubbles: { role: 'user' | 'assistant'; content: string; nodeId?: string }[] = [];

    // 压入用户问题
    if (lastQuery) {
      bubbles.push({ role: 'user', content: lastQuery });
    }

    // 按节点流式聚合
    let currentText = '';
    let lastNodeId = '';

    messages.forEach((msg) => {
      if (msg.type === 'text_delta') {
        if (msg.nodeId && msg.nodeId !== lastNodeId) {
          if (currentText) {
            bubbles.push({ role: 'assistant', content: currentText, nodeId: lastNodeId });
            currentText = '';
          }
          lastNodeId = msg.nodeId;
        }
        currentText += msg.content;
      }
    });

    if (currentText) {
      bubbles.push({ role: 'assistant', content: currentText, nodeId: lastNodeId });
    }

    return bubbles;
  }, [messages, lastQuery]);

  // 2. 过滤出纯运行时日志
  const runLogs = useMemo(() => {
    return messages.filter((m) => m.type !== 'text_delta');
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
            <ScrollArea style={{ flex: 1 }} p="md">
              <Stack gap="md" pr="sm">
                {chatBubbles.length === 0 ? (
                  <Box
                    py={48}
                    style={{
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
                  chatBubbles.map((bubble, i) => {
                    const isUser = bubble.role === 'user';
                    return (
                      <Group
                        key={i}
                        align="flex-start"
                        justify={isUser ? 'flex-end' : 'flex-start'}
                        gap="sm"
                        className="message-enter"
                      >
                        {!isUser && (
                          <Box
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: 'var(--flock-accent-soft)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              border: '1px solid var(--flock-border-dim)',
                            }}
                          >
                            🤖
                          </Box>
                        )}
                        <Box style={{ maxWidth: '82%' }}>
                          {!isUser && bubble.nodeId && (
                            <Text size="10px" c="dimmed" fw={600} mb={2}>
                              [{bubble.nodeId}]
                            </Text>
                          )}
                          <Box
                            p="xs"
                            style={{
                              borderRadius: isUser ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                              background: isUser
                                ? 'var(--flock-accent, #155aef)'
                                : 'var(--flock-bg-surface)',
                              border: isUser
                                ? 'none'
                                : '1px solid var(--flock-border-subtle)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                            }}
                          >
                            <Text
                              size="xs"
                              style={{
                                color: isUser ? '#ffffff' : 'var(--flock-text-primary)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: 1.5,
                              }}
                            >
                              {bubble.content}
                              {!isUser && status === 'running' && i === chatBubbles.length - 1 && (
                                <Text component="span" fw={900} className="approval-btn" style={{ animation: 'blink 1s infinite' }}>
                                  |
                                </Text>
                              )}
                            </Text>
                          </Box>
                        </Box>
                        {isUser && (
                          <Box
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: 'var(--flock-bg-hover)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              border: '1px solid var(--flock-border-dim)',
                            }}
                          >
                            💻
                          </Box>
                        )}
                      </Group>
                    );
                  })
                )}
                <div ref={chatScrollRef} />
              </Stack>
            </ScrollArea>

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
