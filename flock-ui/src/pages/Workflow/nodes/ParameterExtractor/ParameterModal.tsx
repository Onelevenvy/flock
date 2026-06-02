import React from 'react';
import { Modal, Stack, TextInput, Select, Group, Text, Switch, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export interface ExtractorParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ParameterModalProps {
  opened: boolean;
  onClose: () => void;
  activeParamIndex: number | null;
  paramForm: ExtractorParameter;
  setParamForm: React.Dispatch<React.SetStateAction<ExtractorParameter>>;
  onSave: () => void;
}

export function ParameterModal({
  opened,
  onClose,
  activeParamIndex,
  paramForm,
  setParamForm,
  onSave,
}: ParameterModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        activeParamIndex !== null
          ? t('workflow.properties.extractor.editParam', 'Edit Parameter')
          : t('workflow.properties.extractor.addParam', 'Add Parameter')
      }
      size="sm"
      centered
      styles={{
        header: { borderBottom: '1px solid var(--flock-border-subtle)', minHeight: 48 },
        body: { paddingTop: 16 }
      }}
    >
      <Stack gap="sm">
        <TextInput
          label={t('workflow.properties.extractor.pName', 'Parameter Name')}
          placeholder="e.g. city"
          value={paramForm.name}
          disabled={activeParamIndex !== null}
          onChange={(e) => setParamForm({ ...paramForm, name: e.target.value })}
          size="xs"
          required
        />

        <Select
          label={t('workflow.properties.extractor.pType', 'Type')}
          data={[
            { value: 'string', label: 'string' },
            { value: 'number', label: 'number' },
            { value: 'boolean', label: 'boolean' },
            { value: 'array', label: 'array' },
            { value: 'object', label: 'object' },
          ]}
          value={paramForm.type}
          onChange={(v) => setParamForm({ ...paramForm, type: v || 'string' })}
          size="xs"
        />

        <TextInput
          label={t('workflow.properties.extractor.pDesc', 'Description')}
          placeholder="Describe the parameter for the extraction assistant..."
          value={paramForm.description}
          onChange={(e) => setParamForm({ ...paramForm, description: e.target.value })}
          size="xs"
        />

        <Group justify="space-between" mt="xs">
          <Text size="xs" fw={500}>
            {t('workflow.properties.extractor.pRequired', 'Required')}
          </Text>
          <Switch
            checked={paramForm.required}
            onChange={(e) => setParamForm({ ...paramForm, required: e.currentTarget.checked })}
            size="sm"
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button size="xs" variant="subtle" color="gray" onClick={onClose}>
            {t('workflow.common.cancel', 'Cancel')}
          </Button>
          <Button size="xs" color="blue" onClick={onSave}>
            {t('workflow.common.save', 'Save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
