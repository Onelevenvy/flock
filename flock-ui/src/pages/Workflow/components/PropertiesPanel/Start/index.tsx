import { useState } from 'react';
import { Group, Stack, Text, ActionIcon, Button, Divider, Badge, Modal, Select, TextInput, NumberInput, Switch } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export interface StartFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export interface VariableConfig {
  type: string; // 'string' | 'paragraph' | 'number' | 'boolean' | 'select'
  name: string;
  label: string;
  max_length?: number;
  default_value?: string;
  required: boolean;
  options?: string[]; // Used for select dropdown options
}

export function StartFields({ node, onDataChange }: StartFieldsProps) {
  const { t } = useTranslation();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingVarName, setEditingVarName] = useState<string | null>(null);

  // Default variables list
  const variables = (node.data.variables as VariableConfig[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true }
  ];

  // Modal form states
  const [fieldType, setFieldType] = useState('string');
  const [varName, setVarName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [required, setRequired] = useState(true);

  const handleSaveVariable = () => {
    if (!varName.trim()) return;

    let parsedOptions: string[] | undefined = undefined;
    if (fieldType === 'select') {
      parsedOptions = options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    }

    const newVar: VariableConfig = {
      type: fieldType,
      name: varName.trim(),
      label: displayName.trim() || varName.trim(),
      max_length: fieldType === 'string' ? maxLength : undefined,
      default_value: defaultValue.trim() || undefined,
      required,
      options: parsedOptions,
    };
    
    let next: VariableConfig[];
    if (editingVarName !== null) {
      next = variables.map(v => v.name === editingVarName ? newVar : v);
    } else {
      const existsIdx = variables.findIndex(v => v.name === newVar.name);
      if (existsIdx >= 0) {
        next = [...variables];
        next[existsIdx] = newVar;
      } else {
        next = [...variables, newVar];
      }
    }
    
    onDataChange(node.id, 'variables', next);
    resetForm();
    setModalOpened(false);
  };

  const handleRemoveVariable = (name: string) => {
    const next = variables.filter(v => v.name !== name);
    onDataChange(node.id, 'variables', next);
  };

  const handleEditVariable = (v: VariableConfig) => {
    setEditingVarName(v.name);
    setFieldType(v.type);
    setVarName(v.name);
    setDisplayName(v.label);
    setMaxLength(v.max_length);
    setDefaultValue(v.default_value || '');
    setOptions(v.options || []);
    setRequired(v.required);
    setModalOpened(true);
  };

  const resetForm = () => {
    setEditingVarName(null);
    setFieldType('string');
    setVarName('');
    setDisplayName('');
    setMaxLength(undefined);
    setDefaultValue('');
    setOptions([]);
    setRequired(true);
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="xs" fw={600} c="dimmed">
          {t('workflow.properties.start.inputFields', 'INPUT FIELDS')}
        </Text>
        <ActionIcon variant="subtle" size="sm" onClick={() => { resetForm(); setModalOpened(true); }}>
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      <Stack gap={6}>
        {variables.map((v) => (
          <Group
            key={v.name}
            justify="space-between"
            p="xs"
            onClick={() => handleEditVariable(v)}
            style={{
              borderRadius: '8px',
              border: '1px solid var(--flock-border-subtle)',
              background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
              cursor: 'pointer'
            }}
          >
            <Stack gap={2} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
                  {v.name}
                </Text>
                {v.required && (
                  <Badge color="red" size="xs" variant="light">
                    {t('workflow.properties.start.required', 'Required')}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {v.label} · {v.type}
              </Text>
            </Stack>
            {v.name !== 'query' && (
              <ActionIcon
                variant="subtle"
                color="red"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveVariable(v.name);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
          </Group>
        ))}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingVarName ? t('workflow.properties.start.editVarTitle', 'Edit Variable') : t('workflow.properties.start.addVarTitle', 'Add Variable')}
        size="sm"
        centered
        styles={{
          header: { backgroundColor: 'var(--flock-bg-surface)' },
          content: { backgroundColor: 'var(--flock-bg-surface)' },
        }}
      >
        <Stack gap="sm">
          <Select
            label={t('workflow.properties.start.fieldType', 'Field Type')}
            data={[
              { value: 'string', label: t('workflow.properties.start.text', 'Text (Single Line)') },
              { value: 'paragraph', label: t('workflow.properties.start.paragraph', 'Paragraph (Multi Line)') },
              { value: 'number', label: t('workflow.properties.start.number', 'Number') },
              { value: 'boolean', label: t('workflow.properties.start.boolean', 'Boolean') },
              { value: 'select', label: t('workflow.properties.start.select', 'Options (Dropdown Select)') },
            ]}
            value={fieldType}
            onChange={(v) => setFieldType(v ?? 'string')}
            size="xs"
            disabled={editingVarName === 'query'}
          />

          <TextInput
            label={t('workflow.properties.start.varName', 'Variable Name')}
            placeholder="e.g. user_age"
            value={varName}
            onChange={(e) => setVarName(e.target.value)}
            size="xs"
            required
            disabled={editingVarName !== null}
          />

          <TextInput
            label={t('workflow.properties.start.displayName', 'Display Name')}
            placeholder="e.g. User Age"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            size="xs"
          />

          {fieldType === 'string' && (
            <NumberInput
              label={t('workflow.properties.start.maxLength', 'Max Length')}
              value={maxLength}
              onChange={(v) => setMaxLength(v ? Number(v) : undefined)}
              min={1}
              size="xs"
            />
          )}

          {fieldType === 'select' && (
            <Stack gap="xs">
              <Text size="xs" fw={500}>{t('workflow.properties.start.optionsList', 'Options')}</Text>
              {options.map((option, idx) => (
                <Group key={idx} gap="xs">
                  <TextInput
                    value={option}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    size="xs"
                    style={{ flex: 1 }}
                    placeholder={`Option ${idx + 1}`}
                  />
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => {
                    setOptions(options.filter((_, i) => i !== idx));
                  }}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconPlus size={12} />}
                onClick={() => setOptions([...options, ''])}
              >
                {t('workflow.properties.start.addOption', 'Add Option')}
              </Button>
            </Stack>
          )}

          <TextInput
            label={t('workflow.properties.start.defaultValue', 'Default Value')}
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            size="xs"
          />

          <Switch
            label={t('workflow.properties.start.requiredVar', 'Required')}
            checked={required}
            onChange={(e) => setRequired(e.currentTarget.checked)}
            size="xs"
            disabled={editingVarName === 'query'}
          />

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="light" size="xs" color="gray" onClick={() => setModalOpened(false)}>
              {t('workflow.properties.start.cancel', 'Cancel')}
            </Button>
            <Button size="xs" onClick={handleSaveVariable} disabled={!varName.trim()}>
              {t('workflow.properties.start.save', 'Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

