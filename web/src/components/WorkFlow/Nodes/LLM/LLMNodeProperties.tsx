import { Box, Input, Text, VStack, Divider } from "@chakra-ui/react"; // 导入 Divider
import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";

interface FormValues {
  model: string;
  provider: string;
}

interface LLMNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const LLMNodeProperties: React.FC<LLMNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const [temperatureInput, setTemperatureInput] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [userPromptInput, setUserPromptInput] = useState(""); // 新增: User Prompt 状态

  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
    },
  });

  const { data: models, isLoading: isLoadingModel } = useModelQuery();

  useEffect(() => {
    if (node && node.data.temperature !== undefined) {
      setTemperatureInput(node.data.temperature.toString());
    }
    if (node && node.data.systemMessage !== undefined) {
      setSystemPromptInput(node.data.systemMessage || "");
    }
    // 新增: 从节点数据初始化 User Prompt
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

  const onModelSelect = useCallback(
    (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName,
      );

      if (selectedModel) {
        const providerName = selectedModel.provider.provider_name || "";
        onNodeDataChange(node.id, "model", modelName);
        onNodeDataChange(node.id, "provider", providerName);
        setValue("model", modelName);
        setValue("provider", providerName);
      }
    },
    [node.id, models, onNodeDataChange, setValue],
  );

  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setSystemPromptInput(value);
      onNodeDataChange(node.id, "systemMessage", value);
    },
    [node.id, onNodeDataChange],
  );

  // 新增: User Prompt 的变更处理函数
  const handleUserPromptChange = useCallback(
    (value: string) => {
      setUserPromptInput(value);
      onNodeDataChange(node.id, "userMessage", value);
    },
    [node.id, onNodeDataChange],
  );

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          {t("workflow.nodes.llm.model")}:
        </Text>
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
        <Input
          type="number"
          value={temperatureInput}
          onChange={(e) => {
            setTemperatureInput(e.target.value);
            const numValue =
              e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
            onNodeDataChange(node.id, "temperature", numValue);
          }}
          size="sm"
          bg="ui.inputbgcolor"
          borderRadius="lg"
          borderColor="gray.200"
          _hover={{
            borderColor: "blue.200",
          }}
          _focus={{
            borderColor: "blue.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
          }}
          transition="all 0.2s"
          step={0.1}
          min={0}
          max={1}
        />
      </Box>
      
      {/* 新增: 分割线 */}
      <Divider />

      <VariableSelector
        label={String(t("workflow.nodes.llm.systemPrompt"))}
        value={systemPromptInput}
        onChange={handleSystemPromptChange}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder={String(t("workflow.nodes.llm.placeholder"))}
      />

      {/* 新增: User Prompt 输入区域 */}
      <VariableSelector
        label="User Prompt" 
        required={true}
        value={userPromptInput}
        onChange={handleUserPromptChange}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder="Enter user instructions or template..." 
      />
    </VStack>
  );
};

export default LLMNodeProperties;