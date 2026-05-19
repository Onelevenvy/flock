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
import { ToolRequestChunk, ToolCategory } from '../../../types/protocol';

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
  pending: { color: 'yellow', icon: <IconLoader size={14} />, label: '等待审批' },
  approved: { color: 'green', icon: <IconCheck size={14} />, label: '已批准' },
  denied: { color: 'red', icon: <IconX size={14} />, label: '已拒绝' },
  running: { color: 'blue', icon: <Loader size={14} />, label: '执行中' },
  done: { color: 'teal', icon: <IconCheck size={14} />, label: '完成' },
  cancelled: { color: 'gray', icon: <IconBan size={14} />, label: '已取消' },
};

interface ToolCardProps {
  chunk: ToolRequestChunk;
}

export function ToolCard({ chunk }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLOR[chunk.tool.category] || 'gray';
  const catIcon = CATEGORY_ICON[chunk.tool.category];
  const statusCfg = STATUS_CONFIG[chunk.status] || STATUS_CONFIG.pending;

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
            {statusCfg.label}
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
            <Text size="xs" c="dimmed" mb={2}>参数</Text>
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
                输出 {chunk.result_status === 'error' && <Badge color="red" size="xs">Error</Badge>}
              </Text>
              <ScrollArea.Autosize mah={150}>
                <Code
                  block
                  style={{
                    fontSize: '11px',
                    background: 'var(--flock-bg-deepest)',
                    color: chunk.result_status === 'error'
                      ? 'var(--mantine-color-red-4)'
                      : 'var(--flock-text-primary)',
                  }}
                >
                  {chunk.result}
                </Code>
              </ScrollArea.Autosize>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
