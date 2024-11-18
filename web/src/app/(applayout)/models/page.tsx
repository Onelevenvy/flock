"use client";
import {
  Text,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Tag,
  TagLabel,

} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RiApps2Fill } from "react-icons/ri";


import {
  type ApiError,
  ProviderService,
  ModelOut,
  ModelProviderOut,
} from "@/client";
import TabSlider from "@/components/Common/TabSlider";
import ModelProviderIcon from "@/components/Icons/models";
import useCustomToast from "@/hooks/useCustomToast";

function ModelPage() {
  const showToast = useCustomToast();
  const { t } = useTranslation();

  const [models, setModels] = useState<ModelOut[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await ProviderService.readProviderListWithModels();
        const allModels: ModelOut[] = response.providers.flatMap((provider) =>
          provider.models.map((model) => ({
            ...model,
            provider: provider as ModelProviderOut,
          }))
        );

        setModels(allModels);
        setIsLoading(false);
      } catch (err) {
        setError(err as ApiError);
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  if (error) {
    const errDetail = error.body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const options = [
    {
      value: "all",
      text: t("panestate.models.all"),
      icon: <RiApps2Fill className="w-[14px] h-[14px] mr-1" />,
    },
  ];

  const [activeTab, setActiveTab] = useState("all");

  return (
    <Flex h="full">
      <Box flex="1" bg="ui.bgMain" display="flex" flexDirection="column" h="full">
        <Box px={6} py={4}>
          <Flex direction="row" justify="space-between" align="center" mb={2}>
            <Box>
              <TabSlider
                value={activeTab}
                onChange={setActiveTab}
                options={options}
              />
            </Box>
          </Flex>
        </Box>

        <Box flex="1" overflowY="auto" px={6} pb={4}>
          {isLoading ? (
            <Flex justify="center" align="center" height="full" width="full">
              <Spinner size="xl" color="ui.main" thickness="3px" />
            </Flex>
          ) : (
            models && (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6}>
                {models.map((model) => (
                  <Box
                    key={model.id}
                    bg="white"
                    p={6}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="gray.100"
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "md",
                      borderColor: "gray.200",
                    }}
                  >
                    <HStack spacing={4} mb={4}>
                      <Box
                        p={2}
                        borderRadius="lg"
                        bg={`${model.categories[0] ? "blue" : "purple"}.50`}
                      >
                        <ModelProviderIcon
                          h="6"
                          w="6"
                          modelprovider_name={model.provider.provider_name.toLowerCase()}
                          color={`${model.categories[0] ? "blue" : "purple"}.500`}
                        />
                      </Box>
                      <Heading
                        size="md"
                        color="gray.700"
                        fontWeight="600"
                        noOfLines={1}
                      >
                        {model.ai_model_name}
                      </Heading>
                    </HStack>

                    <Text fontSize="sm" color="gray.600" mb={4}>
                      Provider: {model.provider.provider_name}
                    </Text>

                    <Flex wrap="wrap" gap={2}>
                      {model.categories.map((category) => (
                        <Tag
                          key={category}
                          size="sm"
                          variant="subtle"
                          colorScheme="blue"
                          borderRadius="full"
                        >
                          <TagLabel fontWeight="500">{category}</TagLabel>
                        </Tag>
                      ))}
                      {model.capabilities.includes("vision") && (
                        <Tag
                          size="sm"
                          variant="subtle"
                          colorScheme="purple"
                          borderRadius="full"
                        >
                          <TagLabel fontWeight="500">vision</TagLabel>
                        </Tag>
                      )}
                    </Flex>
                  </Box>
                ))}
              </SimpleGrid>
            )
          )}
        </Box>
      </Box>
    </Flex>
  );
}

export default ModelPage;
