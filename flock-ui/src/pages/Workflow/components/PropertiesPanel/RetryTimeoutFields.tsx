import { useState } from 'react';
import { NumberInput, Stack, Group, Collapse, ActionIcon, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface RetryTimeoutFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function RetryTimeoutFields({ node, onDataChange }: RetryTimeoutFieldsProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Group
        gap={4}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpened((o) => !o)}
      >
        <ActionIcon variant="transparent" size="xs" color="gray">
          {opened ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </ActionIcon>
        <Text size="xs" fw={500} c="dimmed">
          {t('workflow.properties.advanced.title', 'Advanced Settings')}
        </Text>
      </Group>
      <Collapse in={opened}>
        <Stack gap="xs" pt={4}>
          <NumberInput
            label={t('workflow.properties.advanced.maxRetries', 'Max Retries')}
            value={node.data.max_retries != null ? Number(node.data.max_retries) : 0}
            onChange={(v) => onDataChange(node.id, 'max_retries', v)}
            min={0}
            max={10}
            step={1}
            size="xs"
          />
          <NumberInput
            label={t('workflow.properties.advanced.retryDelay', 'Retry Delay (ms)')}
            value={node.data.retry_delay_ms != null ? Number(node.data.retry_delay_ms) : 1000}
            onChange={(v) => onDataChange(node.id, 'retry_delay_ms', v)}
            min={100}
            step={500}
            size="xs"
          />
          <NumberInput
            label={t('workflow.properties.advanced.backoffMultiplier', 'Backoff Multiplier')}
            value={node.data.backoff_multiplier != null ? Number(node.data.backoff_multiplier) : 2.0}
            onChange={(v) => onDataChange(node.id, 'backoff_multiplier', v)}
            min={1}
            max={10}
            step={0.5}
            decimalScale={1}
            size="xs"
          />
          <NumberInput
            label={t('workflow.properties.advanced.timeout', 'Timeout (ms)')}
            value={node.data.timeout_ms != null ? Number(node.data.timeout_ms) : 120000}
            onChange={(v) => onDataChange(node.id, 'timeout_ms', v)}
            min={1000}
            step={10000}
            size="xs"
          />
        </Stack>
      </Collapse>
    </>
  );
}
