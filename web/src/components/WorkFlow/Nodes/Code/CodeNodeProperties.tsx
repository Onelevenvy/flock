import {
  Box,
  Text,
  VStack,
  Button,
  useToast,
  HStack,
  Input,
  IconButton,
  Select,
} from "@chakra-ui/react";
import React, { useCallback, useState, useEffect } from "react";
import { FaPlay, FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";

import { useVariableInsertion } from "../../../../hooks/graphs/useVariableInsertion";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";

interface ArgVariable {
  name: string;
  value: string;
}

const DEFAULT_PYTHON_TEMPLATE = `def main(arg1: str, arg2: str) -> dict:
    return {
        "result": arg1 + arg2,
    }`;

interface CodeNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const CodeNodeProperties: React.FC<CodeNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [args, setArgs] = useState<ArgVariable[]>([
    { name: "arg1", value: "" },
    { name: "arg2", value: "" },
  ]);

  // 初始化代码模板和参数
  useEffect(() => {
    if (!node.data.code) {
      onNodeDataChange(node.id, "code", DEFAULT_PYTHON_TEMPLATE);
    }
    if (!node.data.args) {
      onNodeDataChange(node.id, "args", args);
    } else {
      setArgs(node.data.args);
    }
  }, [node.id, node.data.code, node.data.args, onNodeDataChange]);

  const handleCodeChange = useCallback(
    (value: string) => {
      onNodeDataChange(node.id, "code", value);
    },
    [node.id, onNodeDataChange]
  );

  const handleAddArg = useCallback(() => {
    const newArg = { name: `arg${args.length + 1}`, value: "" };
    const newArgs = [...args, newArg];
    setArgs(newArgs);
    onNodeDataChange(node.id, "args", newArgs);
  }, [args, node.id, onNodeDataChange]);

  const handleRemoveArg = useCallback(
    (index: number) => {
      if (args.length <= 2) {
        toast({
          title: "无法删除",
          description: "至少需要保留两个参数",
          status: "warning",
          duration: 3000,
        });
        return;
      }
      const newArgs = args.filter((_, i) => i !== index);
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
    },
    [args, node.id, onNodeDataChange, toast]
  );

  const handleArgNameChange = useCallback(
    (index: number, name: string) => {
      const newArgs = [...args];
      newArgs[index].name = name;
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
    },
    [args, node.id, onNodeDataChange]
  );

  const handleArgValueChange = useCallback(
    (index: number, value: string) => {
      const newArgs = [...args];
      newArgs[index].value = value;
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
    },
    [args, node.id, onNodeDataChange]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: handleCodeChange,
    availableVariables,
  });

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const code = node.data.code;
      // TODO: 调用后端 API 执行代码
      
      toast({
        title: "执行成功",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "执行失败",
        description: error instanceof Error ? error.message : "未知错误",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="500" color="gray.700">
            输入变量
          </Text>
          <IconButton
            aria-label="Add argument"
            icon={<FaPlus />}
            size="sm"
            colorScheme="purple"
            variant="ghost"
            onClick={handleAddArg}
          />
        </HStack>
        <VStack spacing={2}>
          {args.map((arg, index) => (
            <HStack key={index} width="100%">
              <Input
                placeholder="变量名"
                value={arg.name}
                onChange={(e) => handleArgNameChange(index, e.target.value)}
                size="sm"
                width="40%"
              />
              <Select
                value={arg.value}
                onChange={(e) => handleArgValueChange(index, e.target.value)}
                size="sm"
                flex={1}
                placeholder="选择变量"
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
              <IconButton
                aria-label="Remove argument"
                icon={<FaTrash />}
                size="sm"
                colorScheme="red"
                variant="ghost"
                onClick={() => handleRemoveArg(index)}
              />
            </HStack>
          ))}
        </VStack>
      </Box>

      <VariableSelector
        label="Python 代码"
        value={node.data.code || ""}
        onChange={handleCodeChange}
        placeholder="输入 Python 代码，使用 '/' 插入变量。代码必须包含 main 函数作为入口点。"
        showVariables={showVariables}
        setShowVariables={setShowVariables}
        inputRef={inputRef}
        handleKeyDown={handleKeyDown}
        insertVariable={insertVariable}
        availableVariables={availableVariables}
        minHeight="200px"
      />

      <Button
        leftIcon={<FaPlay />}
        onClick={handleExecute}
        isLoading={isExecuting}
        colorScheme="purple"
        size="md"
        width="100%"
        transition="all 0.2s"
        _hover={{
          transform: "translateY(-1px)",
          boxShadow: "md",
        }}
        _active={{
          transform: "translateY(0)",
        }}
      >
        {t("执行代码")}
      </Button>

      {node.data.output && (
        <Box
          bg="gray.50"
          p={3}
          borderRadius="md"
          borderLeft="3px solid"
          borderLeftColor="purple.400"
        >
          <Text fontWeight="500" mb={2} color="gray.700" fontSize="sm">
            执行结果:
          </Text>
          <Text
            as="pre"
            fontSize="xs"
            fontFamily="mono"
            whiteSpace="pre-wrap"
            color="gray.600"
          >
            {node.data.output}
          </Text>
        </Box>
      )}
    </VStack>
  );
};

export default CodeNodeProperties;