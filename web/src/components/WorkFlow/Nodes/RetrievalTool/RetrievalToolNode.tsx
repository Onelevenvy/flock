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

      <VStack align="stretch" spacing={1}>
        {knowledgeBases.length > 0 ? (
          knowledgeBases.map((kb: string | KBInfo, index: number) => {
            const kbName = typeof kb === "string" ? kb : kb.name;

            return (
              <Box
                key={index}
                bg="ui.inputbgcolor"
                borderRadius="md"
                p={2}
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  transform: "translateY(-1px)",
                  boxShadow: "sm",
                }}
              >
                <HStack spacing={2} px={2} align="center">
                  <IconButton
                    aria-label="db"
                    icon={<GiArchiveResearch size="16px" />}
                    colorScheme="blue"
                    size="xs"
                    variant="ghost"
                    transition="all 0.2s"
                    _hover={{
                      transform: "scale(1.1)",
                    }}
                  />
                  <Text
                    fontSize="xs"
                    fontWeight="500"
                    color="gray.700"
                    noOfLines={1}
                  >
                    {kbName}
                  </Text>
                </HStack>
              </Box>
            );
          })
        ) : (
          <Text
            fontSize="xs"
            color="gray.500"
            textAlign="center"
            fontWeight="500"
          >
            No knowledge bases selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(RetrievalToolNode);
