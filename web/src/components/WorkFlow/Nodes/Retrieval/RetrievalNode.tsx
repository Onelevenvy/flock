import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import React from "react";
import { ImFolderOpen } from "react-icons/im";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const RetrievalNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.retrieval;
  const selectedDatabase = props.data.knownledge_database?.[0] || null;

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <VStack spacing={1} align="stretch">
        {selectedDatabase ? (
          <HStack justifyContent="center" justifyItems={"center"}>
            <Box bg="#f2f4f7" borderRadius="md" w="full" p="1">
              <HStack spacing={"2"} ml="2">
                <ImFolderOpen color="#434cf0" />
                <Text fontWeight={"bold"}>{selectedDatabase}</Text>
              </HStack>
            </Box>
          </HStack>
        ) : (
          <Text fontSize="xs" textAlign="center">
            No knowledge base selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(RetrievalNode);
