import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { IfElseNodeData, IfElseCase } from "../../types";

const IfElseNode: React.FC<NodeProps<IfElseNodeData>> = (props) => {
  const { t } = useTranslation();
  const { icon: Icon, colorScheme } = nodeConfig.ifelse;
  const { cases } = props.data;

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

      <VStack spacing={1} align="stretch">
        {cases.map((caseItem: IfElseCase, index: number) => (
          <Box
            key={caseItem.case_id}
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
              {index === 0 ? "IF" : index === cases.length - 1 ? "ELSE" : "ELIF"}
            </Text>
            <Handle
              type="source"
              position={Position.Right}
              id={caseItem.case_id}
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

export default React.memo(IfElseNode); 