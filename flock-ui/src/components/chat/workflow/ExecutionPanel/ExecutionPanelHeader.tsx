import { Group, Text, Badge, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconTerminal2, IconPlus, IconPlayerStop, IconX, IconFolder } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ExecutionPanelHeaderProps {
  isEmbedded?: boolean;
  workflowName?: string;
  status: string;
  statusColor: string;
  isInterrupted: boolean;
  hasMessages: boolean;
  onClear: () => void;
  onStop: () => void;
  onClose?: () => void;
  showDebugWorkspace?: boolean;
  onToggleDebugWorkspace?: () => void;
}

export function ExecutionPanelHeader({
  isEmbedded = false,
  workflowName,
  status,
  statusColor,
  isInterrupted,
  hasMessages,
  onClear,
  onStop,
  onClose,
  showDebugWorkspace = false,
  onToggleDebugWorkspace,
}: ExecutionPanelHeaderProps) {
  const { t } = useTranslation();

  return (
    <Group
      px="sm"
      justify="space-between"
      style={{
        height: 48,
        flexShrink: 0,
        borderBottom: '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-deep)',
      }}
    >
      <Group gap="xs">
        {isEmbedded ? (
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)' }}>
            ⚡ {workflowName || t('workflow.execution.title', 'Execution Output')}
          </Text>
        ) : (
          <>
            <IconTerminal2 size={14} style={{ color: 'var(--flock-text-muted)' }} />
            <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.03em' }}>
              {t('workflow.execution.title', 'Execution Output')}
            </Text>
          </>
        )}
        <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
          {isInterrupted
            ? t('workflow.execution.waiting', 'WAITING')
            : t(`workflow.execution.${status}`, status.toUpperCase())}
        </Badge>
      </Group>

      <Group gap="xs">
        {onToggleDebugWorkspace && (
          <Tooltip label={showDebugWorkspace ? t('workflow.execution.hideWorkspace', '隐藏调试文件') : t('workflow.execution.showWorkspace', '显示调试文件')} withArrow>
            <ActionIcon
              variant={showDebugWorkspace ? "light" : "subtle"}
              size="sm"
              color={showDebugWorkspace ? "blue" : "gray"}
              onClick={onToggleDebugWorkspace}
            >
              <IconFolder size={14} />
            </ActionIcon>
          </Tooltip>
        )}
        {!isEmbedded && status !== 'running' && !isInterrupted && hasMessages && (
          <Button
            size="xs"
            variant="subtle"
            color="blue"
            leftSection={<IconPlus size={12} />}
            onClick={onClear}
            style={{ height: 24, fontSize: 10, padding: '0 8px' }}
          >
            {t('workflow.execution.newChat', 'New Chat')}
          </Button>
        )}
        {!isEmbedded && onClose && (
          <ActionIcon variant="subtle" size="xs" color="gray" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}

