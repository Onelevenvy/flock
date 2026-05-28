import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  TextInput,
  Select,
  Stack,
  ScrollArea,
  Tooltip,
  Divider,
} from '@mantine/core';
import { IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore, type EnvVar } from '../../../store/workflowStore';
import type { VariableType } from '../../../types/workflowVariables';

const TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

interface EnvironmentVarsPanelProps {
  onClose: () => void;
}

export function EnvironmentVarsPanel({ onClose }: EnvironmentVarsPanelProps) {
  const { t } = useTranslation();
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);
  const setEnvironmentVariable = useWorkflowStore((s) => s.setEnvironmentVariable);
  const removeEnvironmentVariable = useWorkflowStore((s) => s.removeEnvironmentVariable);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<VariableType>('string');

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key) return;
    setEnvironmentVariable(key, newValue, newType);
    setNewKey('');
    setNewValue('');
    setNewType('string');
  };

  const handleUpdateValue = (key: string, value: string, type: VariableType) => {
    setEnvironmentVariable(key, value, type);
  };

  const entries = Object.entries(environmentVariables);

  return (
    <Box
      style={{
        width: 340,
        margin: '12px 8px 8px 0',
        borderRadius: 12,
        border: '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        px="md"
        py="sm"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--flock-border-subtle)', flexShrink: 0 }}
      >
        <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
          {t('workflow.envVars.title', 'Environment Variables')}
        </Text>
        <ActionIcon variant="subtle" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>

      {/* Variable list */}
      <ScrollArea style={{ flex: 1 }} px="md" py="sm">
        <Stack gap="xs">
          {entries.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              {t('workflow.envVars.empty', 'No environment variables defined')}
            </Text>
          )}

          {entries.map(([key, envVar]) => (
            <EnvVarRow
              key={key}
              name={key}
              envVar={envVar}
              onUpdate={handleUpdateValue}
              onRemove={() => removeEnvironmentVariable(key)}
            />
          ))}

          <Divider label={t('workflow.envVars.addNew', 'Add New')} labelPosition="center" my="xs" />

          {/* Add new variable */}
          <Group gap="xs" align="flex-end">
            <TextInput
              placeholder={t('workflow.envVars.namePlaceholder', 'Variable name')}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <Select
              data={TYPE_OPTIONS}
              value={newType}
              onChange={(v) => setNewType((v ?? 'string') as VariableType)}
              size="xs"
              w={90}
            />
          </Group>
          <Group gap="xs" align="flex-end">
            <TextInput
              placeholder={t('workflow.envVars.valuePlaceholder', 'Value')}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <Tooltip label={t('workflow.envVars.add', 'Add')}>
              <ActionIcon
                variant="filled"
                color="blue"
                onClick={handleAdd}
                disabled={!newKey.trim()}
                size="sm"
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>
      </ScrollArea>
    </Box>
  );
}

function EnvVarRow({
  name,
  envVar,
  onUpdate,
  onRemove,
}: {
  name: string;
  envVar: EnvVar;
  onUpdate: (key: string, value: string, type: VariableType) => void;
  onRemove: () => void;
}) {
  return (
    <Box
      p="xs"
      style={{
        border: '1px solid var(--flock-border-subtle)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      <Group justify="space-between" mb={4}>
        <Text
          size="xs"
          fw={600}
          style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-bright)' }}
        >
          {name}
        </Text>
        <Group gap={4}>
          <Select
            data={TYPE_OPTIONS}
            value={envVar.type}
            onChange={(v) => onUpdate(name, envVar.value, (v ?? 'string') as VariableType)}
            size="xs"
            w={80}
          />
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onRemove}>
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      </Group>
      <TextInput
        value={envVar.value}
        onChange={(e) => onUpdate(name, e.target.value, envVar.type)}
        size="xs"
        placeholder="Value"
      />
    </Box>
  );
}
