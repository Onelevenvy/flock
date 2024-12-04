import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import { Box, Text } from "@chakra-ui/react";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const CodeNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.code;

  const handleStyle = {
    background: "var(--chakra-colors-ui-wfhandlecolor)",
    width: 8,
    height: 8,
    border: "2px solid white",
    transition: "all 0.2s",
  };

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={handleStyle}
      />

      <Box
        bg="ui.inputbgcolor"
        borderRadius="md"
        p={2}
        mt={2}
        transition="all 0.2s"
        _hover={{
          bg: "gray.100",
        }}
      >
        <Text fontSize="xs" color="gray.600" fontFamily="mono" noOfLines={2}>
          {props.data.code || "// 无代码"}
        </Text>
      </Box>
    </BaseNode>
  );
};

export default React.memo(CodeNode); 