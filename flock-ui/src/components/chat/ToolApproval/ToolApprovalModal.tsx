import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Code,
  ScrollArea,
  ThemeIcon,
  Box,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconTerminal2,
  IconPlug,
  IconCheck,
  IconX,
  IconShieldCheck,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { PendingApproval, ToolCategory } from '../../../types/protocol';
import { useAgentStore } from '../../../store/agentStore';
import { useUiStore } from '../../../store/uiStore';

interface ToolApprovalModalProps {
  approval: PendingApproval | null;
}

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { color: string; label: string; icon: React.ReactNode; description: string }
> = {
  info: {
    color: 'blue',
    label: 'Info',
    icon: <IconEye size={18} />,
    description: '只读操作，不修改任何文件',
  },
  edit: {
    color: 'orange',
    label: 'Edit',
    icon: <IconEdit size={18} />,
    description: '将修改文件内容',
  },
  exec: {
    color: 'red',
    label: 'Exec',
    icon: <IconTerminal2 size={18} />,
    description: '将执行系统命令，请谨慎确认',
  },
  mcp: {
    color: 'grape',
    label: 'MCP',
    icon: <IconPlug size={18} />,
    description: '外部 MCP 工具调用',
  },
};

export function ToolApprovalModal({ approval }: ToolApprovalModalProps) {
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!approval) return null;

  const { call_id, tool } = approval;
  const config = CATEGORY_CONFIG[tool.category] || CATEGORY_CONFIG.exec;
  const argsStr = JSON.stringify(tool.args, null, 2);

  const handleApprove = async (scope: 'once' | 'always') => {
    removePendingApproval(call_id);
    await invoke('approve_tool', { callId: call_id, scope });
  };

  const handleDeny = async () => {
    removePendingApproval(call_id);
    await invoke('deny_tool', { callId: call_id, reason: 'User denied' });
  };

  return (
    <Modal
      opened={!!approval}
      onClose={handleDeny}
      title={
        <Group gap="xs">
          <ThemeIcon color={config.color} size="md" radius="sm">
            {config.icon}
          </ThemeIcon>
          <Text fw={600} size="md">工具调用请求</Text>
        </Group>
      }
      size="lg"
      radius="md"
      overlayProps={{ blur: 3 }}
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
        },
      }}
    >
      <Stack gap="md" pt="xs">
        {/* 工具名称和类别 */}
        <Group gap="sm" align="center">
          <Badge
            color={config.color}
            variant="light"
            size="lg"
            leftSection={config.icon}
          >
            {tool.name}
          </Badge>
          <Badge color={config.color} variant="dot" size="sm">
            {config.label}
          </Badge>
        </Group>

        {/* 风险说明 */}
        <Box
          p="xs"
          style={{
            borderRadius: 'var(--mantine-radius-sm)',
            background: `color-mix(in srgb, var(--mantine-color-${config.color}-9) 20%, transparent)`,
            border: `1px solid color-mix(in srgb, var(--mantine-color-${config.color}-7) 40%, transparent)`,
          }}
        >
          <Text size="xs" c={isDark ? `${config.color}.3` : `${config.color}.9`} fw={500}>
            {config.description}
          </Text>
        </Box>

        {/* 参数预览 */}
        <Stack gap="4">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            参数
          </Text>
          <ScrollArea.Autosize mah={200}>
            <Code
              block
              style={{
                fontSize: '12px',
                background: 'var(--flock-bg-deepest)',
                color: 'var(--flock-text-primary)',
              }}
            >
              {argsStr}
            </Code>
          </ScrollArea.Autosize>
        </Stack>

        {/* 操作按钮 */}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button
            variant="light"
            color="red"
            leftSection={<IconX size={16} />}
            onClick={handleDeny}
          >
            拒绝
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={() => handleApprove('once')}
          >
            本次允许
          </Button>
          <Button
            variant="filled"
            color="green"
            leftSection={<IconShieldCheck size={16} />}
            onClick={() => handleApprove('always')}
          >
            始终允许
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
