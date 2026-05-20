import { MultiSelect, Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LLMFields } from '../LLM';

export interface AgentFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
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
