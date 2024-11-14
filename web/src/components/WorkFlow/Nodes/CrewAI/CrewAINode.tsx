import { Tag } from "@chakra-ui/react";
import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { CrewAINodeData } from "../../types";

const CrewAINode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.crewai;
  const data = props.data as CrewAINodeData;

  const handleStyle = {
    background: 'var(--chakra-colors-ui-wfhandlecolor)',
    width: 8,
    height: 8,
    border: '2px solid white',
    transition: 'all 0.2s',
  };

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />

      <Tag
        size="sm"
        alignSelf="center"
        colorScheme={data.process_type === "sequential" ? "blue" : "purple"}
        transition="all 0.2s"
      >
        Agents Type: {data.process_type}
      </Tag>
    </BaseNode>
  );
};

export default React.memo(CrewAINode);
