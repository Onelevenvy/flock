import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ToolsIcon from "@/components/Icons/Tools";
import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

// 定义节点将存储的工具数据类型
interface SavedTool {
  id: number;
  name: string;
  provider: string;
}

const PluginNode: React.FC<NodeProps<{ tool: SavedTool; label: string }>> = (props) => {
  const { colorScheme } = nodeConfig.plugin;
  const providerName = props.data.tool?.provider || "unknown";

  const toolDisplayName = props.data.tool?.name || props.data.label;

  const handleStyle = {
    background: "var(--chakra-colors-ui-wfhandlecolor)",
    width: 8,
    height: 8,
    border: "2px solid white",
    transition: "all 0.2s",
  };

  return (
    <BaseNode
      {...props}
      icon={<ToolsIcon tools_name={providerName} w={6} h={6} />}
      colorScheme={colorScheme}
    >
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
    </BaseNode>
  );
};

export default React.memo(PluginNode, (prevProps, nextProps) => {
  return (
    prevProps.data.label === nextProps.data.label &&
    prevProps.data.tool?.id === nextProps.data.tool?.id
  );
});