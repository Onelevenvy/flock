import { useState, useEffect } from 'react';
import { Button, Group, Stack, Text, TextInput, Card } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconPlayerPlay } from '@tabler/icons-react';
import type { DebugVariable } from './helper';

interface DebugVariablesFormProps {
  variables: DebugVariable[];
  onRun: (mockOutputs: Record<string, any>) => void;
  isRunning: boolean;
}

export function DebugVariablesForm({ variables, onRun, isRunning }: DebugVariablesFormProps) {
  const { t } = useTranslation();
  const [localVars, setLocalVars] = useState<DebugVariable[]>([]);

  useEffect(() => {
    setLocalVars(variables.map((v) => ({ ...v, value: v.value || '' })));
  }, [variables]);

  const handleConfirm = () => {
    const mockOutputs: Record<string, any> = {};
    localVars.forEach((v) => {
      if (!mockOutputs[v.nodeId]) {
        mockOutputs[v.nodeId] = {};
      }
      mockOutputs[v.nodeId][v.field] = v.value;
    });
    onRun(mockOutputs);
  };

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={{
        background: 'var(--flock-bg-surface)',
        borderColor: 'var(--flock-border-dim)',
      }}
    >
      <Stack gap="xs">
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
          {t('workflow.debugPanel.mockVariablesTitle', 'Configure Debug Variables')}
        </Text>
       
        <Stack gap="xs" mt={4}>
          {localVars.map((v, idx) => (
            <TextInput
              key={`${v.nodeId}-${v.field}`}
              label={
                <Text
                  size="xs"
                  span
                  style={{
                    fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                    fontWeight: 600,
                    color: 'var(--flock-text-bright)',
                  }}
                >
                  {v.field}
                </Text>
              }
              value={v.value}
              onChange={(e) => {
                const next = [...localVars];
                next[idx].value = e.target.value;
                setLocalVars(next);
              }}
              placeholder={t('workflow.debugPanel.mockValuePlaceholder', 'Enter mock value')}
              size="xs"
              required
              styles={{
                input: {
                  fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                  backgroundColor: 'var(--flock-bg-base)',
                  borderColor: 'var(--flock-border-dim)',
                  '&:focus': {
                    borderColor: 'var(--flock-accent)',
                  }
                }
              }}
            />
          ))}
        </Stack>
        <Group justify="flex-end" mt="xs">
          <Button
            size="xs"
            color="blue"
            onClick={handleConfirm}
            loading={isRunning}
            leftSection={<IconPlayerPlay size={12} />}
            style={{ background: 'var(--flock-accent)' }}
          >
            {t('workflow.debugPanel.runDebug', 'Run')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
