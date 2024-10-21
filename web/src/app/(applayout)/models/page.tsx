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
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RiApps2Fill } from "react-icons/ri";

import {
  type ApiError,
  ModelOut,
  ProviderService,
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

  const rowTint = useColorModeValue("blackAlpha.50", "whiteAlpha.50");

  const options = [
    {
      value: "all",
      text: t("panestate.models.all"),
      icon: <RiApps2Fill className="w-[14px] h-[14px] mr-1" />,
    },
  ];

  const [activeTab, setActiveTab] = useState("all");

  return (
    <Flex>
      <Box flex="1">
        {isLoading ? (
          <Flex justify="center" align="center" height="100vh" width="full">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          models && (
            <Box
              maxW="full"
              maxH="full"
              display="flex"
              flexDirection={"column"}
              overflow={"hidden"}
            >
              <Box
                display="flex"
                flexDirection={"row"}
                justifyItems={"center"}
                py={2}
                px={5}
              >
                <Box>
                  <TabSlider
                    value={activeTab}
                    onChange={setActiveTab}
                    options={options}
                  />
                </Box>
              </Box>
              <Box mt="2" overflow={"auto"}>
                <Box maxH="full">
                  <SimpleGrid
                    columns={{ base: 1, md: 2, lg: 4 }}
                    spacing={8}
                    mx="5"
                  >
                    {models.map((model) => (
                      <Box
                        key={model.id}
                        _hover={{ backgroundColor: rowTint }}
                        cursor={"pointer"}
                        p={4}
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="gray.200"
                        boxShadow="lg"
                        bg="white"
                      >
                        <HStack spacing="16px">
                          <ModelProviderIcon
                            h="8"
                            w="8"
                            modelprovider_name={model.provider.provider_name.toLowerCase()}
                          />
                          <Heading noOfLines={1} size="md">
                            {model.ai_model_name}
                          </Heading>
                        </HStack>
                        <Box pt={2}>
                          <Text fontSize="sm" color="gray.600">
                            Provider: {model.provider.provider_name}
                          </Text>
                        </Box>
                        <Box pt={2}>
                          {model.categories.map((category) => (
                            <Tag
                              key={category}
                              mr={2}
                              mb={2}
                              size="sm"
                              colorScheme="blue"
                            >
                              <TagLabel>{category}</TagLabel>
                            </Tag>
                          ))}
                          {model.capabilities.includes("vision") && (
                            <Tag mr={2} mb={2} size="sm" colorScheme="purple">
                              <TagLabel>vision</TagLabel>
                            </Tag>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </SimpleGrid>
                </Box>
              </Box>
            </Box>
          )
        )}
      </Box>
    </Flex>
  );
}

export default ModelPage;
