import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { HumanNodeData } from "../../types";

const HumanNode: React.FC<NodeProps<HumanNodeData>> = (props) => {
  const { t } = useTranslation();
  const { icon: Icon, colorScheme } = nodeConfig.human;
  const { interaction_type } = props.data;

  const handleStyle = {
    background: "var(--chakra-colors-ui-wfhandlecolor)",
    width: 8,
    height: 8,
    border: "2px solid white",
    transition: "all 0.2s",
  };

  const getInteractionTypeLabel = () => {
    switch (interaction_type) {
      case "tool_review":
        return t("workflow.nodes.human.types.toolReview");
      case "output_review":
        return t("workflow.nodes.human.types.outputReview");
      case "context_input":
        return t("workflow.nodes.human.types.contextInput");
      default:
        return interaction_type;
    }
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
          <Text fontSize="xs" color="gray.700" fontWeight="500">
            {getInteractionTypeLabel()}
          </Text>
        </Box>
      </VStack>
    </BaseNode>
  );
};

export default React.memo(HumanNode);
