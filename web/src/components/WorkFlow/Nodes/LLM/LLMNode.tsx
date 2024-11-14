import { Box, Text, VStack } from "@chakra-ui/react";
import React, { useEffect, useState, useMemo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ModelProviderIcon from "@/components/Icons/models";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const { icon: Icon, colorScheme } = nodeConfig.llm;

const LLMNode: React.FC<NodeProps> = (props) => {
  const [providerName, setProviderName] = useState<string>(props.data.model);

  useEffect(() => {
    setProviderName(props.data.model);
  }, [props.data]);

  const memoizedIcon = useMemo(
    () => (
      <ModelProviderIcon modelprovider_name={providerName} key={providerName} />
    ),
    [providerName]
  );

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        style={{
          background: '#3182CE',  // theme 中的 blue.500
          width: 8,
          height: 8,
          border: '2px solid white',
          transition: 'all 0.2s',
        }}
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right"
        style={{
          background: '#3182CE',
          width: 8,
          height: 8,
          border: '2px solid white',
          transition: 'all 0.2s',
        }}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left"
        style={{
          background: '#3182CE',
          width: 8,
          height: 8,
          border: '2px solid white',
          transition: 'all 0.2s',
        }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
        style={{
          background: '#3182CE',
          width: 8,
          height: 8,
          border: '2px solid white',
          transition: 'all 0.2s',
        }}
      />
      <VStack spacing={1}>
        <Box
          bg="gray.50"
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
          <Text 
            fontSize="xs" 
            ml={2}
            color="gray.700"
            fontWeight="500"
          >
            {props.data.model || "No model selected"}
          </Text>
        </Box>
      </VStack>
    </BaseNode>
  );
};

export default React.memo(LLMNode, (prevProps, nextProps) => {
  return (
    prevProps.data.modelprovider_name === nextProps.data.modelprovider_name &&
    prevProps.data.model === nextProps.data.model
  );
});
