import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
  Textarea,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { Parameter } from "../../types";
import { useForm } from "react-hook-form";
import ParameterModal from "./ParameterModal";

interface ParameterExtractorNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

interface FormValues {
  model: string;
  provider: string;
}

const PARAMETER_TYPES = [
  "string",
  "number",
  "boolean",
  "array[string]",
  "array[number]",
  "array[object]"
];

const ParameterExtractorNodeProperties: React.FC<ParameterExtractorNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const { data: models, isLoading: isLoadingModel } = useModelQuery();
  const { control } = useForm<FormValues>({
    defaultValues: {
      model: node.data.model || "",
      provider: "",
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<Parameter | undefined>();

  const handleAddParameter = useCallback(() => {
    setEditingParameter(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditParameter = useCallback((parameter: Parameter) => {
    setEditingParameter(parameter);
    setIsModalOpen(true);
  }, []);

  const handleRemoveParameter = useCallback(
    (parameterId: string) => {
      const currentParameters = node.data.parameters || [];
      if (currentParameters.length <= 1) {
        return;
      }

      onNodeDataChange(
        node.id,
        "parameters",
        currentParameters.filter(
          (p: Parameter) => p.parameter_id !== parameterId
        )
      );
    },
    [node.id, node.data.parameters, onNodeDataChange]
  );

  const handleSaveParameter = useCallback(
    (parameter: Parameter) => {
      const currentParameters = Array.isArray(node.data.parameters) ? node.data.parameters : [];
      let updatedParameters;

      if (parameter.parameter_id) {
        // 编辑已存在的参数
        updatedParameters = currentParameters.map((p: Parameter) =>
          p.parameter_id === parameter.parameter_id ? parameter : p
        );
      } else {
        // 添加新参数
        const newParameter = {
          ...parameter,
          parameter_id: uuidv4()
        };
        updatedParameters = [...currentParameters, newParameter];
      }

      onNodeDataChange(node.id, "parameters", updatedParameters);
      setIsModalOpen(false);
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
          <Button
            leftIcon={<FaPlus />}
            onClick={handleAddParameter}
            colorScheme="blue"
            variant="ghost"
            size="sm"
            transition="all 0.2s"
            _hover={{
              bg: "blue.50",
              transform: "translateY(-1px)",
              boxShadow: "sm",
            }}
          >
            {t("workflow.nodes.parameterExtractor.addParameter")}
          </Button>
        </HStack>
        <VStack spacing={4} align="stretch">
          {node.data.parameters?.map((parameter: Parameter) => (
            <Box
              key={parameter.parameter_id}
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
              p={3}
              bg="ui.inputbgcolor"
              transition="all 0.2s"
              _hover={{
                borderColor: "blue.300",
                boxShadow: "md",
              }}
            >
              <HStack justify="space-between" mb={2}>
                <HStack spacing={2}>
                  <Text fontSize="sm" fontWeight="500">
                    {parameter.name || t("workflow.nodes.parameterExtractor.untitled")}
                    {parameter.required && (
                      <Text as="span" color="red.500" ml={1}>
                        *
                      </Text>
                    )}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    ({parameter.type})
                  </Text>
                </HStack>
                <HStack>
                  <IconButton
                    aria-label={t("workflow.nodes.parameterExtractor.editParameter")}
                    icon={<FaEdit />}
                    size="xs"
                    colorScheme="blue"
                    variant="ghost"
                    onClick={() => handleEditParameter(parameter)}
                  />
                  <IconButton
                    aria-label={t("workflow.common.delete")}
                    icon={<FaTrash />}
                    size="xs"
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => handleRemoveParameter(parameter.parameter_id)}
                    isDisabled={node.data.parameters.length <= 1}
                  />
                </HStack>
              </HStack>
              {parameter.description && (
                <Text fontSize="sm" color="gray.600">
                  {parameter.description}
                </Text>
              )}
            </Box>
          ))}
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
      />
    </VStack>
  );
};

export default ParameterExtractorNodeProperties; 