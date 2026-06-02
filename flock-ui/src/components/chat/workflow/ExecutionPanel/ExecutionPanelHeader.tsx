import { Group, Text, Badge, Button, ActionIcon } from '@mantine/core';
import { IconTerminal2, IconPlus, IconPlayerStop, IconX } from '@tabler/icons-react';
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
}: ExecutionPanelHeaderProps) {
  const { t } = useTranslation();

  return (
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
