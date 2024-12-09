import { Box, Button, HStack, IconButton, Select, Text, VStack, Input } from "@chakra-ui/react";
import React, { useCallback, useEffect } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { RiLoopLeftLine } from "react-icons/ri";
import { v4 as uuidv4 } from "uuid";

import { VariableReference } from "../../FlowVis/variableSystem";
import { ComparisonOperator, LogicalOperator, IfElseCase } from "../../types";
import ConditionOperator from "./components/ConditionOperator";

interface IfElseNodePropertiesProps {
  node: {
    id: string;
    data: {
      cases: IfElseCase[];
    };
  };
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const IfElseNodeProperties: React.FC<IfElseNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {

  // 确保初始状态有 IF 和 ELSE
  useEffect(() => {
    if (!node.data.cases || node.data.cases.length < 2) {
      const initialCases = [
        {
          case_id: uuidv4(),
          logical_operator: LogicalOperator.and,
          conditions: [],
        },
        {
          case_id: "false", // ELSE 分支固定 ID
          logical_operator: LogicalOperator.and,
          conditions: [],
        },
      ];
      onNodeDataChange(node.id, "cases", initialCases);
    }
  }, [node.id, node.data.cases, onNodeDataChange]);

  // 添加 ELIF case
  const handleAddCase = useCallback(() => {
    const newCases = [...(node.data.cases || [])];
    // 找到 ELSE 分支的位置
    const elseCaseIndex = newCases.findIndex((c) => c.case_id === "false");
    if (elseCaseIndex === -1) return; // 如果没有找到 ELSE，不添加

    // 在 ELSE 之前插入新的 ELIF
    newCases.splice(elseCaseIndex, 0, {
      case_id: uuidv4(),
      logical_operator: LogicalOperator.and,
      conditions: [],
    });
    
    onNodeDataChange(node.id, "cases", newCases);
  }, [node.id, node.data.cases, onNodeDataChange]);

  // Add condition to a case
  const handleAddCondition = useCallback(
    (caseId: string) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            conditions: [
              ...(caseItem.conditions || []),
              {
                id: uuidv4(),
                variable_selector: [],
                comparison_operator: ComparisonOperator.equal,
                value: "",
              },
            ],
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  const handleVariableSelect = useCallback(
    (caseId: string, conditionId: string, value: string) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            conditions: (caseItem.conditions || []).map((condition) =>
              condition.id === conditionId
                ? {
                    ...condition,
                    variable_selector: value.split("."),
                  }
                : condition
            ),
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  const handleOperatorChange = useCallback(
    (caseId: string, conditionId: string, operator: ComparisonOperator) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            conditions: (caseItem.conditions || []).map((condition) =>
              condition.id === conditionId
                ? { ...condition, comparison_operator: operator }
                : condition
            ),
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  const handleValueSelect = useCallback(
    (caseId: string, conditionId: string, value: string) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            conditions: (caseItem.conditions || []).map((condition) =>
              condition.id === conditionId
                ? { ...condition, value }
                : condition
            ),
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  // Toggle AND/OR operator
  const handleToggleLogicalOperator = useCallback(
    (caseId: string) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            logical_operator:
              caseItem.logical_operator === LogicalOperator.and
                ? LogicalOperator.or
                : LogicalOperator.and,
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  // 添加删除条件的处理函数
  const handleRemoveCondition = useCallback(
    (caseId: string, conditionId: string) => {
      const newCases = node.data.cases.map((caseItem) => {
        if (caseItem.case_id === caseId) {
          return {
            ...caseItem,
            conditions: caseItem.conditions.filter((c) => c.id !== conditionId),
          };
        }
        return caseItem;
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  // 删除 case
  const handleRemoveCase = useCallback(
    (caseId: string) => {
      const newCases = node.data.cases.filter((c) => {
        // 保留 IF (第一个) 和 ELSE (最后一个)
        if (c.case_id === node.data.cases[0].case_id) return true; // 保留 IF
        if (c.case_id === "false") return true; // 保留 ELSE
        return c.case_id !== caseId; // 删除指定的 ELIF
      });
      onNodeDataChange(node.id, "cases", newCases);
    },
    [node.id, node.data.cases, onNodeDataChange]
  );

  return (
    <VStack spacing={4} align="stretch">
      {(node.data.cases || []).map((caseItem, index) => {
        const isElse = caseItem.case_id === "false";
        const isFirst = index === 0;
        const isLast = index === node.data.cases.length - 1;
        const conditions = caseItem.conditions || [];

        return (
          <Box
            key={caseItem.case_id}
            p={4}
            bg="ui.inputbgcolor"
            borderRadius="lg"
            borderLeft="3px solid"
            borderLeftColor="blue.400"
          >
            <HStack justify="space-between" mb={2}>
              <HStack>
                <Text fontWeight="500" color="gray.700">
                  {isFirst ? "IF" : isLast ? "ELSE" : "ELIF"}
                </Text>
                {isLast && (
                  <Text fontSize="sm" color="gray.500" ml={2}>
                    用于定义当 if 条件不满足时应执行的逻辑
                  </Text>
                )}
              </HStack>
              {!isFirst && !isLast && (
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

            {!isElse && (
              <>
                {conditions.map((condition) => (
                  <Box key={condition.id} mb={4}>
                    <HStack spacing={2} mb={2}>
                      <Select
                        placeholder="Select variable"
                        value={condition.variable_selector?.join(".")}
                        onChange={(e) => handleVariableSelect(caseItem.case_id, condition.id, e.target.value)}
                      >
                        {availableVariables.map((v) => (
                          <option
                            key={`${v.nodeId}.${v.variableName}`}
                            value={`${v.nodeId}.${v.variableName}`}
                          >
                            {v.nodeId}.{v.variableName}
                          </option>
                        ))}
                      </Select>
                      <ConditionOperator
                        value={condition.comparison_operator}
                        onSelect={(value) => handleOperatorChange(caseItem.case_id, condition.id, value)}
                      />
                      <IconButton
                        aria-label="Remove condition"
                        icon={<FaTrash />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleRemoveCondition(caseItem.case_id, condition.id)}
                      />
                    </HStack>

                    <HStack spacing={2}>
                      <Select
                        w="120px"
                        value={condition.compareType || "constant"}
                        onChange={(e) => {
                          const newCases = node.data.cases.map((c) => {
                            if (c.case_id === caseItem.case_id) {
                              return {
                                ...c,
                                conditions: c.conditions.map((cond) =>
                                  cond.id === condition.id
                                    ? { ...cond, compareType: e.target.value, value: "" }
                                    : cond
                                ),
                              };
                            }
                            return c;
                          });
                          onNodeDataChange(node.id, "cases", newCases);
                        }}
                      >
                        <option value="constant">Constant</option>
                        <option value="variable">Variable</option>
                      </Select>

                      {condition.compareType === "variable" ? (
                        <Select
                          placeholder="Select variable"
                          value={condition.value as string}
                          onChange={(e) => handleValueSelect(caseItem.case_id, condition.id, e.target.value)}
                        >
                          {availableVariables.map((v) => (
                            <option
                              key={`${v.nodeId}.${v.variableName}`}
                              value={`${v.nodeId}.${v.variableName}`}
                            >
                              {v.nodeId}.{v.variableName}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          placeholder="Enter constant value"
                          value={condition.value as string}
                          onChange={(e) => handleValueSelect(caseItem.case_id, condition.id, e.target.value)}
                        />
                      )}
                    </HStack>
                  </Box>
                ))}

                {conditions.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    rightIcon={<RiLoopLeftLine />}
                    onClick={() => handleToggleLogicalOperator(caseItem.case_id)}
                    mb={2}
                  >
                    {caseItem.logical_operator.toUpperCase()}
                  </Button>
                )}

                <Button
                  size="sm"
                  leftIcon={<FaPlus />}
                  onClick={() => handleAddCondition(caseItem.case_id)}
                  mt={2}
                >
                  Add Condition
                </Button>
              </>
            )}
          </Box>
        );
      })}

      <Button
        leftIcon={<FaPlus />}
        onClick={handleAddCase}
        colorScheme="blue"
        variant="ghost"
        size="sm"
      >
        Add ELIF Case
      </Button>
    </VStack>
  );
};

export default IfElseNodeProperties;
