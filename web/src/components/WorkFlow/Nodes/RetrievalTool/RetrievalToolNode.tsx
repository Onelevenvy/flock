import { Box, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { GiArchiveResearch } from "react-icons/gi";
import { Handle, type NodeProps, Position } from "reactflow";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";


interface KBInfo {
  name: string;
  description: string;
  usr_id: number;
  kb_id: number;
}

const RetrievalToolNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.toolretrieval;
  const knowledgeBases = Array.isArray(props.data.tools)
    ? props.data.tools
    : [];

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />

      <VStack align="stretch" spacing={1}>
        {knowledgeBases.length > 0 ? (
          knowledgeBases.map((kb: string | KBInfo, index: number) => {
            const kbName = typeof kb === 'string' ? kb : kb.name;

            return (
              <HStack key={index} justifyContent="center" justifyItems={"center"}>
                <Box bg="#f2f4f7" borderRadius="md" w="full" p="1">
                  <HStack spacing={"2"}>
                  <IconButton
                    aria-label="db"
                    icon={<GiArchiveResearch size={"16px"} />}
                    colorScheme={"pink"}
                    size="xs"
                  />
                    <Text fontWeight={"bold"}>{kbName}</Text>
                  </HStack>
                </Box>
              </HStack>
            );
          })
        ) : (
          <Text fontSize="xs" textAlign="center">
            No knowledge bases selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(RetrievalToolNode);
