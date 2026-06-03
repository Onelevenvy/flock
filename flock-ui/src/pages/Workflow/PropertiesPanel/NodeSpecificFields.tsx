import { type Node } from 'reactflow';
import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { type NodeType } from '@/pages/Workflow/nodeConfig';
import { nodePropertiesMap } from '../nodes/propertiesMap';

interface NodeSpecificFieldsProps {
  node: Node;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
  toolOptions: any[];
  toolsLoading: boolean;
}

export function NodeSpecificFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: NodeSpecificFieldsProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;

  if (type === 'end') {
    return (
      <Text size="xs" c="dimmed" ta="center" py="sm">
        {t('workflow.properties.noConfig')}
      </Text>
    );
  }

  const PropertiesComponent = nodePropertiesMap[type];
  if (!PropertiesComponent) return null;

  return (
    <PropertiesComponent
      node={node}
      onDataChange={onDataChange}
      modelOptions={modelOptions}
      modelsLoading={modelsLoading}
      toolOptions={toolOptions}
      toolsLoading={toolsLoading}
    />
  );
}
