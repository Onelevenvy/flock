"use client";
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorModeValue,
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
} from "@chakra-ui/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
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
      "同时执行全文检索和向量检索，并应用重排序步骤，从两类查询结果中选择匹配用户问题的最佳结果，用户可以选择设置权重或配置重新排序模型。",
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

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

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
      <Box py="3" pl="4" bg={"#f2f4f7"}>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link href="/knowledge">
              <BreadcrumbLink>Knowledge</BreadcrumbLink>
            </Link>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink fontWeight={"bold"}>
              {currentUpload?.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Box px={8}>
        <Text fontSize={"lg"} fontWeight={"bold"}>
          {t("knowledge.test.title")}
        </Text>
        <Text mt={2} mb={2}>
          {t("knowledge.test.description")}
        </Text>
        <HStack spacing={6} align="flex-start">
          <Box
            position="relative"
            flex={1}
            border={"1px solid"}
            borderColor={"gray.200"}
            borderRadius={"lg"}
          >
            <HStack
              borderRadius="md"
              border={"1px solid"}
              borderColor={"gray.200"}
              justifyContent={"space-between"}
              bg="#eef4ff"
            >
              <Text my={2} ml={3} fontWeight={"bold"}>
                {t("knowledge.test.knowledgeBase")}: {currentUpload?.name}
              </Text>
              <CustomButton
                text={
                  SearchTypeInfo.find((info) => info.type === searchType)
                    ?.displayName || t("knowledge.test.actions.selectType")
                }
                variant="white"
                my={2}
                mr={3}
                zIndex={2}
                onClick={() => setIsOptionsVisible(!isOptionsVisible)}
                rightIcon={<VscTriangleRight color="#155aef" size="12px" />}
              />
            </HStack>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                t("knowledge.test.searchType.placeholder") || "Enter input"
              }
              size="lg"
              px={"6"}
              pt={"6"}
              h="500px"
              bg="white"
            />
            <CustomButton
              text={t("knowledge.test.actions.search")}
              variant="blue"
              position="absolute"
              bottom={2}
              right={2}
              zIndex={2}
              onClick={handleSearch}
              rightIcon={<MdBuild color="white" size="12px" />}
            />
          </Box>

          <Box bg={"transparent"} px={6} pt={4} flex={1} minH="500px">
            {searchResults?.status === "pending" && <Spinner />}
            {searchResults?.results && (
              <>
                <Text mb={2} fontSize={"lg"} fontWeight={"bold"}>
                  {t("knowledge.test.results.title")}
                </Text>
                <SimpleGrid columns={{ base: 2, md: 2 }} spacing={4}>
                  {searchResults?.results?.map((result: any, index: number) => (
                    <Box
                      key={index}
                      p={4}
                      borderWidth={1}
                      borderRadius="md"
                      bg="white"
                      height="200px"
                      overflow="hidden"
                      position="relative"
                    >
                      <HStack justifyContent="space-between" mb={2}>
                        <Text fontWeight="bold">
                          {t("knowledge.test.results.score")}:{" "}
                          {result.score.toFixed(2)}
                        </Text>
                        <Box
                          display={"flex"}
                          flexDirection={"row"}
                          width="70%"
                          alignItems={"center"}
                        >
                          <Icon as={GiArrowScope} w={5} h={5} color="#3182ce" />
                          <Progress
                            value={result.score * 100}
                            width={"80%"}
                            size={"sm"}
                            colorScheme="blue"
                            ml={"3"}
                          />
                        </Box>
                      </HStack>
                      <Text
                        noOfLines={6}
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {result.content}
                      </Text>
                   
                    </Box>
                  ))}
                </SimpleGrid>
              </>
            )}
          </Box>

          {/* 搜索选项面板 */}
          {isOptionsVisible && (
            <Box
              position="absolute"
              right="0"
              top="0"
              bg={bgColor}
              p={4}
              borderRadius="md"
              borderWidth={1}
              borderColor={borderColor}
              boxShadow="md"
              h="full"
              w="600px"
            >
              <VStack spacing={4} align="stretch">
                <HStack justifyContent="space-between">
                  <Text fontWeight="bold">
                    {t("knowledge.test.settings.title")}
                  </Text>
                  <CustomButton
                    text="X"
                    variant="white"
                    size="sm"
                    onClick={() => setIsOptionsVisible(false)}
                  />
                </HStack>

                <RadioGroup onChange={setSearchType} value={searchType}>
                  {SearchTypeInfo.map((info) => (
                    <HStack
                      key={info.type}
                      justifyContent="space-between"
                      alignItems="center"
                      mt={2}
                      border={"1px solid"}
                      borderColor={"gray.200"}
                      borderRadius={"md"}
                      p={2}
                    >
                      <HStack spacing={4} flex={1}>
                        <Box as={info.icon} size="24px" color="blue.500" />
                        <VStack align="start" spacing={0}>
                          <Text>
                            {t(`knowledge.test.searchType.${info.type}.name`)}
                          </Text>
                          <Text fontSize="sm" color="gray.400">
                            {t(
                              `knowledge.test.searchType.${info.type}.description`
                            )}
                          </Text>
                        </VStack>
                      </HStack>
                      <Radio value={info.type} />
                    </HStack>
                  ))}
                </RadioGroup>
                <HStack
                  border={"1px solid"}
                  borderColor={"gray.200"}
                  borderRadius={"md"}
                  p={2}
                >
                  <Box w="50%" mx="1">
                    <Text>Top K: {topK}</Text>
                    <Slider
                      value={topK}
                      min={1}
                      max={10}
                      step={1}
                      onChange={(val) => setTopK(val)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Box w="50%" mx="1">
                    <Text>Score Threshold: {scoreThreshold.toFixed(1)}</Text>
                    <Slider
                      value={scoreThreshold}
                      min={0.1}
                      max={1}
                      step={0.1}
                      onChange={(val) => setScoreThreshold(val)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                </HStack>
              </VStack>
            </Box>
          )}
        </HStack>
      </Box>
    </>
  );
}

export default KnowledgeTest;
