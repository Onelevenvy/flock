import { Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LLMFields } from '../LLM';
import ToolList from '../../../../../components/Common/ToolList';

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
      <ToolList
        value={tools}
        onChange={(v) => onDataChange(node.id, 'tools', v)}
        disabled={toolsLoading}
        selectorPosition="bottom-end"
      />
    </>
  );
}
