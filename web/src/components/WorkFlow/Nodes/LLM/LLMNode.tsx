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

  // 使用 useMemo 来缓存 ModelProviderIcon，只有当 providerName 变化时才重新创建
  const memoizedIcon = useMemo(
    () => (
      <ModelProviderIcon modelprovider_name={providerName} key={providerName} />
    ),
    [providerName]
  );

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <VStack spacing={1}>
        <Box
          bg="#f2f4f7"
          borderRadius={"md"}
          w="full"
          p="2"
          display={"flex"}
          flexDirection={"row"}
          justifyContent={"center"}
          alignContent={"center"}
        >
          {memoizedIcon}
          <Text fontSize="xs" ml={2}>
            {props.data.model || "No model selected"}
          </Text>
        </Box>
      </VStack>
    </BaseNode>
  );
};

// 使用 React.memo 并提供自定义的比较函数
export default React.memo(LLMNode, (prevProps, nextProps) => {
  return (
    prevProps.data.modelprovider_name === nextProps.data.modelprovider_name &&
    prevProps.data.model === nextProps.data.model
  );
});
