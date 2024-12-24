import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { ClassifierCategory } from "../../types";
import { useForm } from "react-hook-form";

interface ClassifierNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

interface FormValues {
  model: string;
  provider: string;
  api_key: string;
  base_url: string;
}

const ClassifierNodeProperties: React.FC<ClassifierNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const { data: models, isLoading: isLoadingModel } = useModelQuery();
  const { control } = useForm<FormValues>({
    defaultValues: {
      model: node.data.model || "",
      provider: "",
      api_key: "",
      base_url: "",
    },
  });
  const handleAddCategory = useCallback(() => {
    const newCategory: ClassifierCategory = {
      category_id: uuidv4(),
      category_name: "",
    };

    const currentCategories = node.data.categories || [];
    const othersCategory = currentCategories.find(
      (c: ClassifierCategory) => c.category_id === "others_category"
    );
    const regularCategories = currentCategories.filter(
      (c: ClassifierCategory) => c.category_id !== "others_category"
    );

    onNodeDataChange(node.id, "categories", [
      ...regularCategories,
      newCategory,
      othersCategory!,
    ]);
  }, [node.id, node.data.categories, onNodeDataChange]);

  const handleRemoveCategory = useCallback(
    (categoryId: string) => {
      const currentCategories = node.data.categories || [];
      if (
        categoryId === "others_category" ||
        categoryId === currentCategories[0].category_id ||
        currentCategories.length <= 2
      ) {
        return;
      }

      onNodeDataChange(
        node.id,
        "categories",
        currentCategories.filter(
          (c: ClassifierCategory) => c.category_id !== categoryId
        )
      );
    },
    [node.id, node.data.categories, onNodeDataChange]
  );

  const handleCategoryNameChange = useCallback(
    (categoryId: string, newName: string) => {
      if (categoryId === "others_category") return;

      const currentCategories = node.data.categories || [];
      const updatedCategories = currentCategories.map(
        (category: ClassifierCategory) =>
          category.category_id === categoryId
            ? { ...category, category_name: newName }
            : category
      );
      onNodeDataChange(node.id, "categories", updatedCategories);
    },
    [node.id, node.data.categories, onNodeDataChange]
  );

  return (
    <VStack spacing={4} align="stretch">
      <Box>
        <Text fontWeight="bold" color="gray.700">
          {t("workflow.nodes.classifier.model")}:
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
          {t("workflow.nodes.classifier.categories")}:
        </Text>
        <VStack spacing={4} align="stretch">
          {node.data.categories?.map(
            (category: ClassifierCategory, index: number) => (
              <Box
                key={category.category_id}
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
                  <Text fontSize="sm" fontWeight="500" color="gray.900">
                    {`${t("workflow.nodes.classifier.category")} ${index + 1}`}
                  </Text>
                  {category.category_id !== "others_category" &&
                    category.category_id !==
                      node.data.categories[0].category_id && (
                      <IconButton
                        aria-label={t("workflow.common.delete")}
                        icon={<FaTrash />}
                        size="xs"
                        colorScheme="gray"
                        variant="ghost"
                        transition="all 0.2s"
                        _hover={{
                          transform: "scale(1.1)",
                        }}
                        onClick={() =>
                          handleRemoveCategory(category.category_id)
                        }
                      />
                    )}
                </HStack>
                {category.category_id === "others_category" ? (
                  <Text fontSize="sm" color="gray.600">
                    {t("workflow.nodes.classifier.othersCategory")}
                  </Text>
                ) : (
                  <Input
                    value={category.category_name}
                    onChange={(e) =>
                      handleCategoryNameChange(
                        category.category_id,
                        e.target.value
                      )
                    }
                    placeholder={String(
                      t("workflow.nodes.classifier.placeholder")
                    )}
                    size="sm"
                    bg="ui.inputbgcolor"
                    _hover={{ borderColor: "blue.200" }}
                    _focus={{
                      borderColor: "blue.50",
                      boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                    }}
                    transition="all 0.2s"
                  />
                )}
              </Box>
            )
          )}

          <Button
            leftIcon={<FaPlus />}
            onClick={handleAddCategory}
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
            {t("workflow.nodes.classifier.addCategory")}
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default ClassifierNodeProperties;
