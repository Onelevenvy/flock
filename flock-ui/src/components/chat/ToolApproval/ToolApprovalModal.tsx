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
  Textarea,
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
import { useTranslation } from 'react-i18next';
import { PendingApproval, ToolCategory } from '../../../types/protocol';
import { useAgentStore } from '../../../store/agentStore';
import { useUiStore } from '../../../store/uiStore';

interface ToolApprovalModalProps {
  approval: PendingApproval | null;
}

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { color: string; label: string; icon: React.ReactNode; descriptionKey: string }
> = {
  info: {
    color: 'blue',
    label: 'Info',
    icon: <IconEye size={18} />,
    descriptionKey: 'chat.approval.descRead',
  },
  edit: {
    color: 'orange',
    label: 'Edit',
    icon: <IconEdit size={18} />,
    descriptionKey: 'chat.approval.descWrite',
  },
  exec: {
    color: 'red',
    label: 'Exec',
    icon: <IconTerminal2 size={18} />,
    descriptionKey: 'chat.approval.descExec',
  },
  mcp: {
    color: 'grape',
    label: 'MCP',
    icon: <IconPlug size={18} />,
    descriptionKey: 'chat.approval.descMcp',
  },
};

export function ToolApprovalModal({ approval }: ToolApprovalModalProps) {
  const { t } = useTranslation();
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    setFeedback('');
  }, [approval?.call_id]);

  if (!approval) return null;

  const { call_id, tool } = approval;
  const config = CATEGORY_CONFIG[tool.category] || CATEGORY_CONFIG.exec;
  const description = t(config.descriptionKey);
  const argsStr = JSON.stringify(tool.args, null, 2);

  const handleApprove = async (scope: 'once' | 'always') => {
    removePendingApproval(call_id);
    await invoke('approve_tool', { callId: call_id, scope });
  };

  const handleDeny = async () => {
    const reason = feedback.trim() || 'User denied';
    removePendingApproval(call_id);
    await invoke('deny_tool', { callId: call_id, reason });
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
          <Text fw={600} size="md">{t('chat.approval.title')}</Text>
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
            {description}
          </Text>
        </Box>

        {/* 参数预览 */}
        <Stack gap="4">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {t('chat.params')}
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

        {/* 反馈输入框 */}
        <Stack gap="4">
          <Textarea
            placeholder={t('chat.approval.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
            styles={{
              input: {
                fontSize: '12px',
                backgroundColor: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
                color: 'var(--flock-text-primary)',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleDeny();
              }
            }}
          />
        </Stack>

        {/* 操作按钮 */}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button
            variant="light"
            color="red"
            leftSection={<IconX size={16} />}
            onClick={handleDeny}
          >
            {feedback.trim() ? t('chat.approval.btnDenyWithFeedback') : t('chat.approval.deny')}
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={() => handleApprove('once')}
          >
            {t('chat.approval.approveOnce')}
          </Button>
          <Button
            variant="filled"
            color="green"
            leftSection={<IconShieldCheck size={16} />}
            onClick={() => handleApprove('always')}
          >
            {t('chat.approval.approveAlways')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

