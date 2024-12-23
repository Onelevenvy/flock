import { Box, Input, Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import ModelSelect from "@/components/Common/ModelProvider";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useModelQuery } from "@/hooks/useModelQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { useForm } from "react-hook-form";

interface FormValues {
  model: string;
  provider: string;
  api_key: string;
  base_url: string;
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

  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
      api_key: node.data.api_key || "",
      base_url: node.data.base_url || "",
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
    if (node && node.data.model) {
      setValue("model", node.data.model);
    }
    if (node && node.data.provider) {
      setValue("provider", node.data.provider);
    }
    if (node && node.data.api_key) {
      setValue("api_key", node.data.api_key);
    }
    if (node && node.data.base_url) {
      setValue("base_url", node.data.base_url);
    }
  }, [node, setValue]);

  const onModelSelect = useCallback(
    (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName
      );

      if (selectedModel) {
        const apiKey = selectedModel.provider.api_key || "";
        const baseUrl = selectedModel.provider.base_url || "";
        const providerName = selectedModel.provider.provider_name || "";

        onNodeDataChange(node.id, "model", modelName);
        onNodeDataChange(node.id, "api_key", apiKey);
        onNodeDataChange(node.id, "provider", providerName);
        onNodeDataChange(node.id, "base_url", baseUrl);

        setValue("model", modelName);
        setValue("api_key", apiKey);
        setValue("provider", providerName);
        setValue("base_url", baseUrl);
      }
    },
    [node.id, models, onNodeDataChange, setValue]
  );

  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setSystemPromptInput(value);
      onNodeDataChange(node.id, "systemMessage", value);
    },
    [node.id, onNodeDataChange]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleSystemPromptChange(value),
    availableVariables,
  });

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text 
          fontWeight="500" 
          fontSize="sm" 
          color="gray.700"
          mb={2}
        >
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
        <Text 
          fontWeight="500" 
          fontSize="sm" 
          color="gray.700"
          mb={2}
        >
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
            borderColor: "blue.200"
          }}
          _focus={{
            borderColor: "blue.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)"
          }}
          transition="all 0.2s"
          step={0.1}
          min={0}
          max={1}
        />
      </Box>

      <VariableSelector
        label={String(t("workflow.nodes.llm.systemPrompt"))}
        value={systemPromptInput}
        onChange={handleSystemPromptChange}
        showVariables={showVariables}
        setShowVariables={setShowVariables}
        inputRef={inputRef}
        handleKeyDown={handleKeyDown}
        insertVariable={insertVariable}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder={String(t("workflow.nodes.llm.placeholder"))}
      />
    </VStack>
  );
};

export default LLMNodeProperties;
