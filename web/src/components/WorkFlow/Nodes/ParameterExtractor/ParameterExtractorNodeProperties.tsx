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
import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import { ParameterSchema } from "../../types";
import { useForm } from "react-hook-form";
import ParameterModal from "./ParameterModal";
// 从 ToolSelector 文件中导入 ToolOutIdWithAndName 类型
import { ToolOutIdWithAndName } from "@/client/models/ToolOutIdWithAndName";
// 导入新的 ToolSelector 组件 (请确保路径正确)
import ToolSelector from "@/components/Members/ToolSelector";

interface ParameterExtractorNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const ParameterExtractorNodeProperties: React.FC<
  ParameterExtractorNodePropertiesProps
> = ({ node, onNodeDataChange }) => {
  const { t } = useTranslation();
  const { data: models, isLoading: isLoadingModel } = useModelQuery();
  // useToolProvidersQuery 返回的数据现在将用于 ToolSelector
  const { data: toolProviders } = useToolProvidersQuery();
  const { control } = useForm<{ model: string; provider: string }>({
    defaultValues: {
      model: node.data.model || "",
      provider: "",
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<
    ParameterSchema | undefined
  >();

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
      const currentParameters = Array.isArray(node.data.parameters)
        ? node.data.parameters
        : [];
      const newParamName = Object.keys(parameter)[0];

      if (editingParameter) {
        // 编辑模式
        const oldParamName = Object.keys(editingParameter)[0];
        const updatedParameters = currentParameters.map(
          (p: ParameterSchema) => {
            const paramName = Object.keys(p)[0];
            return paramName === oldParamName ? parameter : p;
          }
        );
        onNodeDataChange(node.id, "parameters", updatedParameters);
      } else {
        // 新增模式
        const exists = currentParameters.some(
          (p: ParameterSchema) => Object.keys(p)[0] === newParamName
        );
        if (exists) {
          alert("A parameter with this name already exists!");
          return;
        }
        onNodeDataChange(node.id, "parameters", [
          ...currentParameters,
          parameter,
        ]);
      }

      setIsModalOpen(false);
    },
    [node.id, node.data.parameters, onNodeDataChange, editingParameter]
  );

  const handleImportFromTool = useCallback(() => {
    setIsToolsModalOpen(true);
  }, []);

  // 更新 handleToolSelect 以接收 ToolOutIdWithAndName 对象
  const handleToolSelect = useCallback(
    (tool: ToolOutIdWithAndName & { input_parameters?: any }) => {
      // 检查工具是否有输入参数
      if (!tool?.input_parameters) {
        setIsToolsModalOpen(false);
        return;
      }

      const newParameters = Object.entries(tool.input_parameters).map(
        ([key, value]: [string, any]) => ({
          [key]: {
            type: value.type,
            required: value.required || false,
            description: value.description || "",
          },
        })
      );

      // 合并现有参数和新参数，避免重复
      const existingParamNames = (node.data.parameters || []).map(
        (p: ParameterSchema) => Object.keys(p)[0]
      );
      const uniqueNewParams = newParameters.filter((param) => {
        const paramName = Object.keys(param)[0];
        return !existingParamNames.includes(paramName);
      });

      if (uniqueNewParams.length > 0) {
        onNodeDataChange(node.id, "parameters", [
          ...(node.data.parameters || []),
          ...uniqueNewParams,
        ]);
      }

      setIsToolsModalOpen(false);
    },
    [node.id, node.data.parameters, onNodeDataChange]
  );

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
            <Tooltip
              label={t("workflow.nodes.parameterExtractor.importFromTool")}
            >
              <IconButton
                aria-label="Import from tool"
                icon={<FaFileImport />}
                onClick={handleImportFromTool}
                colorScheme="blue"
                variant="ghost"
                size="sm"
              />
            </Tooltip>
            <Tooltip
              label={t("workflow.nodes.parameterExtractor.addParameter")}
            >
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
                      onClick={() =>
                        handleEditParameter({ [paramName]: paramData })
                      }
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
          onChange={(e) =>
            onNodeDataChange(node.id, "instruction", e.target.value)
          }
          placeholder={
            t("workflow.nodes.parameterExtractor.instructionPlaceholder")!
          }
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

      {/* --- 组件替换在这里 --- */}
      {isToolsModalOpen && (
        <ToolSelector
          isOpen={isToolsModalOpen}
          onClose={() => setIsToolsModalOpen(false)}
          providers={toolProviders?.providers || []}
          selectedTools={[]} // 在此场景下，我们不需要显示已选中的工具
          onSelect={handleToolSelect}
          onDeselect={() => {}} // 取消选择的逻辑在此处不需要
        />
      )}
      <Box>
        <Text fontWeight="bold" color="gray.700" mb={2}>
          Output:
        </Text>

        {node.data.parameters && node.data.parameters.length > 0 ? (
          node.data.parameters.map((parameter: ParameterSchema) => {
            const paramName = Object.keys(parameter)[0];
            const paramData = parameter[paramName];
            return (
              <HStack
                key={paramName}
                justify="space-between"
                w="full"
                bg="#f2f4f7"
                p={2}
                borderRadius="md"
                boxShadow="sm"
                border={"1px solid"}
                borderColor="gray.200"
              >
                <Text fontSize="sm" fontWeight="500" color="#2b6cb0">
                  {paramName}
                </Text>

                <Text fontSize="xs" color="#2b6cb0">
                  ({paramData.type})
                </Text>
              </HStack>
            );
          })
        ) : (
          <Text fontSize="sm" color="gray.500">
            Please add the parameters first
          </Text>
        )}
      </Box>
    </VStack>
  );
};

export default ParameterExtractorNodeProperties;
