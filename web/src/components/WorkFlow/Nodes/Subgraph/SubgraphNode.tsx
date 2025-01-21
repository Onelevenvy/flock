import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { Box, VStack, Text } from "@chakra-ui/react";

const SubgraphNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.subgraph;

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
      <VStack spacing={1}>
        <Box
          bg="ui.inputbgcolor"
          borderRadius="md"
          w="full"
          p="2"
          display="flex"
          flexDirection="row"
          justifyContent="center"
          alignItems="center"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
          }}
        >
          <Text fontSize="xs" ml={2} color="gray.700" fontWeight="500">
            {props.data.description || "No description"}
          </Text>
        </Box>
      </VStack>
    </BaseNode>
  );
};

export default React.memo(SubgraphNode);
