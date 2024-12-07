import {
  Box,
  Text,
  VStack,

  useToast,
  HStack,
  Input,
  IconButton,
  Select,
  Spinner,
} from "@chakra-ui/react";
import React, { useCallback, useState, useEffect } from "react";
import {  FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

import { VariableReference } from "../../FlowVis/variableSystem";

interface ArgVariable {
  name: string;
  value: string;
}

interface CodeNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

// Monaco Editor 主题配置
const MONACO_THEME: MonacoEditor.IStandaloneThemeData = {
  base: 'vs' as const,
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#F9FAFB",
    "editor.lineHighlightBackground": "#F3F4F6",
  },
};

// 工具函数：获取简洁版本的代码（不带变量引用）
const getSimplifiedCode = (code: string, currentArgs: ArgVariable[]) => {
  const [funcDef, ...restCode] = code.split("\n");
  const simplifiedFuncDef = funcDef.replace(
    /(def\s+main\s*\().*?(\))/,
    (match: string, start: string, end: string) => {
      const params = currentArgs.map((arg) => `${arg.name}: str`).join(", ");
      return `${start}${params}${end}`;
    }
  );
  return [simplifiedFuncDef, ...restCode].join("\n");
};

// 工具函数：获取完整版本的代码（带变量引用）
const getFullCode = (code: string, currentArgs: ArgVariable[]) => {
  const [funcDef, ...restCode] = code.split("\n");
  const fullFuncDef = funcDef.replace(
    /(def\s+main\s*\().*?(\))/,
    (match: string, start: string, end: string) => {
      const params = currentArgs
        .map((arg) =>
          arg.value ? `${arg.name}: str = {${arg.value}}` : `${arg.name}: str`
        )
        .join(", ");
      return `${start}${params}${end}`;
    }
  );
  return [fullFuncDef, ...restCode].join("\n");
};

const CodeNodeProperties: React.FC<CodeNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
 
  const [editorInstance, setEditorInstance] =
    useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const [args, setArgs] = useState<ArgVariable[]>([]);

  // 修改变量更新时的处理函数
  const updateCodeWithNewArgs = useCallback(
    (newArgs: ArgVariable[]) => {
      if (editorInstance) {
        const model = editorInstance.getModel();
        if (!model) return;

        const value = model.getValue();
        // 保存完整版本（带变量引用）
        const codeToSave = getFullCode(value, newArgs);
        onNodeDataChange(node.id, "code", codeToSave);
      }
    },
    [editorInstance, node.id, onNodeDataChange]
  );

  // 初始化代码模板和参数
  useEffect(() => {
    try {
      if (node.data.code) {
        // 从现有代码中解析参数
        const funcDefMatch = node.data.code.match(/def\s+main\s*\((.*?)\)/);
        if (funcDefMatch) {
          const params = funcDefMatch[1].split(",").map((param: string) => {
            const [name, value] = param
              .trim()
              .split("=")
              .map((s: string) => s.trim());
            const nameOnly = name.split(":")[0].trim();
            return {
              name: nameOnly,
              value: value ? value.replace(/[{}]/g, "") : "",
            };
          });
          setArgs(params);
        }
      } else {
        // 使用默认参数
        const defaultArgs = [
          { name: "arg1", value: "" },
          { name: "arg2", value: "" },
        ];
        setArgs(defaultArgs);
        const defaultCode = `def main(arg1: str, arg2: str) -> dict:\n    return {"code_result": ""}\n`;
        onNodeDataChange(node.id, "code", defaultCode);
      }

      if (node.data.args) {
        setArgs(node.data.args);
      }
    } catch (error) {
      console.error("Error in initialization:", error);
    }
  }, [node.id, node.data.code, node.data.args, onNodeDataChange]);

  // 编辑器加载完成时的回调
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);
    monaco.editor.defineTheme("python-theme", MONACO_THEME);
    monaco.editor.setTheme("python-theme");
  };

  // Monaco Editor 配置
  const editorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: "on" as const,
    renderLineHighlight: "all" as const,
    automaticLayout: true,
    tabSize: 4,
    detectIndentation: true,
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: "advanced" as const,
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 10,
    wordWrap: "on" as const,
    scrollbar: {
      horizontal: "hidden",
      verticalScrollbarSize: 10,
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
  } as const;

  // 修改参数处理函数
  const handleArgValueChange = useCallback(
    (index: number, value: string) => {
      const newArgs = [...args];
      newArgs[index].value = value;
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
      updateCodeWithNewArgs(newArgs);
    },
    [args, updateCodeWithNewArgs, onNodeDataChange, node.id]
  );

  const handleArgNameChange = useCallback(
    (index: number, name: string) => {
      const newArgs = [...args];
      newArgs[index].name = name;
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
      updateCodeWithNewArgs(newArgs);
    },
    [args, updateCodeWithNewArgs, onNodeDataChange,node.id]
  );

  const handleRemoveArg = useCallback(
    (index: number) => {
      const newArgs = args.filter((_, i) => i !== index);
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
      updateCodeWithNewArgs(newArgs);
    },
    [args, updateCodeWithNewArgs, onNodeDataChange,node.id]
  );

  const handleAddArg = useCallback(() => {
    const newArg = { name: "", value: "" };
    const newArgs = [...args, newArg];
    setArgs(newArgs);
    onNodeDataChange(node.id, "args", newArgs);
  }, [args, node.id, onNodeDataChange]);

  // 添加加载状态处理
  const handleEditorLoading = () => {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="300px"
        bg="gray.50"
        borderRadius="md"
      >
        <Spinner size="xl" color="blue.500" thickness="3px" />
      </Box>
    );
  };

  // 添加错误处理
  const handleEditorError = (error: unknown) => {
    console.error("Monaco Editor loading error:", error);
    toast({
      title: "编辑器加载失败",
      description: "请刷新页面重试",
      status: "error",
      duration: 5000,
      isClosable: true,
    });
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
                placeholder="输入变量名"
                value={arg.name}
                onChange={(e) => handleArgNameChange(index, e.target.value)}
                size="sm"
                width="40%"
                isRequired
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

      <Box>
        <Text fontWeight="500" color="gray.700" mb={2}>
          Python 代码
        </Text>
        <Box
          borderRadius="md"
          overflow="hidden"
          border="1px solid"
          borderColor="gray.200"
          _hover={{
            borderColor: "gray.300",
          }}
        >
          <Editor
            height="300px"
            defaultLanguage="python"
            // 显示简洁版本
            value={getSimplifiedCode(node.data.code, args)}
            onChange={(value: string | undefined) => {
              if (value !== undefined) {
                // 保存完整版本（带变量引用）
                const fullCode = getFullCode(value, args);
                onNodeDataChange(node.id, "code", fullCode);
              }
            }}
            options={editorOptions}
            onMount={handleEditorDidMount}
            loading={handleEditorLoading()}
            theme="python-theme"
          />
        </Box>
      </Box>

     

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
