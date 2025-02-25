import {
  Box,
  HStack,
  IconButton,
  Text,
  VStack,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { FaPlus, FaTrash, FaEdit, FaFileImport } from "react-icons/fa";
import { useTranslation } from "react-i18next";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { ParameterSchema } from "../../types";
import { useForm } from "react-hook-form";
import ParameterModal from "./ParameterModal";
import ToolsList from "../Tool/ToolsListModal";

interface ParameterExtractorNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const ParameterExtractorNodeProperties: React.FC<ParameterExtractorNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const { data: models, isLoading: isLoadingModel } = useModelQuery();
  const { data: skills } = useSkillsQuery();
  const { control } = useForm<{ model: string; provider: string }>({
    defaultValues: {
      model: node.data.model || "",
      provider: "",
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<ParameterSchema | undefined>();

  const handleAddParameter = useCallback(() => {
    setEditingParameter(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditParameter = useCallback((parameter: ParameterSchema) => {
    setEditingParameter(parameter);
    setIsModalOpen(true);
  }, []);

  const handleRemoveParameter = useCallback(
    (paramName: string) => {
      const currentParameters = node.data.parameters || [];
      onNodeDataChange(
        node.id,
        "parameters",
        currentParameters.filter((p: ParameterSchema) => !p[paramName])
      );
    },
    [node.id, node.data.parameters, onNodeDataChange]
  );

  const handleSaveParameter = useCallback(
    (parameter: ParameterSchema) => {
      const currentParameters = Array.isArray(node.data.parameters) ? node.data.parameters : [];
      const newParamName = Object.keys(parameter)[0];
      
      if (editingParameter) {
        // 编辑模式：替换现有参数
        const oldParamName = Object.keys(editingParameter)[0];
        const updatedParameters = currentParameters.map((p: ParameterSchema) => {
          const paramName = Object.keys(p)[0];
          return paramName === oldParamName ? parameter : p;
        });
        onNodeDataChange(node.id, "parameters", updatedParameters);
      } else {
        // 新增模式：检查重名并添加
        const exists = currentParameters.some((p: ParameterSchema) => Object.keys(p)[0] === newParamName);
        if (exists) {
          alert("A parameter with this name already exists!");
          return;
        }
        onNodeDataChange(node.id, "parameters", [...currentParameters, parameter]);
      }
      
      setIsModalOpen(false);
    },
    [node.id, node.data.parameters, onNodeDataChange, editingParameter]
  );

  const handleImportFromTool = useCallback(() => {
    setIsToolsModalOpen(true);
  }, []);

  const handleToolSelect = useCallback((toolName: string) => {
    const selectedTool = skills?.data.find(
      (skill) => skill.display_name === toolName
    );
    
    if (!selectedTool?.input_parameters) return;

    const newParameters = Object.entries(selectedTool.input_parameters).map(([key, value]: [string, any]) => ({
      [key]: {
        type: value.type,
        required: value.required || false,
        description: value.description || "",
      }
    }));

    // 合并现有参数和新参数，避免重复
    const existingParamNames = (node.data.parameters || []).map((p: ParameterSchema) => Object.keys(p)[0]);
    const uniqueNewParams = newParameters.filter((param) => {
      const paramName = Object.keys(param)[0];
      return !existingParamNames.includes(paramName);
    });

    onNodeDataChange(node.id, "parameters", [
      ...(node.data.parameters || []),
      ...uniqueNewParams
    ]);
    
    setIsToolsModalOpen(false);
  }, [skills?.data, node.id, node.data.parameters, onNodeDataChange]);

  return (
    <VStack spacing={4} align="stretch">
      <Box>
        <Text fontWeight="bold" color="gray.700">
          {t("workflow.nodes.parameterExtractor.model")}:
        </Text>
        <ModelSelect
          models={models}
          control={control}
          name="model"
          value={node.data.model}
          onModelSelect={(model: string) =>
            onNodeDataChange(node.id, "model", model)
          }
          isLoading={isLoadingModel}
        />
      </Box>

      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold" color="gray.700">
            {t("workflow.nodes.parameterExtractor.parameters")}:
          </Text>
          <HStack spacing={2}>
            <Tooltip label={t("workflow.nodes.parameterExtractor.importFromTool")}>
              <IconButton
                aria-label="Import from tool"
                icon={<FaFileImport />}
                onClick={handleImportFromTool}
                colorScheme="blue"
                variant="ghost"
                size="sm"
              />
            </Tooltip>
            <Tooltip label={t("workflow.nodes.parameterExtractor.addParameter")}>
              <IconButton
                aria-label="Add parameter"
                icon={<FaPlus />}
                onClick={handleAddParameter}
                colorScheme="blue"
                variant="ghost"
                size="sm"
              />
            </Tooltip>
          </HStack>
        </HStack>
        <VStack spacing={4} align="stretch">
          {node.data.parameters?.map((parameter: ParameterSchema) => {
            const paramName = Object.keys(parameter)[0];
            const paramData = parameter[paramName];
            return (
              <Box
                key={paramName}
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="md"
                p={3}
                bg="ui.inputbgcolor"
              >
                <HStack justify="space-between" mb={2}>
                  <HStack spacing={2}>
                    <Text fontSize="sm" fontWeight="500">
                      {paramName}
                      {paramData.required && (
                        <Text as="span" color="red.500" ml={1}>
                          *
                        </Text>
                      )}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      ({paramData.type})
                    </Text>
                  </HStack>
                  <HStack>
                    <IconButton
                      aria-label="Edit parameter"
                      icon={<FaEdit />}
                      size="xs"
                      colorScheme="blue"
                      variant="ghost"
                      onClick={() => handleEditParameter({ [paramName]: paramData })}
                    />
                    <IconButton
                      aria-label="Delete parameter"
                      icon={<FaTrash />}
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => handleRemoveParameter(paramName)}
                    />
                  </HStack>
                </HStack>
                {paramData.description && (
                  <Text fontSize="sm" color="gray.600">
                    {paramData.description}
                  </Text>
                )}
              </Box>
            );
          })}
        </VStack>
      </Box>

      <Box>
        <Text fontWeight="bold" mb={2} color="gray.700">
          {t("workflow.nodes.parameterExtractor.extractionInstruction")}:
        </Text>
        <Textarea
          value={node.data.instruction || ""}
          onChange={(e) => onNodeDataChange(node.id, "instruction", e.target.value)}
          placeholder={t("workflow.nodes.parameterExtractor.instructionPlaceholder")!}
          size="sm"
          rows={3}
        />
      </Box>

      <ParameterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveParameter}
        parameter={editingParameter}
        isEdit={!!editingParameter}
        existingParameters={node.data.parameters || []}
      />

      {isToolsModalOpen && (
        <ToolsList
          skills={skills?.data || []}
          onClose={() => setIsToolsModalOpen(false)}
          onAddTool={handleToolSelect}
          selectedTools={[]}
        />
      )}
    </VStack>
  );
};

export default ParameterExtractorNodeProperties; 