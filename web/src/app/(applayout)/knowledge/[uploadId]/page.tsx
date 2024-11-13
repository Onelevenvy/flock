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

import { UploadsService, type ApiError } from "@/client";
import CustomButton from "@/components/Common/CustomButton";
import useCustomToast from "@/hooks/useCustomToast";

const SearchTypeInfo = [
  {
    type: "vector",
    displayName: "向量检索",
    description: "通过生成查询嵌入并查询与其向量表示最相似的文本分段。",
    icon: FaVectorSquare,
  },
  {
    type: "fulltext",
    displayName: "全文检索",
    description:
      "索引文档中的所有词汇，从而允许用户查询任意词汇，并返回包含这些词汇的文本片段。",
    icon: AiOutlineFileSearch,
  },
  {
    type: "hybrid",
    displayName: "混合检索",
    description:
      "同时执行全文检索和向量检索，并应用重排序步骤，从两类查询结果中选择匹配用户问题的最佳结果。",
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

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (isError) {
    return <Box>Error: {(error as ApiError).body?.detail}</Box>;
  }

  const currentUpload = upload?.data.find((u) => u.id === Number(uploadId));

  return (
    <>
      <Box py="3" pl="4" bg="gray.50">
        <Breadcrumb>
          <BreadcrumbItem>
            <Link href="/knowledge">
              <BreadcrumbLink color="gray.600" _hover={{ color: "blue.500" }}>
                Knowledge
              </BreadcrumbLink>
            </Link>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink fontWeight="600" color="gray.800">
              {currentUpload?.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>

      <Box px={8} py={4}>
        <Text fontSize="lg" fontWeight="600" color="gray.800" mb={2}>
          {t("knowledge.test.title")}
        </Text>
        <Text color="gray.600" mb={4}>
          {t("knowledge.test.description")}
        </Text>

        <HStack spacing={6} align="flex-start">
          <Box
            position="relative"
            flex={1}
            bg="white"
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.200"
            boxShadow="sm"
          >
            <HStack
              p={4}
              borderBottom="1px solid"
              borderColor="gray.100"
              bg="blue.50"
              borderTopRadius="xl"
            >
              <Text fontWeight="600" color="gray.700">
                {t("knowledge.test.knowledgeBase")}: {currentUpload?.name}
              </Text>
              <CustomButton
                text={
                  SearchTypeInfo.find((info) => info.type === searchType)
                    ?.displayName || t("knowledge.test.actions.selectType")
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
              placeholder={
                t("knowledge.test.searchType.placeholder") || "Enter your query"
              }
              size="lg"
              p={4}
              minH="400px"
              border="none"
              _focus={{ boxShadow: "none" }}
              resize="none"
            />

            <Box position="absolute" bottom={4} right={4}>
              <CustomButton
                text={t("knowledge.test.actions.search")}
                variant="primary"
                onClick={handleSearch}
                rightIcon={<MdBuild />}
                isLoading={searchMutation.isLoading}
              />
            </Box>
          </Box>

          <Box flex={1} minH="500px">
            {searchResults?.status === "pending" && (
              <Flex justify="center" align="center" h="full">
                <Spinner size="xl" color="blue.500" thickness="3px" />
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
                      borderColor="gray.200"
                      boxShadow="sm"
                      transition="all 0.2s"
                      _hover={{
                        transform: "translateY(-2px)",
                        boxShadow: "md",
                      }}
                    >
                      <HStack mb={3} justify="space-between">
                        <HStack>
                          <Icon
                            as={GiArrowScope}
                            color="blue.500"
                            boxSize={5}
                          />
                          <Text fontWeight="500" color="gray.700">
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
              position="absolute"
              right={0}
              top={0}
              h="full"
              w="500px"
              bg="white"
              p={6}
              borderLeft="1px solid"
              borderColor="gray.200"
              boxShadow="lg"
              overflowY="auto"
              zIndex={10}
            >
              <VStack spacing={4} align="stretch">
                <HStack justifyContent="space-between">
                  <Text fontSize="lg" fontWeight="600" color="gray.800">
                    {t("knowledge.test.settings.title")}
                  </Text>
                  <CustomButton
                    text="×"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOptionsVisible(false)}
                    _hover={{ bg: "gray.100" }}
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
                                {info.displayName}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {info.description}
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
      </Box>
    </>
  );
}

export default KnowledgeTest;
