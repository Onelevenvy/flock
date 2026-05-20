import { type Node } from 'reactflow';
import { Select, NumberInput, MultiSelect, Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { VariableTextarea } from './VariableInput';

export interface FieldsProps {
  node: Node;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export interface ModelFieldsProps extends FieldsProps {
  modelOptions: any[];
  modelsLoading: boolean;
}

export function LLMFields({ node, onDataChange, modelOptions, modelsLoading }: ModelFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
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

export interface AgentFieldsProps extends ModelFieldsProps {
  toolOptions: any[];
  toolsLoading: boolean;
}

export function AgentFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: AgentFieldsProps) {
  const { t } = useTranslation();
  const tools = (node.data.tools as string[]) ?? [];

  return (
    <>
      <LLMFields
        node={node}
        onDataChange={onDataChange}
        modelOptions={modelOptions}
        modelsLoading={modelsLoading}
      />
      <Divider label={t('workflow.properties.agent.tools')} labelPosition="center" />
      <MultiSelect
        label={t('workflow.properties.agent.toolsSelect')}
        placeholder={t('workflow.properties.agent.toolsPlaceholder')}
        data={toolOptions}
        disabled={toolsLoading}
        value={tools}
        onChange={(v) => onDataChange(node.id, 'tools', v)}
        searchable
        clearable
        size="xs"
      />
    </>
  );
}
