import React, { useState } from 'react';
import {
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  Collapse,
  Code,
  ScrollArea,
  ThemeIcon,
  Stack,
  Box,
  Loader,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconX,
  IconLoader,
  IconBan,
  IconEye,
  IconEdit,
  IconTerminal2,
  IconPlug,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ToolRequestChunk, ToolCategory } from '@/types/protocol';
import { MarkdownRenderer } from '@/components/chat/shared/MarkdownRenderer';

const CATEGORY_COLOR: Record<ToolCategory, string> = {
  info: 'blue',
  edit: 'orange',
  exec: 'red',
  mcp: 'grape',
};

const CATEGORY_ICON: Record<ToolCategory, React.ReactNode> = {
  info: <IconEye size={14} />,
  edit: <IconEdit size={14} />,
  exec: <IconTerminal2 size={14} />,
  mcp: <IconPlug size={14} />,
};

const STATUS_CONFIG = {
  pending: { color: 'yellow', icon: <IconLoader size={14} />, key: 'chat.status.pending' },
  approved: { color: 'green', icon: <IconCheck size={14} />, key: 'chat.status.approved' },
  denied: { color: 'red', icon: <IconX size={14} />, key: 'chat.status.denied' },
  running: { color: 'blue', icon: <Loader size={14} />, key: 'chat.status.running' },
  done: { color: 'teal', icon: <IconCheck size={14} />, key: 'chat.status.done' },
  cancelled: { color: 'gray', icon: <IconBan size={14} />, key: 'chat.status.cancelled' },
};

interface ToolCardProps {
  chunk: ToolRequestChunk;
}

export function ToolCard({ chunk }: ToolCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLOR[chunk.tool.category] || 'gray';
  const catIcon = CATEGORY_ICON[chunk.tool.category];
  const statusCfg = STATUS_CONFIG[chunk.status] || STATUS_CONFIG.pending;
  const statusLabel = t(statusCfg.key);

  return (
    <Paper
      p="xs"
      radius="sm"
      style={{
        background: 'var(--flock-bg-surface)',
        border: '1px solid var(--flock-border-dim)',
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      <Group justify="space-between" gap="xs">
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <ThemeIcon size="xs" color="blue" variant="light" radius="sm">
            {catIcon}
          </ThemeIcon>
          <Text size="xs" fw={700} style={{ color: 'var(--flock-text-primary)', whiteSpace: 'nowrap' }}>
            {chunk.tool.name}
          </Text>
          <Text size="xs" style={{ color: 'var(--flock-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chunk.tool.description}
          </Text>
        </Group>

        <Group gap="xs">
          <Badge
            color={statusCfg.color}
            variant="light"
            size="xs"
            leftSection={statusCfg.icon}
          >
            {statusLabel}
          </Badge>
          <ActionIcon
            size="xs"
            variant="subtle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="xs" mt="xs">
          {/* 参数 */}
          <Box>
            <Text size="xs" c="dimmed" mb={2}>{t('chat.params')}</Text>
            <Code
              block
              style={{
                fontSize: '11px',
                background: 'var(--flock-bg-deepest)',
                color: 'var(--flock-text-primary)',
              }}
            >
              {JSON.stringify(chunk.tool.args, null, 2)}
            </Code>
          </Box>

          {/* 结果 */}
          {chunk.result && (
            <Box>
              <Text size="xs" c="dimmed" mb={2}>
                {t('chat.output')} {chunk.result_status === 'error' && <Badge color="red" size="xs">Error</Badge>}
              </Text>
              <Box
                style={{
                  maxHeight: 450,
                  overflow: 'auto',
                  background: 'var(--flock-bg-deepest)',
                  borderRadius: 4,
                  padding: '8px 12px',
                }}
              >
                <Box
                  component="pre"
                  style={{
                    margin: 0,
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: '11px',
                    color: chunk.result_status === 'error'
                      ? 'var(--mantine-color-red-4)'
                      : 'var(--flock-text-primary)',
                    whiteSpace: 'pre',
                  }}
                >
                  {chunk.result}
                </Box>
              </Box>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
