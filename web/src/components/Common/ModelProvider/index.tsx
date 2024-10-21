"use client";
import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  FormControl,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Spinner,
} from "@chakra-ui/react";
import React, { useState, useCallback } from "react";
import { type Control, Controller, FieldValues, Path } from "react-hook-form";
import { FaEye } from "react-icons/fa";

import type { ModelsOut } from "@/client/models/ModelsOut";

import ModelProviderIcon from "../../Icons/models";

interface ModelSelectProps<T extends FieldValues> {
  models: ModelsOut | undefined;
  control: Control<T>;
  name: Path<T>;
  onModelSelect: (selectData: string) => void;
  isLoading?: boolean;
  value?: string;
}

function ModelSelect<T extends FieldValues>({
  models,
  control,
  name,
  onModelSelect,
  isLoading,
  value,
}: ModelSelectProps<T>) {
  const filteredModels = models?.data.filter(model => 
    model.categories.includes("llm") || model.categories.includes("chat")
  );

  const groupedModels = filteredModels?.reduce(
    (acc, model) => {
      const providerName = model.provider.provider_name;

      if (!acc[providerName]) {
        acc[providerName] = [];
      }
      acc[providerName].push(model);

      return acc;
    },
    {} as Record<string, typeof filteredModels>
  );

  const [selectedModelProvider, setSelectedModelProvider] =
    useState<string>("openai");

  const updateSelectedProvider = useCallback(
    (modelName: string) => {
      const selectedModelData = models?.data.find(
        (model) => model.ai_model_name === modelName
      );

      if (selectedModelData) {
        setSelectedModelProvider(selectedModelData.provider.provider_name);
      }
    },
    [models]
  );

  return (
    <Box>
      <FormControl>
        {isLoading ? (
          <Spinner size="md" />
        ) : (
          <Controller
            name={name}
            control={control}
            render={({ field }) => {
              updateSelectedProvider(field.value);

              return (
                <Menu autoSelect={false}>
                  <MenuButton
                    as={Button}
                    leftIcon={
                      <ModelProviderIcon
                        modelprovider_name={selectedModelProvider}
                        w={5}
                        h={5}
                      />
                    }
                    rightIcon={<ChevronDownIcon w={4} h={4} />}
                    w="full"
                    textAlign={"left"}
                  >
                    {field.value || value || "选择一个模型"}
                  </MenuButton>
                  <MenuList>
                    {Object.keys(groupedModels || {}).map((providerName) => (
                      <MenuGroup key={providerName} title={providerName}>
                        {groupedModels![providerName].map((model) => (
                          <MenuItem
                            key={model.id}
                            onClick={() => {
                              field.onChange(model.ai_model_name);
                              onModelSelect(model.ai_model_name);
                            }}
                          >
                            <ModelProviderIcon
                              modelprovider_name={providerName}
                              mr={2}
                              w={6}
                              h={6}
                            />
                            {model.ai_model_name}
                            {model.capabilities.includes("vision") && (
                              <FaEye style={{ marginLeft: 'auto' }} color="gray" />
                            )}
                          </MenuItem>
                        ))}
                      </MenuGroup>
                    ))}
                  </MenuList>
                </Menu>
              );
            }}
          />
        )}
      </FormControl>
    </Box>
  );
}

export default ModelSelect;
