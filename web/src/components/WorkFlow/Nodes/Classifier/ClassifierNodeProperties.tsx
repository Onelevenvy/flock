import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { useForm } from "react-hook-form";
import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { ClassifierCategory } from "../../types";

interface FormValues {
  model: string;
  provider: string;
  openai_api_key: string;
  openai_api_base: string;
}

interface ClassifierNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const ClassifierNodeProperties: React.FC<ClassifierNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { data: models, isLoading: isLoadingModel } = useModelQuery();

  const { control } = useForm<FormValues>({
    defaultValues: {
      model: node.data.model || "",
      provider: "",
      openai_api_key: "",
      openai_api_base: "",
    },
  });

  const handleAddCategory = useCallback(() => {
    const newCategory: ClassifierCategory = {
      category_id: uuidv4(),
      category_name: "",
    };

    const currentCategories = node.data.categories || [];
    onNodeDataChange(node.id, "categories", [
      ...currentCategories,
      newCategory,
    ]);
  }, [node.id, node.data.categories, onNodeDataChange]);

  const handleRemoveCategory = useCallback(
    (categoryId: string) => {
      const currentCategories = node.data.categories || [];
      if (currentCategories.length <= 2) return;
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
        <Text fontWeight="bold">Model:</Text>
        <ModelSelect
          models={models}
          control={control}
          name="model"
          value={node.data.model}
          isLoading={isLoadingModel}
          onModelSelect={(model: string) =>
            onNodeDataChange(node.id, "model", model)
          }
        />
      </Box>

      <Box>
        <Text fontWeight="bold" mb={2}>
          Categories:
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
              >
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" fontWeight="500" color="gray.600">
                    Category {index + 1}
                  </Text>
                  {node.data.categories.length > 2 && (
                    <IconButton
                      aria-label="Remove category"
                      icon={<FaTrash />}
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => handleRemoveCategory(category.category_id)}
                    />
                  )}
                </HStack>
                <Input
                  value={category.category_name}
                  onChange={(e) =>
                    handleCategoryNameChange(
                      category.category_id,
                      e.target.value
                    )
                  }
                  placeholder="Enter category name"
                  size="sm"
                  bg="white"
                />
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
          >
            Add Category
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default ClassifierNodeProperties;
