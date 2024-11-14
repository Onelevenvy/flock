import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import React from "react";
import { ImFolderOpen } from "react-icons/im";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const RetrievalNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.retrieval;
  const selectedDatabase = props.data.knownledge_database?.[0] || null;

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

      <VStack spacing={1} align="stretch">
        {selectedDatabase ? (
          <HStack
            justifyContent="center"
            alignItems="center"
            bg="ui.inputbgcolor"
            borderRadius="md"
            p={2}
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
              transform: "translateY(-1px)",
            }}
          >
            <Box
              as={ImFolderOpen}
              color="teal.500"
              transition="all 0.2s"
              _hover={{
                transform: "scale(1.1)",
              }}
            />
            <Text fontSize="xs" fontWeight="500" color="gray.700" noOfLines={1}>
              {selectedDatabase}
            </Text>
          </HStack>
        ) : (
          <Text
            fontSize="xs"
            textAlign="center"
            color="gray.500"
            fontWeight="500"
          >
            No knowledge base selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(RetrievalNode);
