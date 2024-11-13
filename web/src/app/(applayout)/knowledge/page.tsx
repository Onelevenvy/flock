"use client";
import {
  Badge,
  Box,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  useColorModeValue,
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
import { useQuery } from "react-query";

import { type ApiError, UploadsService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import TabSlider from "@/components/Common/TabSlider";
import useCustomToast from "@/hooks/useCustomToast";
import { useTabSearchParams } from "@/hooks/useTabSearchparams";

function Uploads() {
  const showToast = useCustomToast();
  const { t } = useTranslation();
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

  const rowTint = useColorModeValue("blackAlpha.50", "whiteAlpha.50");
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
  const router = useRouter();

  const handleUploadClick = (uploadId: number) => {
    router.push(`/knowledge/${uploadId}`);
  };

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        uploads && (
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
              <Box ml={"auto"}>
                <Navbar type={"Knowledge"} />
              </Box>
            </Box>
            <Box mt="2" overflow={"auto"}>
              <Box maxH="full">
                <SimpleGrid
                  columns={{ base: 1, md: 2, lg: 4 }}
                  spacing={8}
                  mx="5"
                >
                  {uploads.data.map((upload) => (
                    <Box
                      key={upload.id}
                      _hover={{ backgroundColor: rowTint }}
                      cursor={"pointer"}
                      p={4}
                      borderRadius="xl"
                      borderWidth="1px"
                      borderColor="gray.200"
                      boxShadow="lg"
                      bg="white"
                      onClick={() => handleUploadClick(upload.id)}
                    >
                      <Heading size="md">{upload.name}</Heading>
                      <Box
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {upload.description || t("knowledge.page.noDescription")}
                      </Box>
                      <Box
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {upload.last_modified}
                      </Box>
                      <Box
                        pt={4}
                        display={"flex"}
                        justifyContent={"space-between"}
                        alignItems={"center"}
                      >
                        <Badge colorScheme="green">
                          {t(`knowledge.page.status.${upload.status.toLowerCase()}`)}
                        </Badge>
                        <ActionsMenu type={"Upload"} value={upload} />
                      </Box>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            </Box>
          </Box>
        )
      )}
    </>
  );
}

export default Uploads;
