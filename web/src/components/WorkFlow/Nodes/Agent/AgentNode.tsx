import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import React, { useEffect, useState, useMemo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ModelProviderIcon from "@/components/Icons/models";
import ToolsIcon from "@/components/Icons/Tools";
import { GiArchiveResearch } from "react-icons/gi";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const AgentNode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.agent;
  const [providerName, setProviderName] = useState<string>(props.data.model!);
  
  useEffect(() => {
    setProviderName(props.data.model!);
  }, [props.data]);

  const memoizedIcon = useMemo(
    () => (
      <ModelProviderIcon modelprovider_name={providerName} key={providerName} />
    ),
    [providerName]
  );

  const tools = Array.isArray(props.data.tools) ? props.data.tools : [];
  const retrievalTools = Array.isArray(props.data.retrievalTools) ? props.data.retrievalTools : [];

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

      <VStack spacing={2} align="stretch">
        {/* 显示模型信息 */}
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
          {memoizedIcon}
          <Text fontSize="xs" ml={2} color="gray.700" fontWeight="500">
            {props.data.model || "No model selected"}
          </Text>
        </Box>

        {/* 显示工具信息 */}
        {tools.length > 0 ? (
          <VStack align="stretch" spacing={1}>
            <Text fontSize="xs" fontWeight="500" color="gray.600" pl={1}>
              Tools:
            </Text>
            {tools.map((tool: string, index: number) => (
              <Box
                key={`tool-${index}`}
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
            ))}
          </VStack>
        ) : null}

        {/* 显示知识库工具信息 */}
        {retrievalTools.length > 0 ? (
          <VStack align="stretch" spacing={1}>
            <Text fontSize="xs" fontWeight="500" color="gray.600" pl={1}>
              Knowledge Bases:
            </Text>
            {retrievalTools.map((kb: any, index: number) => {
              const kbName = typeof kb === "string" ? kb : kb.name;
              
              return (
                <Box
                  key={`kb-${index}`}
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
                    <Box as={GiArchiveResearch} size="12px" color="blue.500" />
                    <Text fontSize="xs" fontWeight="500" color="gray.700">
                      {kbName}
                    </Text>
                  </HStack>
                </Box>
              );
            })}
          </VStack>
        ) : null}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(AgentNode, (prevProps, nextProps) => {
  return (
    prevProps.data.model === nextProps.data.model &&
    prevProps.data.label === nextProps.data.label &&
    JSON.stringify(prevProps.data.tools) === JSON.stringify(nextProps.data.tools) &&
    JSON.stringify(prevProps.data.retrievalTools) === JSON.stringify(nextProps.data.retrievalTools)
  );
}); 