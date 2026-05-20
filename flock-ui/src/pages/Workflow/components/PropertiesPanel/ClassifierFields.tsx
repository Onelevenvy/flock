import { Group, Box, Text, Stack, TextInput, ActionIcon, Badge, Button, Select } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { VariableTextInput } from './VariableInput';
import { type ModelFieldsProps } from './LLMFields';

export function ClassifierFields({ node, onDataChange, modelOptions, modelsLoading }: ModelFieldsProps) {
  const { t } = useTranslation();
  const categories = (node.data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <>
      <VariableTextInput
        label={t('workflow.properties.classifier.input')}
        placeholder="${start.query}"
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />
      <Select
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
      <DividerWithLabel label={t('workflow.properties.classifier.categories')} />
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

// 辅助组件，因为 Divider 常用
import { Divider } from '@mantine/core';
function DividerWithLabel({ label }: { label: string }) {
  return <Divider label={label} labelPosition="center" />;
}
