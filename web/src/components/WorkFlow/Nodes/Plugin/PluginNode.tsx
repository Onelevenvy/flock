import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ToolsIcon from "@/components/Icons/Tools";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const PluginNode: React.FC<NodeProps> = (props) => {
  const { data: skills } = useSkillsQuery();
  const toolName = skills?.data.find((skill) => skill.name === props.data.toolName)?.display_name || props.data.toolName;
  const { colorScheme } = nodeConfig.plugin;

  const handleStyle = {
    background: 'var(--chakra-colors-ui-wfhandlecolor)',
    width: 8,
    height: 8,
    border: '2px solid white',
    transition: 'all 0.2s',
  };

  return (
    <BaseNode
      {...props}
      icon={<ToolsIcon tools_name={toolName.replace(/ /g, "_")} w={6} h={6} />}
      colorScheme={colorScheme}
    >
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
    </BaseNode>
  );
};

export default React.memo(PluginNode);
