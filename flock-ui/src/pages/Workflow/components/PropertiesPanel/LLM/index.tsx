import { NumberInput, Switch, Textarea } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { VariableTextarea } from '../VariableInput';
import { ModelSelect } from '../../../../../components/Common/ModelSelect';

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
      <NumberInput
        label={t('workflow.properties.llm.temperature')}
        value={Number(node.data.temperature ?? 0.7)}
        onChange={(v) => onDataChange(node.id, 'temperature', v)}
        min={0}
        max={2}
        step={0.1}
        decimalScale={1}
        size="xs"
      />
      <NumberInput
        label={t('workflow.properties.llm.topP')}
        value={node.data.top_p != null ? Number(node.data.top_p) : undefined}
        onChange={(v) => onDataChange(node.id, 'top_p', v)}
        min={0}
        max={1}
        step={0.05}
        decimalScale={2}
        placeholder={t('workflow.properties.llm.topPPlaceholder', 'Default')}
        size="xs"
      />
      <NumberInput
        label={t('workflow.properties.llm.frequencyPenalty')}
        value={node.data.frequency_penalty != null ? Number(node.data.frequency_penalty) : undefined}
        onChange={(v) => onDataChange(node.id, 'frequency_penalty', v)}
        min={-2}
        max={2}
        step={0.1}
        decimalScale={1}
        placeholder={t('workflow.properties.llm.penaltyPlaceholder', 'Default')}
        size="xs"
      />
      <NumberInput
        label={t('workflow.properties.llm.presencePenalty')}
        value={node.data.presence_penalty != null ? Number(node.data.presence_penalty) : undefined}
        onChange={(v) => onDataChange(node.id, 'presence_penalty', v)}
        min={-2}
        max={2}
        step={0.1}
        decimalScale={1}
        placeholder={t('workflow.properties.llm.penaltyPlaceholder', 'Default')}
        size="xs"
      />
      <NumberInput
        label={t('workflow.properties.llm.maxTokens')}
        value={node.data.max_tokens != null ? Number(node.data.max_tokens) : undefined}
        onChange={(v) => onDataChange(node.id, 'max_tokens', v)}
        min={1}
        placeholder={t('workflow.properties.llm.maxTokensPlaceholder', 'Default')}
        size="xs"
      />
      <Switch
        label={t('workflow.properties.llm.jsonMode', 'JSON Mode')}
        description={t('workflow.properties.llm.jsonModeDesc', 'Force output to valid JSON')}
        checked={Boolean(node.data.json_mode)}
        onChange={(e) => onDataChange(node.id, 'json_mode', e.currentTarget.checked)}
        size="xs"
      />
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
        placeholder="${start.query}"
        value={String(node.data.userMessage ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'userMessage', val)}
        minRows={3}
        size="xs"
      />
    </>
  );
}
