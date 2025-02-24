import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { Parameter } from "../../types";
import { useForm } from "react-hook-form";

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

  const handleAddParameter = useCallback(() => {
    const newParameter: Parameter = {
      parameter_id: uuidv4(),
      name: "",
      type: "string",
      required: true,
    };

    const currentParameters = node.data.parameters || [];
    onNodeDataChange(node.id, "parameters", [...currentParameters, newParameter]);
  }, [node.id, node.data.parameters, onNodeDataChange]);

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

  const handleParameterChange = useCallback(
    (parameterId: string, field: string, value: any) => {
      const currentParameters = node.data.parameters || [];
      const updatedParameters = currentParameters.map(
        (parameter: Parameter) =>
          parameter.parameter_id === parameterId
            ? { ...parameter, [field]: value }
            : parameter
      );
      onNodeDataChange(node.id, "parameters", updatedParameters);
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
        <Text fontWeight="bold" mb={2} color="gray.700">
          {t("workflow.nodes.parameterExtractor.parameters")}:
        </Text>
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
                <FormControl>
                  <FormLabel fontSize="sm">
                    {t("workflow.nodes.parameterExtractor.parameterName")}
                  </FormLabel>
                  <Input
                    value={parameter.name}
                    onChange={(e) =>
                      handleParameterChange(
                        parameter.parameter_id,
                        "name",
                        e.target.value
                      )
                    }
                    placeholder={t("workflow.nodes.parameterExtractor.namePlaceholder")}
                    size="sm"
                  />
                </FormControl>
                <IconButton
                  aria-label={t("workflow.common.delete")}
                  icon={<FaTrash />}
                  size="xs"
                  colorScheme="gray"
                  variant="ghost"
                  onClick={() => handleRemoveParameter(parameter.parameter_id)}
                  isDisabled={node.data.parameters.length <= 1}
                />
              </HStack>

              <FormControl mt={2}>
                <FormLabel fontSize="sm">
                  {t("workflow.nodes.parameterExtractor.parameterType")}
                </FormLabel>
                <Select
                  value={parameter.type}
                  onChange={(e) =>
                    handleParameterChange(
                      parameter.parameter_id,
                      "type",
                      e.target.value
                    )
                  }
                  size="sm"
                >
                  {PARAMETER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <Checkbox
                mt={2}
                isChecked={parameter.required}
                onChange={(e) =>
                  handleParameterChange(
                    parameter.parameter_id,
                    "required",
                    e.target.checked
                  )
                }
              >
                {t("workflow.nodes.parameterExtractor.required")}
              </Checkbox>
            </Box>
          ))}

          <Button
            leftIcon={<FaPlus />}
            onClick={handleAddParameter}
            colorScheme="blue"
            variant="ghost"
            size="sm"
            width="100%"
            transition="all 0.2s"
            _hover={{
              bg: "blue.50",
              transform: "translateY(-1px)",
              boxShadow: "sm",
            }}
          >
            {t("workflow.nodes.parameterExtractor.addParameter")}
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default ParameterExtractorNodeProperties; 