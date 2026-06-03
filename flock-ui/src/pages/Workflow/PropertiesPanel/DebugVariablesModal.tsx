import { useState, useEffect } from 'react';
import { Modal, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export interface DebugVariable {
  fullPath: string;
  nodeId: string;
  field: string;
  value: string;
}

interface DebugVariablesModalProps {
  opened: boolean;
  onClose: () => void;
  variables: DebugVariable[];
  onConfirm: (mockOutputs: Record<string, any>) => void;
}

export function DebugVariablesModal({
  opened,
  onClose,
  variables,
  onConfirm,
}: DebugVariablesModalProps) {
  const { t } = useTranslation();
  const [localVars, setLocalVars] = useState<DebugVariable[]>([]);

  // Synchronize internal state when the modal opens or variables change
  useEffect(() => {
    if (opened) {
      setLocalVars(variables.map((v) => ({ ...v, value: v.value || '' })));
    }
  }, [opened, variables]);

  const handleConfirm = () => {
    // Build the nested mock outputs structure:
    // mockOutputs[nodeId][field] = value
    const mockOutputs: Record<string, any> = {};
    localVars.forEach((v) => {
      if (!mockOutputs[v.nodeId]) {
        mockOutputs[v.nodeId] = {};
      }
      mockOutputs[v.nodeId][v.field] = v.value;
    });
    onConfirm(mockOutputs);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('workflow.debugPanel.mockVariablesTitle', 'Configure Debug Variables')}
      size="sm"
      centered
      styles={{
        title: { fontSize: 13, fontWeight: 700, color: 'var(--flock-text-bright)' },
        content: {
          background: 'var(--flock-bg-base)',
          border: '1px solid var(--flock-border-subtle)',
          borderRadius: 12,
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.15)',
        },
        body: {
          padding: '16px 20px',
        }
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          {t(
            'workflow.debugPanel.mockVariablesDesc',
            'This node depends on output variables from other nodes. Please configure mock values for debugging:'
          )}
        </Text>
        <Stack gap="xs">
          {localVars.map((v, idx) => (
            <TextInput
              key={`${v.nodeId}-${v.field}`}
              label={
                <Group justify="space-between" style={{ width: '100%', marginBottom: 2 }} gap="xs">
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
                  
                </Group>
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
                  backgroundColor: 'var(--flock-bg-surface)',
                  borderColor: 'var(--flock-border-dim)',
                  '&:focus': {
                    borderColor: 'var(--flock-accent)',
                  }
                }
              }}
            />
          ))}
        </Stack>
        <Group justify="flex-end" mt="md" gap="xs">
          <Button variant="subtle" size="xs" color="gray" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button size="xs" color="blue" onClick={handleConfirm} style={{ background: 'var(--flock-accent)' }}>
            {t('workflow.debugPanel.runDebug', 'Run')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
