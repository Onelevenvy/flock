import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback, useRef } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { IfElseNodeData, IfElseCase } from "../../types";

interface IfElseNodePropertiesProps {
  node: {
    id: string;
    data: IfElseNodeData;
  };
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const IfElseNodeProperties: React.FC<IfElseNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [showVars, setShowVars] = React.useState(false);

  const handleAddCase = useCallback(() => {
    const newCases = [...(node.data.cases || [])];
    newCases.push({
      case_id: uuidv4(),
      condition: "",
      output: "",
    });
    onNodeDataChange(node.id, "cases", newCases);
  }, [node.id, node.data.cases, onNodeDataChange]);

  const handleRemoveCase = useCallback(
    (caseId: string) => {
      const newCases = node.data.cases.filter((c: IfElseCase) => c.case_id !== caseId);
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  const handleCaseChange = useCallback(
    (caseId: string, key: string, value: string) => {
      const newCases = node.data.cases.map((c: IfElseCase) =>
        c.case_id === caseId ? { ...c, [key]: value } : c
      );
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  return (
    <VStack spacing={4} align="stretch">
      {node.data.cases?.map((caseItem: IfElseCase, index: number) => (
        <Box
          key={caseItem.case_id}
          p={4}
          bg="ui.inputbgcolor"
          borderRadius="lg"
          borderLeft="3px solid"
          borderLeftColor="blue.400"
        >
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="500" color="gray.700">
              {index === 0
                ? t("workflow.nodes.ifelse.if")
                : index === node.data.cases.length - 1
                ? t("workflow.nodes.ifelse.else")
                : t("workflow.nodes.ifelse.elif")}
            </Text>
            {index !== 0 && (
              <IconButton
                aria-label="Remove case"
                icon={<FaTrash />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => handleRemoveCase(caseItem.case_id)}
              />
            )}
          </HStack>

          <VariableSelector
            label={t("workflow.nodes.ifelse.condition")}
            value={caseItem.condition}
            onChange={(value) =>
              handleCaseChange(caseItem.case_id, "condition", value)
            }
            showVariables={showVars}
            setShowVariables={setShowVars}
            inputRef={textAreaRef}
            handleKeyDown={() => {}}
            insertVariable={() => {}}
            availableVariables={availableVariables}
          />
        </Box>
      ))}

      <Button
        leftIcon={<FaPlus />}
        onClick={handleAddCase}
        colorScheme="blue"
        variant="ghost"
        size="sm"
      >
        {t("workflow.nodes.ifelse.addCase")}
      </Button>
    </VStack>
  );
};

export default IfElseNodeProperties;
