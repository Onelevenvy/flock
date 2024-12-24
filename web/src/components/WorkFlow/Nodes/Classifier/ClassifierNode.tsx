import React, { useEffect, useMemo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { ClassifierNodeData } from "../../types";
import ModelProviderIcon from "@/components/Icons/models";

const ClassifierNode: React.FC<NodeProps<ClassifierNodeData>> = (props) => {
  const { t } = useTranslation();
  const { icon: Icon, colorScheme } = nodeConfig.classifier;
  const { categories } = props.data;

  const handleStyle = {
    background: "var(--chakra-colors-ui-wfhandlecolor)",
    width: 8,
    height: 8,
    border: "2px solid white",
    transition: "all 0.2s",
  };

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

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={handleStyle}
      />

      <VStack spacing={1} align="stretch">
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
        {categories.map((category, index) => (
          <Box
            key={category.category_id}
            position="relative"
            bg="ui.inputbgcolor"
            p={1}
            borderRadius="md"
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          >
            <Text fontSize="xs" fontWeight="500">
              {category.category_id === "others_category"
                ? `${t("workflow.nodes.classifier.category")} ${index + 1}: ${t(
                    "workflow.nodes.classifier.othersCategory"
                  )}`
                : `${t("workflow.nodes.classifier.category")} ${index + 1}: ${
                    category.category_name ||
                    t("workflow.nodes.classifier.untitled")
                  }`}
            </Text>
            <Handle
              type="source"
              position={Position.Right}
              id={category.category_id}
              style={{
                ...handleStyle,
                right: -8,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
          </Box>
        ))}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(ClassifierNode);
