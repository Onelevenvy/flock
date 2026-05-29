import { NumberInput, Stack, Group, Switch, Slider, Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface RetryTimeoutFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function RetryTimeoutFields({ node, onDataChange }: RetryTimeoutFieldsProps) {
  const { t } = useTranslation();
  
  // Check if retry is active
  const retryEnabled = node.data.max_retries !== undefined && node.data.max_retries > 0;

  const handleToggleRetry = (checked: boolean) => {
    if (checked) {
      onDataChange(node.id, 'max_retries', 3);
      onDataChange(node.id, 'retry_delay_ms', 1000);
    } else {
      onDataChange(node.id, 'max_retries', undefined);
      onDataChange(node.id, 'retry_delay_ms', undefined);
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
          {t('workflow.properties.advanced.retryOnFailure', 'Retry on Failure')}
        </Text>
        <Switch
          checked={retryEnabled}
          onChange={(e) => handleToggleRetry(e.currentTarget.checked)}
          size="xs"
        />
      </Group>

      {retryEnabled && (
        <Stack gap="xs">
          {/* Max Retries */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Text size="xs" fw={500} c="dimmed">
                {t('workflow.properties.advanced.maxRetries', 'Max Retries')}
              </Text>
              <NumberInput
                value={node.data.max_retries ?? 3}
                onChange={(v) => onDataChange(node.id, 'max_retries', Number(v))}
                min={1}
                max={10}
                size="xs"
                style={{ width: 90 }}
                variant="filled"
                suffix={t('workflow.properties.advanced.times', ' Times')}
                styles={{ input: { textAlign: 'center', padding: 0 } }}
              />
            </Group>
            <Box px={6}>
              <Slider
                value={node.data.max_retries ?? 3}
                onChange={(v) => onDataChange(node.id, 'max_retries', v)}
                min={1}
                max={10}
                step={1}
                label={null}
                size="xs"
              />
              </Box>
            </Stack>

            {/* Retry Delay */}
            <Stack gap={4}>
              <Group justify="space-between" align="center">
                <Text size="xs" fw={500} c="dimmed">
                  {t('workflow.properties.advanced.retryDelay', 'Retry Delay')}
                </Text>
                <NumberInput
                  value={node.data.retry_delay_ms ?? 1000}
                  onChange={(v) => onDataChange(node.id, 'retry_delay_ms', Number(v))}
                  min={100}
                  max={10000}
                  size="xs"
                  style={{ width: 90 }}
                  variant="filled"
                  suffix=" ms"
                  styles={{ input: { textAlign: 'center', padding: 0 } }}
                />
              </Group>
              <Box px={6}>
                <Slider
                  value={node.data.retry_delay_ms ?? 1000}
                  onChange={(v) => onDataChange(node.id, 'retry_delay_ms', v)}
                  min={100}
                  max={10000}
                  step={100}
                  label={null}
                  size="xs"
                />
              </Box>
            </Stack>
          </Stack>
        )}
      </Stack>
    );
  }
