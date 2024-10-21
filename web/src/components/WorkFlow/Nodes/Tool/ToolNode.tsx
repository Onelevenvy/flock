import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ToolsIcon from "@/components/Icons/Tools";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const ToolNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.tool;
  const tools = Array.isArray(props.data.tools) ? props.data.tools : [];

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />

      <VStack align="stretch" spacing={1}>
        {tools.length > 0 ? (
          tools.map((tool: string, index: number) => (
            <HStack key={index} justifyContent="center" justifyItems={"center"}>
              <Box bg="#f2f4f7" borderRadius="md" w="full" p="1">
                <HStack spacing={"2"}>
                  <ToolsIcon tools_name={tool.replace(/ /g, "_")} ml="2" />
                  <Text fontWeight={"bold"}> {tool}</Text>
                </HStack>
              </Box>
            </HStack>
          ))
        ) : (
          <Text fontSize="xs" textAlign="center">
            No tools selected
          </Text>
        )}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(ToolNode);
