import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { HumanNodeData } from "../../types";

const HumanNode: React.FC<NodeProps<HumanNodeData>> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.human;
  const { interaction_type } = props.data;

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
          <Text fontSize="xs" color="gray.700" fontWeight="500">
            {interaction_type === "HUMAN_NODE_APPROVAL"
              ? "Approval"
              : "Feedback"}
          </Text>
        </Box>
      </VStack>
    </BaseNode>
  );
};

export default React.memo(HumanNode);
