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
  Text,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
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
  selectedProvider?: string;
}

function ModelSelect<T extends FieldValues>({
  models,
  control,
  name,
  onModelSelect,
  isLoading,
  value,
  selectedProvider,
}: ModelSelectProps<T>) {
  const [internalProvider, setInternalProvider] = useState<string>("openai");

  const effectiveProvider = selectedProvider || internalProvider;

  const filteredModels = models?.data.filter(
    (model) =>
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

  useEffect(() => {
    if (!selectedProvider && value) {
      const selectedModelData = models?.data.find(
        (model) => model.ai_model_name === value
      );
      if (selectedModelData) {
        setInternalProvider(selectedModelData.provider.provider_name);
      }
    }
  }, [value, models, selectedProvider]);

  return (
    <Box>
      <FormControl>
        {isLoading ? (
          <Spinner size="md" color="ui.main" thickness="3px" />
        ) : (
          <Controller
            name={name}
            control={control}
            render={({ field }) => {
              return (
                <Menu autoSelect={false}>
                  <MenuButton
                    as={Button}
                    leftIcon={
                      <ModelProviderIcon
                        modelprovider_name={effectiveProvider}
                        w={5}
                        h={5}
                      />
                    }
                    rightIcon={<ChevronDownIcon w={4} h={4} />}
                    w="full"
                    textAlign="left"
                    bg="ui.inputbgcolor"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "gray.300",
                      transform: "translateY(-1px)",
                      boxShadow: "sm",
                    }}
                    _active={{
                      transform: "translateY(0)",
                    }}
                  >
                    {field.value || value || "选择一个模型"}
                  </MenuButton>
                  <MenuList
                    py={2}
                    border="1px solid"
                    borderColor="gray.100"
                    borderRadius="lg"
                    boxShadow="lg"
                    maxH="60vh"
                    overflowY="auto"
                    sx={{
                      "&::-webkit-scrollbar": {
                        width: "4px",
                      },
                      "&::-webkit-scrollbar-track": {
                        bg: "gray.50",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        bg: "gray.300",
                        borderRadius: "full",
                      },
                    }}
                  >
                    {Object.keys(groupedModels || {}).map((providerName) => (
                      <MenuGroup
                        key={providerName}
                        title={providerName}
                        color="gray.700"
                        fontWeight="600"
                        px={3}
                        py={2}
                      >
                        {groupedModels![providerName].map((model) => (
                          <MenuItem
                            key={model.id}
                            onClick={() => {
                              field.onChange(model.ai_model_name);
                              onModelSelect(model.ai_model_name);
                            }}
                            px={4}
                            py={2}
                            transition="all 0.2s"
                            _hover={{
                              bg: "gray.50",
                            }}
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box display="flex" alignItems="center" flex="1">
                              <ModelProviderIcon
                                modelprovider_name={providerName}
                                mr={3}
                                w={5}
                                h={5}
                              />
                              <Text isTruncated maxW="200px">
                                {model.ai_model_name}
                              </Text>
                            </Box>
                            {model.capabilities?.includes("vision") && (
                              <FaEye
                                style={{
                                  marginLeft: "12px",
                                  color: "var(--chakra-colors-gray-400)",
                                  flexShrink: 0,
                                }}
                              />
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
