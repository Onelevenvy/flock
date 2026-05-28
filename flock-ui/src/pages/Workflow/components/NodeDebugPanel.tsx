import { useState } from 'react';
import { Box, Text, Group, ActionIcon, Textarea, Button, Stack, ScrollArea, Badge } from '@mantine/core';
import { IconX, IconPlayerPlay } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useWorkflowExecution } from '../../../hooks/useWorkflowExecution';

interface NodeDebugPanelProps {
  nodeId: string;
  onClose: () => void;
}

export function NodeDebugPanel({ nodeId, onClose }: NodeDebugPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { debugNode } = useWorkflowExecution();
  const executionStatus = useWorkflowStore((s) => s.executionStatus);
  const nodes = useWorkflowStore((s) => s.nodes);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeLabel = node?.data?.label || nodeId;
  const nodeType = node?.type || 'unknown';

  const handleRun = async () => {
    await debugNode(nodeId, input);
  };

  return (
    <Box
      style={{
        width: 320,
        borderLeft: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Group
        px="md"
        py="sm"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--flock-border-subtle)', flexShrink: 0 }}
      >
        <Group gap="xs">
          <Badge size="xs" color="orange" variant="light">
            {t('workflow.debugPanel.badge', 'DEBUG')}
          </Badge>
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
              {nodeLabel}
            </Text>
            <Text size="xs" c="dimmed">{nodeType} · {nodeId}</Text>
          </Box>
        </Group>
        <ActionIcon variant="subtle" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>

      {/* Input area */}
      <ScrollArea style={{ flex: 1 }} px="md" py="sm">
        <Stack gap="sm">
          <Textarea
            label={t('workflow.debugPanel.input', 'Test Input')}
            placeholder={t('workflow.debugPanel.inputPlaceholder', 'Enter test input for this node...')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            minRows={4}
            size="xs"
          />

          <Button
            leftSection={<IconPlayerPlay size={14} />}
            onClick={handleRun}
            loading={executionStatus === 'running'}
            size="xs"
            color="teal"
            fullWidth
          >
            {t('workflow.debugPanel.run', 'Run Node')}
          </Button>

          <Text size="xs" c="dimmed">
            {t('workflow.debugPanel.hint', 'Output will appear in the execution panel. Open it via the play button in the toolbar.')}
          </Text>
        </Stack>
      </ScrollArea>
    </Box>
  );
}
