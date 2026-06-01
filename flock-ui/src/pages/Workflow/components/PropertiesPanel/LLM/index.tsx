import { Group, Input, Textarea } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { VariableTextarea } from '@/pages/Workflow/components/PropertiesPanel/VariableInput';
import { ModelSelect } from '@/components/Common/ModelSelect';
import { ModelSettingsPopover } from './ModelSettingsPopover';

export interface ModelFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

export function LLMFields({ node, onDataChange, modelOptions, modelsLoading }: ModelFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Input.Wrapper label={t('workflow.properties.llm.model')} size="xs">
        <Group gap="xs" style={{ width: '100%', flexWrap: 'nowrap' }} align="flex-end">
          <div style={{ flex: 1 }}>
            <ModelSelect
              placeholder={t('workflow.properties.llm.modelPlaceholder')}
              data={modelOptions}
              disabled={modelsLoading}
              value={String(node.data.model ?? '')}
              onChange={(v) => {
                onDataChange(node.id, 'model', v);
                const allItems = modelOptions.flatMap((d: any) => d.items ? d.items : [d]);
                const matched = allItems.find(item => item.value === v);
                if (matched?.providerName) {
                  onDataChange(node.id, 'provider', matched.providerName);
                }
              }}
              searchable
              clearable
              size="xs"
            />
          </div>
          <ModelSettingsPopover
            node={node}
            onDataChange={onDataChange}
            modelOptions={modelOptions}
            modelsLoading={modelsLoading}
          />
        </Group>
      </Input.Wrapper>

      {node.data.json_mode && (
        <Textarea
          label={t('workflow.properties.llm.jsonSchema', 'JSON Schema')}
          placeholder={t('workflow.properties.llm.jsonSchemaPlaceholder', '{"type":"object","properties":{...}}')}
          value={typeof node.data.json_schema === 'string' ? node.data.json_schema : JSON.stringify(node.data.json_schema ?? '', null, 2)}
          onChange={(e) => {
            const val = e.target.value;
            try {
              onDataChange(node.id, 'json_schema', JSON.parse(val));
            } catch {
              onDataChange(node.id, 'json_schema', val);
            }
          }}
          minRows={3}
          size="xs"
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 } }}
        />
      )}

      <VariableTextarea
        label={t('workflow.properties.llm.systemPrompt')}
        placeholder={t('workflow.properties.llm.systemPromptPlaceholder')}
        value={String(node.data.systemMessage ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'systemMessage', val)}
        minRows={3}
        size="xs"
      />

      <VariableTextarea
        label={t('workflow.properties.llm.userPrompt')}
        placeholder=""
        value={String(node.data.userMessage ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'userMessage', val)}
        minRows={3}
        size="xs"
      />
    </>
  );
}

