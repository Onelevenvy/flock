import {
  Box,
  Input,
  Text,
  VStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Textarea,
} from "@chakra-ui/react";
import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";

import ModelSelect from "@/components/Common/ModelProvider";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useModelQuery } from "@/hooks/useModelQuery";

import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";

interface LLMNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

interface FormValues {
  model: string;
  provider: string;
  openai_api_key: string;
  openai_api_base: string;
}

const LLMNodeProperties: React.FC<LLMNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const [temperatureInput, setTemperatureInput] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");

  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
      openai_api_key: node.data.openai_api_key || "",
      openai_api_base: node.data.openai_api_base || "",
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
    if (node && node.data.openai_api_key) {
      setValue("openai_api_key", node.data.openai_api_key);
    }
    if (node && node.data.openai_api_base) {
      setValue("openai_api_base", node.data.openai_api_base);
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
        onNodeDataChange(node.id, "openai_api_key", apiKey);
        onNodeDataChange(node.id, "provider", providerName);
        onNodeDataChange(node.id, "openai_api_base", baseUrl);

        setValue("model", modelName);
        setValue("openai_api_key", apiKey);
        setValue("provider", providerName);
        setValue("openai_api_base", baseUrl);
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
    showVariables: showVariablesHook,
    setShowVariables: setShowVariablesHook,
    inputRef: inputRefHook,
    handleKeyDown: handleKeyDownHook,
    insertVariable: insertVariableHook,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleSystemPromptChange(value),
    availableVariables,
  });

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="bold">Model:</Text>
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
        <Text fontWeight="bold">Temperature:</Text>
        <Input
          type="number"
          bg="#edf2f7"
          value={temperatureInput}
          onChange={(e) => {
            setTemperatureInput(e.target.value);
            const numValue =
              e.target.value === "" ? 0 : Number.parseFloat(e.target.value);

            onNodeDataChange(node.id, "temperature", numValue);
          }}
          step={0.1}
          min={0}
          max={1}
        />
      </Box>
      
      <VariableSelector
        label="System Prompt"
        value={systemPromptInput}
        onChange={handleSystemPromptChange}
        showVariables={showVariablesHook}
        setShowVariables={setShowVariablesHook}
        inputRef={inputRefHook}
        handleKeyDown={handleKeyDownHook}
        insertVariable={insertVariableHook}
        availableVariables={availableVariables}
        minHeight="100px"
      />
    </VStack>
  );
};

export default LLMNodeProperties;
