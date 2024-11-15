import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ToolsIcon from "@/components/Icons/Tools";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const ToolNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.tool;
  const tools = Array.isArray(props.data.tools) ? props.data.tools : [];

  const handleStyle = {
    background: "var(--chakra-colors-ui-wfhandlecolor)",
    width: 8,
    height: 8,
    border: "2px solid white",
    transition: "all 0.2s",
    // top: "30px",
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
        {tools.length > 0 ? (
          tools.map((tool: string, index: number) => (
            <Box
              key={index}
              bg="ui.inputbgcolor"
              borderRadius="md"
              p={1}
              transition="all 0.2s"
              _hover={{
                bg: "gray.100",
                transform: "translateY(-1px)",
                boxShadow: "sm",
              }}
            >
              <HStack spacing={2} px={2}>
                <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                <Text fontSize="xs" fontWeight="500" color="gray.700">
                  {tool}
                </Text>
              </HStack>
            </Box>
          ))
        ) : (
          <Text
            fontSize="xs"
            color="gray.500"
            textAlign="center"
            fontWeight="500"
          >
            No tools selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(ToolNode);
