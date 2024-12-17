import React, { useEffect } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { IfElseNodeData, IfElseCase } from "../../types";

const IfElseNode: React.FC<NodeProps<IfElseNodeData>> = (props) => {
  const { t } = useTranslation();
  const { icon: Icon, colorScheme } = nodeConfig.ifelse;
  const { cases } = props.data;
  const updateNodeInternals = useUpdateNodeInternals();

  // 当 cases 改变时更新节点内部状态
  useEffect(() => {
    updateNodeInternals(props.id);
  }, [props.id, cases, updateNodeInternals]);

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
        {cases.map((caseItem: IfElseCase) => (
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
              {caseItem.case_id === cases[cases.length - 1].case_id 
                ? "ELSE" 
                : caseItem.case_id === cases[0].case_id 
                  ? "IF" 
                  : "ELIF"}
            </Text>
            <Handle
              type="source"
              position={Position.Right}
              id={caseItem.case_id}
              style={handleStyle}
            />
          </Box>
        ))}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(IfElseNode); 