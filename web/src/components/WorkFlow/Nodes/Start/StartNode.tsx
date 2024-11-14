import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const StartNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.start;

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
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

export default React.memo(StartNode);
