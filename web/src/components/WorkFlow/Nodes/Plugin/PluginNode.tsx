import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ToolsIcon from "@/components/Icons/Tools";
import { useSkillsQuery } from "@/hooks/useSkillsQuery"; // 新增导入

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const PluginNode: React.FC<NodeProps> = (props) => {
  const { data: skills } = useSkillsQuery(); // 获取工具信息
  // 获取工具名称
  const toolName =
    skills?.data.find((skill) => skill.name === props.data.toolName)
      ?.display_name || props.data.toolName;
  const { colorScheme } = nodeConfig.plugin;

  return (
    <BaseNode
      {...props}
      icon={<ToolsIcon tools_name={toolName.replace(/ /g, "_")} w={6} h={6} />}
      colorScheme={colorScheme}
    >
      <>
        <Handle type="target" position={Position.Left} id="left" />
        <Handle type="target" position={Position.Right} id="right" />
        <Handle type="source" position={Position.Left} id="left" />
        <Handle type="source" position={Position.Right} id="right" />
      </>
    </BaseNode>
  );
};

export default React.memo(PluginNode);
