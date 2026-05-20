import { useRef, useEffect, useState } from 'react';
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
  IconPlayerPlay,
  IconPlayerStop,
  IconCheck,
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const handleStart = () => {
    if (!inputVal.trim()) return;
    startWorkflow(inputVal);
  };

  const isInterrupted =
    messages.length > 0 &&
    messages[messages.length - 1].content.includes('⏳ 正在等待人工确认');

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : 'gray';

  return (
    <Box
      style={{
        borderTop: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-deepest)',
        height: collapsed ? 36 : 280, // 稍微增高以便容纳控制区
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

      {/* Output */}
      {!collapsed && (
        <ScrollArea style={{ flex: 1 }} p="xs">
          <Stack gap={10}>
            {messages.length === 0 ? (
              <Box py="xl" px="md" style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
                <Stack gap="sm">
                  <Text
                    size="xs"
                    ta="center"
                    style={{ color: 'var(--flock-text-muted)', fontFamily: 'var(--mantine-font-family-monospace)' }}
                  >
                    {t('workflow.execution.noOutput', 'No active execution. Enter initial query below to run.')}
                  </Text>
                  <Group gap="xs" grow>
                    <TextInput
                      placeholder="e.g. What is Rust?"
                      size="xs"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleStart();
                      }}
                      styles={{
                        input: {
                          background: 'var(--flock-bg-surface)',
                          borderColor: 'var(--flock-border-subtle)',
                        }
                      }}
                    />
                    <Button
                      size="xs"
                      color="blue"
                      leftSection={<IconPlayerPlay size={12} />}
                      onClick={handleStart}
                      disabled={!inputVal.trim()}
                      style={{ flexGrow: 0 }}
                    >
                      {t('workflow.execution.run', 'Run')}
                    </Button>
                  </Group>
                </Stack>
              </Box>
            ) : (
              <Stack gap={2}>
                {messages.map((msg, i) => (
                  <Box
                    key={i}
                    style={{
                      fontFamily: 'var(--mantine-font-family-monospace)',
                      fontSize: 11,
                      lineHeight: 1.65,
                      color:
                        msg.type === 'error'
                          ? 'var(--mantine-color-red-5)'
                          : msg.type === 'info'
                          ? 'var(--flock-text-muted)'
                          : 'var(--flock-text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {msg.content}
                  </Box>
                ))}
              </Stack>
            )}

            {isInterrupted && (
              <Box
                p="xs"
                style={{
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-subtle)',
                  borderRadius: 8,
                  marginTop: 10,
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
            )}

            <div ref={bottomRef} />
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
