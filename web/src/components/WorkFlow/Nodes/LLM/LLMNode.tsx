import { Box, Text, VStack } from "@chakra-ui/react";
import React, { useEffect, useState, useMemo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ModelProviderIcon from "@/components/Icons/models";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

const { icon: Icon, colorScheme } = nodeConfig.llm;

const LLMNode: React.FC<NodeProps> = (props) => {
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
          {memoizedIcon}
          <Text fontSize="xs" ml={2} color="gray.700" fontWeight="500">
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
    prevProps.data.model === nextProps.data.model &&
    prevProps.data.label === nextProps.data.label
  );
});
