import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const EndNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.end;

  const handleStyle = {
    background: 'var(--chakra-colors-ui-wfhandlecolor)',
    width: 8,
    height: 8,
    border: '2px solid white',
    transition: 'all 0.2s',
  };

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        style={handleStyle}
      />
    </BaseNode>
  );
};

export default React.memo(EndNode);
