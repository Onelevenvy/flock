import { Group, Stack, TextInput, ActionIcon, Badge, Button, Divider } from '@mantine/core';
import { ModelSelect } from '@/components/Common/ModelSelect';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { VariableTextInput } from '@/pages/Workflow/PropertiesPanel/VariableInput';

export interface ClassifierNodePropertiesProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

export function ClassifierNodeProperties({ node, onDataChange, modelOptions, modelsLoading }: ClassifierNodePropertiesProps) {
  const { t } = useTranslation();
  const categories = (node.data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <>
      <VariableTextInput
        label={t('workflow.properties.classifier.input')}
        placeholder=""
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />
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
      <Divider label={t('workflow.properties.classifier.categories')} labelPosition="center" />
      <Stack gap={4}>
        {categories.map((cat, i) => (
          <Group key={cat.category_id} gap={4}>
            <TextInput
              placeholder={t('workflow.properties.classifier.categoryName')}
              value={cat.category_name}
              onChange={(e) => {
                const next = [...categories];
                next[i] = { ...cat, category_name: e.target.value };
                onDataChange(node.id, 'categories', next);
              }}
              size="xs"
              style={{ flex: 1 }}
              disabled={cat.category_id === 'others_category'}
            />
            {cat.category_id !== 'others_category' && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  const next = categories.filter((_, idx) => idx !== i);
                  onDataChange(node.id, 'categories', next);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
            {cat.category_id === 'others_category' && (
              <Badge size="xs" variant="light" color="gray">Others</Badge>
            )}
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            const others = categories.filter((c) => c.category_id === 'others_category');
            const rest = categories.filter((c) => c.category_id !== 'others_category');
            onDataChange(node.id, 'categories', [
              ...rest,
              { category_id: uuidv4(), category_name: '' },
              ...others,
            ]);
          }}
        >
          {t('workflow.properties.classifier.addCategory')}
        </Button>
      </Stack>
    </>
  );
}
