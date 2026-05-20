import { useRef, useEffect, useState } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Badge,
  ScrollArea,
  Stack,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconX,
  IconTerminal2,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export interface ExecutionMessage {
  type: 'text_delta' | 'info' | 'error' | 'done';
  content: string;
  timestamp: number;
}

interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: ExecutionMessage[];
  onClose: () => void;
}

export function ExecutionPanel({ status, messages, onClose }: ExecutionPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

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
        height: collapsed ? 36 : 220,
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
            {t('workflow.execution.title')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {t(`workflow.execution.${status}`)}
          </Badge>
        </Group>
        <ActionIcon variant="subtle" size="xs" color="gray" onClick={onClose}>
          <IconX size={13} />
        </ActionIcon>
      </Group>

      {/* Output */}
      {!collapsed && (
        <ScrollArea style={{ flex: 1 }} p="xs">
          <Stack gap={2}>
            {messages.length === 0 ? (
              <Text
                size="xs"
                ta="center"
                py="xl"
                style={{ color: 'var(--flock-text-muted)', fontFamily: 'var(--mantine-font-family-monospace)' }}
              >
                {t('workflow.execution.noOutput')}
              </Text>
            ) : (
              messages.map((msg, i) => (
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
              ))
            )}
            <div ref={bottomRef} />
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
