import { Box, Text, Stack, Group, Divider, ScrollArea } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export interface DebugResult {
  status: 'done' | 'running' | 'error';
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  startTime: number;
}

interface LastRunPanelProps {
  debugResult?: DebugResult;
}

export function LastRunPanel({ debugResult }: LastRunPanelProps) {
  const { t } = useTranslation();

  if (!debugResult) {
    return (
      <ScrollArea style={{ flex: 1 }} px="md" py="sm">
        <Box style={{ padding: 24, textAlign: 'center' }}>
          <Text size="xs" c="dimmed">
            {t(
              'workflow.debugPanel.noRunResult',
              'No run results yet. Click the play button to run this node.'
            )}
          </Text>
        </Box>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea style={{ flex: 1 }} px="md" py="sm">
      <Stack gap="sm">
        {/* Status Bar */}
        <Box
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background:
              debugResult.status === 'done'
                ? 'var(--flock-accent-soft, rgba(21, 90, 239, 0.08))'
                : debugResult.status === 'running'
                ? 'rgba(34, 139, 230, 0.08)'
                : 'rgba(250, 82, 82, 0.08)',
            border: `1px solid ${
              debugResult.status === 'done'
                ? 'var(--flock-accent)'
                : debugResult.status === 'running'
                ? '#228be6'
                : '#fa5252'
            }`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Group gap="xs">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  debugResult.status === 'done'
                    ? '#40c057'
                    : debugResult.status === 'running'
                    ? '#228be6'
                    : '#fa5252',
              }}
            />
            <Text
              size="xs"
              fw={700}
              style={{
                color:
                  debugResult.status === 'done'
                    ? 'var(--flock-accent)'
                    : debugResult.status === 'running'
                    ? '#228be6'
                    : '#fa5252',
                fontSize: 10,
              }}
            >
              {debugResult.status === 'done'
                ? 'SUCCESS'
                : debugResult.status === 'running'
                ? 'RUNNING'
                : 'FAILED'}
            </Text>
          </Group>
          {debugResult.duration !== undefined && (
            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
              {(debugResult.duration / 1000).toFixed(3)}s
            </Text>
          )}
        </Box>

        {/* Input JSON Block */}
        {debugResult.input && (
          <Box>
            <Text size="xs" fw={600} mb={4} style={{ color: 'var(--flock-text-bright)' }}>
              {t('workflow.debugPanel.inputData', 'Input')}
            </Text>
            <Box
              style={{
                maxHeight: 150,
                overflow: 'auto',
                padding: 8,
                borderRadius: 8,
                background: 'var(--flock-bg-raised, rgba(0,0,0,0.02))',
                border: '1px solid var(--flock-border-subtle)',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: 'var(--flock-text-secondary)',
                }}
              >
                {JSON.stringify(debugResult.input, null, 2)}
              </pre>
            </Box>
          </Box>
        )}

        {/* Output JSON Block */}
        <Box>
          <Text size="xs" fw={600} mb={4} style={{ color: 'var(--flock-text-bright)' }}>
            {t('workflow.debugPanel.outputData', 'Output')}
          </Text>
          <Box
            style={{
              maxHeight: 180,
              overflow: 'auto',
              padding: 8,
              borderRadius: 8,
              background: 'var(--flock-bg-raised, rgba(0,0,0,0.02))',
              border: '1px solid var(--flock-border-subtle)',
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 10,
                fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--flock-text-secondary)',
              }}
            >
              {debugResult.status === 'running'
                ? 'Running...'
                : debugResult.error
                ? debugResult.error
                : JSON.stringify(debugResult.output, null, 2)}
            </pre>
          </Box>
        </Box>

        {/* Metadata Details */}
        <Divider />
        <Box style={{ fontSize: 11 }}>
          <Text size="xs" fw={600} mb={6} style={{ color: 'var(--flock-text-bright)' }}>
            {t('workflow.debugPanel.metaTitle', 'Metadata')}
          </Text>
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                {t('workflow.debugPanel.metaStatus', 'Status')}
              </Text>
              <Text size="xs" fw={500} style={{ fontSize: 10 }}>
                {debugResult.status.toUpperCase()}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                {t('workflow.debugPanel.metaStartTime', 'Start Time')}
              </Text>
              <Text size="xs" fw={500} style={{ fontSize: 10 }}>
                {new Date(debugResult.startTime).toLocaleTimeString()}
              </Text>
            </Group>
            {debugResult.duration !== undefined && (
              <Group justify="space-between">
                <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                  {t('workflow.debugPanel.metaDuration', 'Duration')}
                </Text>
                <Text size="xs" fw={500} style={{ fontSize: 10 }}>
                  {(debugResult.duration / 1000).toFixed(3)}s
                </Text>
              </Group>
            )}
          </Stack>
        </Box>
      </Stack>
    </ScrollArea>
  );
}
