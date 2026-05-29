import { TextInput, ActionIcon, Button, Group, Divider, Stack } from '@mantine/core';
import { ModelSelect } from '../../../../../components/Common/ModelSelect';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextInput, VariableTextarea } from '../VariableInput';

export interface ParameterExtractorFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

export function ParameterExtractorFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
}: ParameterExtractorFieldsProps) {
  const { t } = useTranslation();
  const parameters = (node.data.parameters as { name: string; type: string; description: string; required: boolean }[]) ?? [];

  return (
    <>
      <ModelSelect
        label={t('workflow.properties.llm.model')}
        placeholder={t('workflow.properties.llm.modelPlaceholder')}
        data={modelOptions}
        disabled={modelsLoading}
        value={String(node.data.model ?? '')}
        onChange={(v) => onDataChange(node.id, 'model', v)}
        searchable
        clearable
        size="xs"
      />
      <VariableTextInput
        label={t('workflow.properties.extractor.input')}
        placeholder=""
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />
      <VariableTextarea
        label={t('workflow.properties.extractor.instruction')}
        value={String(node.data.instruction ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'instruction', val)}
        minRows={2}
        size="xs"
      />
      <Divider label={t('workflow.properties.extractor.parameters')} labelPosition="center" />
      <Stack gap={4}>
        {parameters.map((p, i) => (
          <Group key={i} gap={4} align="flex-start">
            <Stack gap={2} style={{ flex: 1 }}>
              <TextInput
                placeholder={t('workflow.properties.extractor.paramName')}
                value={p.name}
                onChange={(e) => {
                  const next = [...parameters];
                  next[i] = { ...p, name: e.target.value };
                  onDataChange(node.id, 'parameters', next);
                }}
                size="xs"
              />
            </Stack>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              mt={4}
              onClick={() => {
                onDataChange(node.id, 'parameters', parameters.filter((_, idx) => idx !== i));
              }}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            onDataChange(node.id, 'parameters', [
              ...parameters,
              { name: '', type: 'string', description: '', required: false },
            ]);
          }}
        >
          {t('workflow.properties.extractor.addParam')}
        </Button>
      </Stack>
    </>
  );
}
