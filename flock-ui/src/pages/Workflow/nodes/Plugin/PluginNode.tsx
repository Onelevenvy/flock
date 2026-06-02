import React, { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseWorkflowNode } from '../BaseWorkflowNode';
import { type BaseNodeData } from '../types';
import { ToolsIcon } from '@/components/Common/Icons';
import { useAvailableTools } from '@/hooks/useAvailableTools';

export const PluginNode = memo((props: NodeProps<BaseNodeData>) => {
  const { tools: availableTools, providers: availableProviders } = useAvailableTools();

  const toolIcon = useMemo(() => {
    const toolData = props.data.tool as { name?: string } | undefined;
    if (toolData?.name) {
      const tool = availableTools.find((t) => t.name === toolData.name);
      if (tool) {
        const provider = availableProviders.find((p) => p.id === tool.provider_id);
        return provider?.icon || '';
      }
    }
    return '';
  }, [props.data.tool, availableTools, availableProviders]);

  const customIcon = toolIcon ? <ToolsIcon name={toolIcon} size={14} /> : undefined;

  return <BaseWorkflowNode {...props} type="plugin" customIcon={customIcon} />;
});
PluginNode.displayName = 'PluginNode';
