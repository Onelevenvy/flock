"use client";
import {
  Badge,
  Box,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Text,
  Icon,
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  FaFileExcel,
  FaFileExport,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
  FaFileCode,
} from "react-icons/fa";
import { RiListUnordered } from "react-icons/ri";
import { TbWorldWww } from "react-icons/tb";

import { type ApiError, UploadsService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import TabSlider from "@/components/Common/TabSlider";
import useCustomToast from "@/hooks/useCustomToast";
import { useTabSearchParams } from "@/hooks/useTabSearchparams";
import { useQuery } from "react-query";

function Uploads() {
  const showToast = useCustomToast();
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: uploads,
    isLoading,
    isError,
    error,
  } = useQuery("uploads", () => UploadsService.readUploads({}));

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const options = [
    {
      value: "all",
      text: t("knowledge.page.types.all"),
      icon: <RiListUnordered className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "pdf",
      text: t("knowledge.page.types.pdf"),
      icon: <FaFilePdf className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "excel",
      text: t("knowledge.page.types.excel"),
      icon: <FaFileExcel className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "word",
      text: t("knowledge.page.types.word"),
      icon: <FaFileWord className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "ppt",
      text: t("knowledge.page.types.ppt"),
      icon: <FaFilePowerpoint className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "md",
      text: t("knowledge.page.types.md"),
      icon: <FaFileExport className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "web",
      text: t("knowledge.page.types.web"),
      icon: <TbWorldWww className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "txt",
      text: t("knowledge.page.types.txt"),
      icon: <FaFileCode className="w-[14px] h-[14px] mr-1" />,
    },
  ];

  const [activeTab, setActiveTab] = useTabSearchParams({
    searchParamName: "tooltype",
    defaultTab: "all",
  });

  const handleUploadClick = (uploadId: number) => {
    router.push(`/knowledge/${uploadId}`);
  };

  const getFileType = (fileName: string): string => {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const typeMap: { [key: string]: string } = {
      pdf: "pdf",
      xlsx: "excel",
      xls: "excel",
      doc: "word",
      docx: "word",
      ppt: "ppt",
      pptx: "ppt",
      md: "md",
      txt: "txt",
    };
    return typeMap[extension] || "txt";
  };

  const getFileIcon = (fileName: string) => {
    const type = getFileType(fileName);
    const icons = {
      pdf: FaFilePdf,
      excel: FaFileExcel,
      word: FaFileWord,
      ppt: FaFilePowerpoint,
      md: FaFileExport,
      web: TbWorldWww,
      txt: FaFileCode,
    };
    return icons[type as keyof typeof icons] || FaFileCode;
  };

  const getFileColor = (fileName: string) => {
    const type = getFileType(fileName);
    const colors = {
      pdf: "red",
      excel: "green",
      word: "gray",
      ppt: "orange",
      md: "purple",
      web: "cyan",
      txt: "blue",
    };
    return colors[type as keyof typeof colors] || "gray";
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date
      .toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  };

  return (
    <Box bg="ui.bgMain" minH="100vh" px={6} py={4}>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" thickness="3px" />
        </Flex>
      ) : (
        uploads && (
          <Box maxW="full" maxH="full">
            <Flex direction="row" justify="space-between" align="center" mb={6}>
              <Box>
                <TabSlider
                  value={activeTab}
                  onChange={setActiveTab}
                  options={options}
                />
              </Box>
              <Box>
                <Navbar type="Knowledge" />
              </Box>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6}>
              {uploads.data.map((upload) => (
                <Box
                  key={upload.id}
                  onClick={() => handleUploadClick(upload.id)}
                  bg="white"
                  p={6}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="gray.100"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "md",
                    borderColor: "gray.200",
                  }}
                >
                  <HStack spacing={4} mb={4}>
                    <Box
                      as={IconButton}
                      borderRadius="lg"
                      bg={`${getFileColor(upload.name)}.50`}
                    >
                      <Icon
                        as={getFileIcon(upload.name)}
                        boxSize="6"
                        color={`${getFileColor(upload.name)}.500`}
                      />
                    </Box>
                    <Heading
                      size="md"
                      color="gray.700"
                      fontWeight="600"
                      noOfLines={1}
                    >
                      {upload.name}
                    </Heading>
                  </HStack>

                  <Text
                    color="gray.600"
                    fontSize="sm"
                    mb={4}
                    noOfLines={2}
                    minH="2.5rem"
                  >
                    {upload.description || t("knowledge.page.noDescription")}
                  </Text>

                  <Flex justify="space-between" align="center" mt="auto">
                    <Text fontSize="sm" color="gray.500">
                      {formatDateTime(upload.last_modified)}
                    </Text>
                    <HStack spacing={3}>
                      <Badge
                        colorScheme={
                          upload.status === "Completed" ? "green" : "yellow"
                        }
                        borderRadius="full"
                        px={3}
                        py={1}
                      >
                        {upload.status}
                      </Badge>
                      <ActionsMenu type="Upload" value={upload} />
                    </HStack>
                  </Flex>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )
      )}
    </Box>
  );
}

export default Uploads;
