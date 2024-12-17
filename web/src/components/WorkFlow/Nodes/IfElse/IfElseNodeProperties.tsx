import {
  Box,
  Button,
  HStack,
  IconButton,
  Select,
  Text,
  VStack,
  Input,
} from "@chakra-ui/react";
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
    const newCases = [...node.data.cases];
    const elseCaseIndex = newCases.length - 1;
    
    const newCase: IfElseCase = {
      case_id: uuidv4(),
      logical_operator: LogicalOperator.and,
      conditions: [{
        id: uuidv4(),
        variable_selector: [],
        comparison_operator: ComparisonOperator.equal,
        value: "",
        compareType: "constant" as "constant" | "variable"
      }]
    };
    
    newCases.splice(elseCaseIndex, 0, newCase);
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
                compareType: "constant" as "constant" | "variable"
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
              condition.id === conditionId ? { ...condition, value } : condition
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
    <VStack spacing={4} align="stretch" maxH="600px">
      <Box 
        overflowY="auto" 
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
            background: 'var(--chakra-colors-gray-50)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--chakra-colors-gray-200)',
            borderRadius: '24px',
          },
        }}
      >
        {node.data.cases.slice(0, -1).map((caseItem, index) => (
          <Box
            key={caseItem.case_id}
            p={4}
            bg="white"
            borderRadius="xl"
            boxShadow="sm"
            borderWidth="1px"
            borderColor="gray.200"
            mb={4}
            transition="all 0.2s"
            _hover={{
              boxShadow: "md",
              borderColor: "blue.200",
              transform: "translateY(-1px)",
            }}
          >
            <HStack justify="space-between" mb={3}>
              <HStack spacing={2}>
                <Box
                  bg="blue.50"
                  color="blue.500"
                  px={3}
                  py={1}
                  borderRadius="md"
                  fontSize="sm"
                  fontWeight="600"
                >
                  {index === 0 ? "IF" : "ELIF"}
                </Box>
              </HStack>
              {index > 0 && (
                <IconButton
                  aria-label="Remove case"
                  icon={<FaTrash />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => handleRemoveCase(caseItem.case_id)}
                  transition="all 0.2s"
                  _hover={{
                    transform: "scale(1.1)",
                    bg: "red.50",
                  }}
                />
              )}
            </HStack>

            {caseItem.conditions.map((condition) => (
              <Box 
                key={condition.id} 
                mb={4}
                p={3}
                bg="gray.50"
                borderRadius="lg"
                borderLeft="3px solid"
                borderLeftColor="blue.400"
              >
                <HStack spacing={2} mb={3}>
                  <Select
                    placeholder="Select variable"
                    value={condition.variable_selector?.join(".")}
                    onChange={(e) => handleVariableSelect(caseItem.case_id, condition.id, e.target.value)}
                    bg="white"
                    borderColor="gray.200"
                    _hover={{ borderColor: "blue.200" }}
                    _focus={{
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                    }}
                    flex={1}
                  >
                    {availableVariables.map((v) => (
                      <option key={`${v.nodeId}.${v.variableName}`} value={`${v.nodeId}.${v.variableName}`}>
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
                    transition="all 0.2s"
                    _hover={{
                      transform: "scale(1.1)",
                      bg: "red.50",
                    }}
                  />
                </HStack>

                {condition.comparison_operator !== ComparisonOperator.empty && 
                 condition.comparison_operator !== ComparisonOperator.notEmpty && (
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
                      bg="white"
                      borderColor="gray.200"
                      _hover={{ borderColor: "blue.200" }}
                    >
                      <option value="constant">Constant</option>
                      <option value="variable">Variable</option>
                    </Select>

                    {condition.compareType === "variable" ? (
                      <Select
                        placeholder="Select variable"
                        value={condition.value as string}
                        onChange={(e) => handleValueSelect(caseItem.case_id, condition.id, e.target.value)}
                        flex={1}
                        bg="white"
                        borderColor="gray.200"
                        _hover={{ borderColor: "blue.200" }}
                      >
                        {availableVariables.map((v) => (
                          <option key={`${v.nodeId}.${v.variableName}`} value={`${v.nodeId}.${v.variableName}`}>
                            {v.nodeId}.{v.variableName}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        placeholder="Enter constant value"
                        value={condition.value as string}
                        onChange={(e) => handleValueSelect(caseItem.case_id, condition.id, e.target.value)}
                        flex={1}
                        bg="white"
                        borderColor="gray.200"
                        _hover={{ borderColor: "blue.200" }}
                      />
                    )}
                  </HStack>
                )}
              </Box>
            ))}

            {caseItem.conditions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                rightIcon={<RiLoopLeftLine />}
                onClick={() => handleToggleLogicalOperator(caseItem.case_id)}
                mb={3}
                colorScheme="blue"
              >
                {caseItem.logical_operator.toUpperCase()}
              </Button>
            )}

            <Button
              size="sm"
              leftIcon={<FaPlus />}
              onClick={() => handleAddCondition(caseItem.case_id)}
              colorScheme="blue"
              variant="ghost"
              w="full"
              _hover={{
                transform: "translateY(-1px)",
                shadow: "sm",
              }}
            >
              Add Condition
            </Button>
          </Box>
        ))}

        <Button
          leftIcon={<FaPlus />}
          onClick={handleAddCase}
          colorScheme="blue"
          variant="outline"
          size="sm"
          width="100%"
          mb={4}
          _hover={{
            transform: "translateY(-1px)",
            shadow: "sm",
          }}
        >
          Add ELIF Case
        </Button>

        {node.data.cases.slice(-1).map((caseItem) => (
          <Box
            key={caseItem.case_id}
            p={4}
            bg="orange.50"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="orange.200"
            transition="all 0.2s"
            _hover={{
              bg: "orange.100",
              transform: "translateY(-1px)",
            }}
          >
            <HStack spacing={2}>
              <Box
                bg="orange.100"
                color="orange.700"
                px={3}
                py={1}
                borderRadius="md"
                fontSize="sm"
                fontWeight="600"
              >
                ELSE
              </Box>
              <Text fontSize="sm" color="gray.600">
                Default case when no conditions match
              </Text>
            </HStack>
          </Box>
        ))}
      </Box>
    </VStack>
  );
};

export default IfElseNodeProperties;
