import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const EndNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.end;

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        style={{
          background: 'var(--chakra-colors-ui-wfhandlecolor)',
          width: 8,
          height: 8,
          border: '2px solid white',
          transition: 'all 0.2s',
        }}
        className="custom-handle"
      />
    </BaseNode>
  );
};

export default React.memo(EndNode);
