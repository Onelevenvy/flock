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
  Spinner,
} from "@chakra-ui/react";
import React, { useCallback, useState, useEffect } from "react";
import { FaPlay, FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import Editor, { type Monaco } from "@monaco-editor/react";

import { useVariableInsertion } from "../../../../hooks/graphs/useVariableInsertion";
import { VariableReference } from "../../FlowVis/variableSystem";


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

// Monaco Editor 主题配置
const MONACO_THEME = {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#F9FAFB",
    "editor.lineHighlightBackground": "#F3F4F6",
  },
};

const CodeNodeProperties: React.FC<CodeNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [args, setArgs] = useState<ArgVariable[]>([
    { name: "arg1", value: "" },
    { name: "arg2", value: "" },
  ]);

  // 初始化代码模板和参数
  useEffect(() => {
    try {
      if (!node.data.code) {
        const params = args.map(arg => `${arg.name}: str`).join(', ');
        const defaultCode = `def main(${params}) -> dict:\n    return {\n        "result": ${args.map(arg => arg.name).join(' + ')},\n    }`;
        onNodeDataChange(node.id, "code", defaultCode);
      }

      if (!node.data.args) {
        onNodeDataChange(node.id, "args", args);
      } else {
        setArgs(node.data.args);
      }
    } catch (error) {
      console.error('Error in initialization:', error);
    }
  }, [node.id, node.data.code, node.data.args, onNodeDataChange, args]);

  // 修改参数处理函数
  const handleArgValueChange = useCallback(
    (index: number, value: string) => {
      try {
        const newArgs = [...args];
        newArgs[index].value = value;
        setArgs(newArgs);
        onNodeDataChange(node.id, "args", newArgs);

        // 更新保存的代码，包含变量引用
        if (editorInstance) {
          const currentCode = editorInstance.getValue();
          const [funcDef, ...restCode] = currentCode.split('\n');
          
          // 保存时的代码 - 包含变量引用
          const updatedFuncDef = funcDef.replace(
            /(def\s+main\s*\().*?(\))/,
            (match: string, start: string, end: string) => {
              const params = newArgs.map(arg => 
                arg.value 
                  ? `${arg.name}: str = {${arg.value}}`
                  : `${arg.name}: str`
              ).join(', ');
              return `${start}${params}${end}`;
            }
          );
          
          // 保存完整代码，包含变量引用
          const codeToSave = [updatedFuncDef, ...restCode].join('\n');
          onNodeDataChange(node.id, "code", codeToSave);
          
          // 显示时的代码 - 不包含变量引用
          const displayFuncDef = funcDef.replace(
            /(def\s+main\s*\().*?(\))/,
            (match: string, start: string, end: string) => {
              const params = newArgs.map(arg => `${arg.name}: str`).join(', ');
              return `${start}${params}${end}`;
            }
          );
          const displayCode = [displayFuncDef, ...restCode].join('\n');
          editorInstance.setValue(displayCode);
        }
      } catch (error) {
        console.error('Error updating code:', error);
        toast({
          title: "更新代码失败",
          description: "请重试或刷新页面",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [args, editorInstance, node.id, onNodeDataChange, toast]
  );

  const handleAddArg = useCallback(() => {
    const newArg = { name: "", value: "" };
    const newArgs = [...args, newArg];
    setArgs(newArgs);
    onNodeDataChange(node.id, "args", newArgs);
  }, [args, node.id, onNodeDataChange]);

  const handleRemoveArg = useCallback(
    (index: number) => {
      const newArgs = args.filter((_, i) => i !== index);
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
      
      // 只更新函数定义
      if (editorInstance) {
        const currentCode = editorInstance.getValue();
        const [funcDef, ...restCode] = currentCode.split('\n');
        const newFuncDef = funcDef.replace(
          /(def\s+main\s*\().*?(\))/,
          (match: string, start: string, end: string) => {
            const params = newArgs.map(arg => `${arg.name}: str`).join(', ');
            return `${start}${params}${end}`;
          }
        );
        editorInstance.setValue([newFuncDef, ...restCode].join('\n'));
      }
    },
    [args, editorInstance, node.id, onNodeDataChange]
  );

  const handleArgNameChange = useCallback(
    (index: number, name: string) => {
      const newArgs = [...args];
      newArgs[index].name = name;
      setArgs(newArgs);
      onNodeDataChange(node.id, "args", newArgs);
      
      // 只更新函数定义
      if (editorInstance) {
        const currentCode = editorInstance.getValue();
        const [funcDef, ...restCode] = currentCode.split('\n');
        const newFuncDef = funcDef.replace(
          /(def\s+main\s*\().*?(\))/,
          (match: string, start: string, end: string) => {
            const params = newArgs.map(arg => `${arg.name}: str`).join(', ');
            return `${start}${params}${end}`;
          }
        );
        editorInstance.setValue([newFuncDef, ...restCode].join('\n'));
      }
    },
    [args, editorInstance, node.id, onNodeDataChange]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value: string) => {
      if (value !== undefined) {
        onNodeDataChange(node.id, "code", value);
      }
    },
    availableVariables,
  });

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const code = node.data.code;
      // TODO: 调用端 API 执行代码

      toast({
        title: "行成功",
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
    lineDecorationsWidth: 5,
  } as const;

  // 编器加载完成时的回调
  const handleEditorDidMount = (editor: any, monaco: any) => {
    setEditorInstance(editor);
    
    // 定义 Python 主
    monaco.editor.defineTheme("python-theme", MONACO_THEME);
    monaco.editor.setTheme("python-theme");

    // 初始化代码显示
    if (node.data.code && editor) {
      const [funcDef, ...restCode] = node.data.code.split('\n');
      const displayFuncDef = funcDef.replace(
        /(def\s+main\s*\().*?(\))/,
        (match: string, start: string, end: string) => {
          const params = args.map(arg => `${arg.name}: str`).join(', ');
          return `${start}${params}${end}`;
        }
      );
      editor.setValue([displayFuncDef, ...restCode].join('\n'));
    }

    // 添加自动补全
    monaco.languages.registerCompletionItemProvider("python", {
      provideCompletionItems: () => {
        const suggestions = [
          {
            label: "def",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "def ${1:function_name}(${2:parameters}):\n\t${0}",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          },
          {
            label: "return",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "return ${0}",
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          },
          // 可以添加更多自动补全项
        ];
        return { suggestions };
      },
    });
  };

  // 添加加载状态处理
  const handleEditorWillMount = (monaco: Monaco) => {
    // 可以在这里进行一些编辑器加载前的配置
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  };

  // 添加加载中组件
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
    console.error('Monaco Editor loading error:', error);
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
            value={node.data.code}
            onChange={(value: string | undefined) => {
              if (value !== undefined) {
                // 保存时需要处理变量引用
                const [funcDef, ...restCode] = value.split('\n');
                const updatedFuncDef = funcDef.replace(
                  /(def\s+main\s*\().*?(\))/,
                  (match: string, start: string, end: string) => {
                    const params = args.map(arg => 
                      arg.value 
                        ? `${arg.name}: str = {${arg.value}}`
                        : `${arg.name}: str`
                    ).join(', ');
                    return `${start}${params}${end}`;
                  }
                );
                const codeToSave = [updatedFuncDef, ...restCode].join('\n');
                onNodeDataChange(node.id, "code", codeToSave);
              }
            }}
            options={editorOptions}
            onMount={handleEditorDidMount}
            loading="Loading..."
            theme="python-theme"
          />
        </Box>
      </Box>

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
