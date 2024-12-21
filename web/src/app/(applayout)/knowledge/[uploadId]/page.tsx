"use client";
import {
  Box,
  VStack,
  HStack,
  Text,
  Textarea,
  Spinner,
  SimpleGrid,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  RadioGroup,
  Radio,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Progress,
  Icon,
  Flex,
  Heading,
  useColorModeValue,
  CloseButton,
} from "@chakra-ui/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { AiOutlineFileSearch } from "react-icons/ai";
import { FaVectorSquare, FaMix } from "react-icons/fa6";
import { GiArrowScope } from "react-icons/gi";
import { MdBuild } from "react-icons/md";
import { VscTriangleRight } from "react-icons/vsc";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useTranslation } from "react-i18next";

import { FiFileText } from "react-icons/fi";
import { ChevronRightIcon } from "@chakra-ui/icons";

import { UploadsService, type ApiError } from "@/client";
import CustomButton from "@/components/Common/CustomButton";
import useCustomToast from "@/hooks/useCustomToast";

const SearchTypeInfo = [
  {
    type: "vector",
    icon: FaVectorSquare,
  },
  {
    type: "fulltext",
    icon: AiOutlineFileSearch,
  },
  {
    type: "hybrid",
    icon: FaMix,
  },
];

function KnowledgeTest() {
  const { uploadId } = useParams();
  const showToast = useCustomToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("vector");
  const [topK, setTopK] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState(0.5);
  const [searchTaskId, setSearchTaskId] = useState<string | null>(null);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const { t } = useTranslation();

  const {
    data: upload,
    isLoading,
    isError,
    error,
  } = useQuery(
    ["upload", uploadId],
    () => UploadsService.readUploads({ status: "Completed" }),
    {
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;

        showToast("Error fetching upload", `${errDetail}`, "error");
      },
    }
  );

  const searchMutation = useMutation(
    (searchParams: {
      query: string;
      searchType: string;
      topK: number;
      scoreThreshold: number;
    }) =>
      UploadsService.searchUpload({
        uploadId: Number(uploadId),
        requestBody: {
          query: searchParams.query,
          search_type: searchParams.searchType,
          top_k: searchParams.topK,
          score_threshold: searchParams.scoreThreshold,
        },
      }),
    {
      onSuccess: (data) => {
        setSearchTaskId(data.task_id);
      },
      onError: (error: ApiError) => {
        showToast(
          "Search Error",
          error.body?.detail || "An error occurred",
          "error"
        );
      },
    }
  );

  const { data: searchResults, refetch: refetchSearchResults } = useQuery(
    ["searchResults", searchTaskId],
    () =>
      UploadsService.getSearchResults({
        taskId: searchTaskId as string,
      }),
    {
      enabled: !!searchTaskId,
      refetchInterval: (data) => (data?.status === "completed" ? false : 1000),
    }
  );

  useEffect(() => {
    if (searchResults?.status === "completed") {
      queryClient.setQueryData(["searchResults", searchTaskId], searchResults);
    }
  }, [searchResults, searchTaskId, queryClient]);

  const handleSearch = () => {
    if (!query.trim()) {
      showToast("Error", "Please enter a query before searching", "error");

      return;
    }
    searchMutation.mutate({ query, searchType, topK, scoreThreshold });
    setIsOptionsVisible(false);
  };

  const breadcrumbBg = useColorModeValue("ui.inputbgcolor", "gray.700");

  if (isLoading) {
    return (
      <Flex
        justify="center"
        align="center"
        height="100vh"
        width="full"
        bg="ui.bgMain"
      >
        <Spinner size="xl" color="ui.main" thickness="3px" speed="0.8s" />
      </Flex>
    );
  }

  const currentUpload = upload?.data.find((u) => u.id === Number(uploadId));

  const getSearchTypeDisplayName = (type: string) => {
    return t(`knowledge.test.searchType.${type}.name`);
  };

  return (
    <Box
      display="flex"
      h="full"
      maxH="full"
      flexDirection="column"
      overflow="hidden"
      bg="ui.bgMain"
    >
      <Box
        py={4}
        px={6}
        bg={breadcrumbBg}
        borderBottom="1px solid"
        borderColor="gray.100"
        backdropFilter="blur(10px)"
        transition="all 0.2s"
        position="relative"
        zIndex={1}
        _after={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: "blur(8px)",
          zIndex: -1,
        }}
      >
        <Breadcrumb
          spacing="8px"
          separator={
            <ChevronRightIcon
              color="gray.400"
              fontSize="sm"
              transition="all 0.2s"
            />
          }
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/knowledge">
              <Box
                display="flex"
                alignItems="center"
                color="gray.600"
                fontSize="sm"
                fontWeight="500"
              >
                <FiFileText style={{ marginRight: "6px" }} />
                {t("knowledge.page.title")}
              </Box>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink
              fontSize="sm"
              fontWeight="600"
              color="gray.800"
              display="flex"
              alignItems="center"
              bg="white"
              px={3}
              py={1}
              borderRadius="full"
              boxShadow="sm"
            >
              {currentUpload?.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>

      <Box flex={1} p={6} overflow="auto">
        <VStack spacing={6} align="stretch">
          <Box>
            <Heading size="md" color="gray.800" mb={2}>
              {t("knowledge.test.title")}
            </Heading>
            <Text color="gray.600" fontSize="sm">
              {t("knowledge.test.description")}
            </Text>
          </Box>

          <HStack spacing={6} align="flex-start">
            <Box
              position="relative"
              flex={1}
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
              transition="all 0.2s"
              _hover={{
                boxShadow: "md",
                borderColor: "gray.200",
              }}
            >
              <HStack
                p={4}
                borderBottom="1px solid"
                borderColor="gray.100"
                bg="ui.inputbgcolor"
                borderTopRadius="xl"
                spacing={4}
              >
                <Text fontWeight="600" color="gray.700" fontSize="sm">
                  {t("knowledge.test.knowledgeBase")}: {currentUpload?.name}
                </Text>
                <CustomButton
                  text={
                    searchType
                      ? getSearchTypeDisplayName(searchType)
                      : t("knowledge.test.actions.selectType")
                  }
                  variant="white"
                  onClick={() => setIsOptionsVisible(!isOptionsVisible)}
                  rightIcon={<VscTriangleRight />}
                  ml="auto"
                />
              </HStack>

              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("knowledge.test.searchType.placeholder")!}
                size="lg"
                p={4}
                minH="400px"
                border="none"
                _focus={{
                  boxShadow: "none",
                  borderColor: "ui.main",
                }}
                resize="none"
                fontSize="sm"
                transition="all 0.2s"
              />

              <Box position="absolute" bottom={4} right={4}>
                <CustomButton
                  text={t("knowledge.test.actions.search")}
                  variant="blue"
                  onClick={handleSearch}
                  rightIcon={<MdBuild />}
                  isLoading={searchMutation.isLoading}
                />
              </Box>
            </Box>

            <Box flex={1} minH="500px">
              {searchResults?.status === "pending" && (
                <Flex justify="center" align="center" h="full">
                  <Spinner
                    size="xl"
                    color="ui.main"
                    thickness="3px"
                    speed="0.8s"
                  />
                </Flex>
              )}

              {searchResults?.results && (
                <VStack spacing={4} align="stretch">
                  <Text fontSize="lg" fontWeight="600" color="gray.800">
                    {t("knowledge.test.results.title")}
                  </Text>
                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                    {searchResults.results.map((result: any, index: number) => (
                      <Box
                        key={index}
                        p={4}
                        bg="white"
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
                        <HStack mb={3} justify="space-between">
                          <HStack>
                            <Icon
                              as={GiArrowScope}
                              color="ui.main"
                              boxSize={5}
                            />
                            <Text
                              fontWeight="500"
                              color="gray.700"
                              fontSize="sm"
                            >
                              Score: {result.score.toFixed(2)}
                            </Text>
                          </HStack>
                          <Progress
                            value={result.score * 100}
                            size="sm"
                            colorScheme="blue"
                            borderRadius="full"
                            width="60%"
                          />
                        </HStack>
                        <Text
                          color="gray.600"
                          fontSize="sm"
                          noOfLines={6}
                          lineHeight="tall"
                        >
                          {result.content}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </VStack>
              )}
            </Box>

            {isOptionsVisible && (
              <Box
                position="fixed"
                right={0}
                top={0}
                h="100vh"
                w="500px"
                bg="white"
                p={6}
                borderLeft="1px solid"
                borderColor="gray.100"
                boxShadow="lg"
                overflowY="auto"
                zIndex={10}
                transform={
                  isOptionsVisible ? "translateX(0)" : "translateX(100%)"
                }
                transition="all 0.3s ease-in-out"
              >
                <VStack spacing={4} align="stretch">
                  <HStack justifyContent="space-between">
                    <Text fontSize="lg" fontWeight="600" color="gray.800">
                      {t("knowledge.test.settings.title")}
                    </Text>
                    <CloseButton
                      onClick={() => setIsOptionsVisible(false)}
                      position="absolute"
                      right={4}
                      top={4}
                      size="md"
                      borderRadius="full"
                      transition="all 0.2s"
                      _hover={{
                        bg: "gray.100",
                        transform: "rotate(90deg)",
                      }}
                    />
                  </HStack>

                  <RadioGroup onChange={setSearchType} value={searchType}>
                    <VStack spacing={3} align="stretch">
                      {SearchTypeInfo.map((info) => (
                        <Box
                          key={info.type}
                          p={3}
                          border="1px solid"
                          borderColor="gray.200"
                          borderRadius="lg"
                          transition="all 0.2s"
                          _hover={{ bg: "gray.50" }}
                        >
                          <HStack justify="space-between">
                            <HStack spacing={4}>
                              <Box
                                p={2}
                                borderRadius="md"
                                bg="blue.50"
                                color="blue.500"
                              >
                                <Icon as={info.icon} boxSize="5" />
                              </Box>
                              <VStack align="start" spacing={1}>
                                <Text fontWeight="500" color="gray.700">
                                  {t(
                                    `knowledge.test.searchType.${info.type}.name`
                                  )}
                                </Text>
                                <Text fontSize="sm" color="gray.500">
                                  {t(
                                    `knowledge.test.searchType.${info.type}.description`
                                  )}
                                </Text>
                              </VStack>
                            </HStack>
                            <Radio value={info.type} colorScheme="blue" />
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  </RadioGroup>

                  <Box
                    p={4}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                  >
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Text mb={2} fontWeight="500" color="gray.700">
                          Top K: {topK}
                        </Text>
                        <Slider
                          value={topK}
                          min={1}
                          max={10}
                          step={1}
                          onChange={setTopK}
                          colorScheme="blue"
                        >
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={4} />
                        </Slider>
                      </Box>

                      <Box>
                        <Text mb={2} fontWeight="500" color="gray.700">
                          Score Threshold: {scoreThreshold.toFixed(1)}
                        </Text>
                        <Slider
                          value={scoreThreshold}
                          min={0.1}
                          max={1}
                          step={0.1}
                          onChange={setScoreThreshold}
                          colorScheme="blue"
                        >
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={4} />
                        </Slider>
                      </Box>
                    </VStack>
                  </Box>
                </VStack>
              </Box>
            )}
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}

export default KnowledgeTest;
