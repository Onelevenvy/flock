import { DeleteIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
  Divider,
} from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FaTools, FaRobot } from "react-icons/fa";
import { GiArchiveResearch } from "react-icons/gi";

import ModelSelect from "@/components/Common/ModelProvider";
import ToolsIcon from "@/components/Icons/Tools";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useModelQuery } from "@/hooks/useModelQuery";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { useForm } from "react-hook-form";

import ToolsList from "../Tool/ToolsListModal";
import KBListModal from "../RetrievalTool/KBListModal";

interface FormValues {
  model: string;
  provider: string;
}

interface KBInfo {
  name: string;
  description: string;
  usr_id: number;
  kb_id: number;
}

interface AgentNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const AgentNodeProperties: React.FC<AgentNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  
  // 状态
  const [isToolsListOpen, setIsToolsListOpen] = useState(false);
  const [isKBListOpen, setIsKBListOpen] = useState(false);
  const [temperatureInput, setTemperatureInput] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [userPromptInput, setUserPromptInput] = useState("");
  
  // 表单管理
  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
    },
  });

  // 数据查询
  const { data: models, isLoading: isLoadingModel } = useModelQuery();
  const { data: skills, isLoading: isLoadingSkills } = useSkillsQuery();
  const { data: uploads, isLoading: isLoadingKB } = useUploadsQuery();

  // 初始化表单数据
  useEffect(() => {
    if (node && node.data.temperature !== undefined) {
      setTemperatureInput(node.data.temperature.toString());
    }
    if (node && node.data.systemMessage !== undefined) {
      setSystemPromptInput(node.data.systemMessage || "");
    }
    if (node && node.data.userMessage !== undefined) {
      setUserPromptInput(node.data.userMessage || "");
    }
    if (node && node.data.model) {
      setValue("model", node.data.model);
    }
    if (node && node.data.provider) {
      setValue("provider", node.data.provider);
    }
  }, [node, setValue]);

  // 模型选择回调
  const onModelSelect = useCallback(
    (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName
      );

      if (selectedModel) {
        const providerName = selectedModel.provider.provider_name || "";

        onNodeDataChange(node.id, "model", modelName);
        onNodeDataChange(node.id, "provider", providerName);

        setValue("model", modelName);
        setValue("provider", providerName);
      }
    },
    [node.id, models, onNodeDataChange, setValue]
  );

  // 系统提示词变更
  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setSystemPromptInput(value);
      onNodeDataChange(node.id, "systemMessage", value);
    },
    [node.id, onNodeDataChange]
  );

  // 用户提示词变更
  const handleUserPromptChange = useCallback(
    (value: string) => {
      setUserPromptInput(value);
      onNodeDataChange(node.id, "userMessage", value);
    },
    [node.id, onNodeDataChange]
  );

  // 变量选择器 - 系统提示词
  const {
    showVariables: showSystemVariables,
    setShowVariables: setShowSystemVariables,
    inputRef: systemInputRef,
    handleKeyDown: handleSystemKeyDown,
    insertVariable: insertSystemVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleSystemPromptChange(value),
    availableVariables,
  });

  // 变量选择器 - 用户提示词
  const {
    showVariables: showUserVariables,
    setShowVariables: setShowUserVariables,
    inputRef: userInputRef,
    handleKeyDown: handleUserKeyDown,
    insertVariable: insertUserVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleUserPromptChange(value),
    availableVariables,
  });

  // 工具管理
  const addTool = (tool: string) => {
    const currentTools = node.data.tools || [];
    if (!currentTools.includes(tool)) {
      onNodeDataChange(node.id, "tools", [...currentTools, tool]);
    }
  };

  const removeTool = (tool: string) => {
    const currentTools = node.data.tools || [];
    onNodeDataChange(
      node.id,
      "tools",
      currentTools.filter((t: string) => t !== tool)
    );
  };

  // 知识库管理
  const addKB = (kb: KBInfo) => {
    const currentKBs = node.data.retrievalTools || [];

    if (
      !currentKBs.some(
        (k: string | KBInfo) => (typeof k === "string" ? k : k.name) === kb.name
      )
    ) {
      onNodeDataChange(node.id, "retrievalTools", [...currentKBs, kb]);
    }
  };

  const removeKB = (kbName: string) => {
    const currentKBs = node.data.retrievalTools || [];

    onNodeDataChange(
      node.id,
      "retrievalTools",
      currentKBs.filter(
        (k: string | KBInfo) => (typeof k === "string" ? k : k.name) !== kbName
      )
    );
  };

  // 加载状态处理
  if (isLoadingModel || isLoadingSkills || isLoadingKB) {
    return <Text>Loading resources...</Text>;
  }

  return (
    <VStack align="stretch" spacing={4} mt={2}>
      {/* 模型设置部分 */}
      <Box>
        <HStack spacing={2} mb={2}>
          <FaRobot size="16px" color="var(--chakra-colors-gray-600)" />
          <Text fontWeight="600" fontSize="sm" color="gray.700">
            {t("workflow.nodes.llm.model")}
          </Text>
        </HStack>
        <ModelSelect<FormValues>
          models={models}
          control={control}
          name="model"
          onModelSelect={onModelSelect}
          isLoading={isLoadingModel}
          value={node.data.model}
        />
      </Box>

      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          {t("workflow.nodes.llm.temperature")}:
        </Text>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperatureInput}
          onChange={(e) => {
            setTemperatureInput(e.target.value);
            const numValue = Number.parseFloat(e.target.value);
            onNodeDataChange(node.id, "temperature", numValue);
          }}
          style={{ width: "100%" }}
        />
        <Text fontSize="xs" textAlign="right">
          {temperatureInput || "0"}
        </Text>
      </Box>

      <Divider />

      {/* 提示词设置部分 */}
      <VariableSelector
        label="System Prompt"
        value={systemPromptInput}
        onChange={handleSystemPromptChange}
        showVariables={showSystemVariables}
        setShowVariables={setShowSystemVariables}
        inputRef={systemInputRef}
        handleKeyDown={handleSystemKeyDown}
        insertVariable={insertSystemVariable}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder="Enter system instructions for the agent..."
      />

      <VariableSelector
        label="User Prompt"
        value={userPromptInput}
        onChange={handleUserPromptChange}
        showVariables={showUserVariables}
        setShowVariables={setShowUserVariables}
        inputRef={userInputRef}
        handleKeyDown={handleUserKeyDown}
        insertVariable={insertUserVariable}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder="Enter user instructions or template..."
      />

      <Divider />

      {/* 工具设置部分 */}
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <FaTools size="14px" color="var(--chakra-colors-gray-600)" />
            <Text fontSize="sm" fontWeight="500" color="gray.700">
              {t("workflow.nodes.tool.title")}
            </Text>
            <Text fontSize="xs" color="gray.500">
              ({node.data.tools?.length || 0})
            </Text>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<FaTools size="12px" />}
            onClick={() => setIsToolsListOpen(true)}
            colorScheme="blue"
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
            }}
          >
            {t("workflow.nodes.tool.addTool")}
          </Button>
        </HStack>

        <VStack align="stretch" spacing={2}>
          {node.data.tools?.map((tool: string) => (
            <Box
              key={tool}
              p={2}
              bg="ui.inputbgcolor"
              borderRadius="md"
              borderLeft="3px solid"
              borderLeftColor="blue.400"
              transition="all 0.2s"
              _hover={{
                bg: "gray.100",
                borderLeftColor: "blue.500",
                transform: "translateX(2px)",
              }}
            >
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                  <Text fontSize="sm" fontWeight="500" color="gray.700">
                    {tool}
                  </Text>
                </HStack>
                <IconButton
                  aria-label="Remove tool"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeTool(tool)}
                  transition="all 0.2s"
                  _hover={{
                    transform: "scale(1.1)",
                  }}
                />
              </HStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {isToolsListOpen && (
        <ToolsList
          skills={skills?.data || []}
          onClose={() => setIsToolsListOpen(false)}
          onAddTool={addTool}
          selectedTools={node.data.tools || []}
        />
      )}

      <Divider />

      {/* 知识库设置部分 */}
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <GiArchiveResearch
              size="14px"
              color="var(--chakra-colors-gray-600)"
            />
            <Text fontSize="sm" fontWeight="500" color="gray.700">
              {t("workflow.nodes.retrieval.title")}
            </Text>
            <Text fontSize="xs" color="gray.500">
              ({node.data.retrievalTools?.length || 0})
            </Text>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<GiArchiveResearch size="12px" />}
            onClick={() => setIsKBListOpen(true)}
            colorScheme="blue"
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
            }}
          >
            {t("workflow.nodes.retrieval.addKB")}
          </Button>
        </HStack>

        <VStack align="stretch" spacing={2}>
          {node.data.retrievalTools?.map((kb: string | KBInfo) => {
            const kbName = typeof kb === "string" ? kb : kb.name;

            return (
              <Box
                key={kbName}
                p={2}
                bg="ui.inputbgcolor"
                borderRadius="md"
                borderLeft="3px solid"
                borderLeftColor="blue.400"
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  borderLeftColor: "blue.500",
                  transform: "translateX(2px)",
                }}
              >
                <HStack justify="space-between" align="center">
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="db"
                      icon={<GiArchiveResearch size="16px" />}
                      colorScheme="blue"
                      size="xs"
                      variant="ghost"
                      transition="all 0.2s"
                      _hover={{
                        transform: "scale(1.1)",
                      }}
                    />
                    <Text fontSize="sm" fontWeight="500" color="gray.700">
                      {kbName}
                    </Text>
                  </HStack>
                  <IconButton
                    aria-label={t("workflow.nodes.retrieval.removeKB")}
                    icon={<DeleteIcon />}
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => removeKB(kbName)}
                    transition="all 0.2s"
                    _hover={{
                      transform: "scale(1.1)",
                    }}
                  />
                </HStack>
              </Box>
            );
          })}
        </VStack>
      </Box>

      {isKBListOpen && (
        <KBListModal
          uploads={uploads?.data || []}
          onClose={() => setIsKBListOpen(false)}
          onAddKB={addKB}
          selectedKBs={
            node.data.retrievalTools?.map((kb: string | KBInfo) =>
              typeof kb === "string" ? kb : kb.name
            ) || []
          }
        />
      )}
    </VStack>
  );
};

export default AgentNodeProperties; 