"use client";
import {
  Box,
  Flex,
  Heading,
  IconButton,
  SimpleGrid,
  Spinner,
  Tag,
  TagLabel,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GoGitMerge, GoGitPullRequestDraft } from "react-icons/go";
import { PiChatCircleDots } from "react-icons/pi";
import { RiApps2Line, RiBookLine } from "react-icons/ri";
import { useQuery } from "react-query";

import { type ApiError, TeamsService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import TabSlider from "@/components/Common/TabSlider";
import { tqxIconLibrary } from "@/components/Icons/TqxIcon";
import useCustomToast from "@/hooks/useCustomToast";
import { useTabSearchParams } from "@/hooks/useTabSearchparams";
import useChatTeamIdStore from "@/stores/chatTeamIDStore";

function Teams() {
  const showToast = useCustomToast();
  const { t } = useTranslation();
  const rowTint = useColorModeValue("blackAlpha.50", "whiteAlpha.50");
  const navigate = useRouter();
  const { setTeamId } = useChatTeamIdStore();
  const {
    data: teams,
    isLoading,
    isError,
    error,
  } = useQuery("teams", () => TeamsService.readTeams({}));

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;

    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const handleRowClick = (teamId: number) => {
    setTeamId(teamId); // 确保在导航之前更新 teamId
    navigate.push(`/teams/${teamId}`);
  };
  const options = [
    {
      value: "all",
      text: t("panestate.team.all"),
      icon: <RiApps2Line className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "sequential",
      text: "S-Agent",
      icon: <GoGitPullRequestDraft className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "hierarchical",
      text: "H-Agent",
      icon: <GoGitMerge className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "chatbot",
      text: t("panestate.team.chatbot"),
      icon: <PiChatCircleDots className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "ragbot",
      text: t("panestate.team.ragbot"),
      icon: <RiBookLine className="w-[14px] h-[14px] mr-1" />,
    },
  ];
  const [activeTab, setActiveTab] = useTabSearchParams({
    searchParamName: "workflow",
    defaultTab: "all",
  });

  const filteredTeams = useMemo(() => {
    return activeTab === "all"
      ? teams?.data
      : teams?.data.filter((team) => team.workflow === activeTab);
  }, [activeTab, teams?.data]);

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        filteredTeams && (
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
                <Navbar type={"Team"} />
              </Box>
            </Box>
            <Box mt={2} overflow={"auto"}>
              <Box maxH="full">
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={8} mx={5}>
                  {filteredTeams.map((team) => (
                    <Box
                      key={team.id}
                      _hover={{ backgroundColor: rowTint }}
                      cursor={"pointer"}
                      onClick={() => handleRowClick(team.id)}
                      p={4}
                      borderRadius="xl"
                      borderWidth="1px"
                      borderColor="gray.200"
                      boxShadow="lg"
                      bg="white"
                    >
                      <Flex justify="space-between" alignItems="center">
                        <Box
                          display="flex"
                          flexDirection={"row"}
                          alignItems={"center"}
                        >
                          <Box>
                            {team.icon && (
                              <IconButton
                                colorScheme={
                                  tqxIconLibrary[team.icon].colorScheme
                                }
                                aria-label="Search database"
                                size={"sm"}
                                icon={tqxIconLibrary[team.icon].icon}
                                backgroundColor={
                                  tqxIconLibrary[team.icon].backgroundColor
                                }
                              />
                            )}
                          </Box>
                          <Box>
                            <Heading as="h4" size="md" ml={4}>
                              {team.name}
                            </Heading>
                          </Box>
                        </Box>
                      </Flex>
                      <Box mt={3} minH={"20"}>
                        <Text
                          color={!team.description ? "gray.400" : "gray.400"}
                          noOfLines={2}
                        >
                          {team.description || "N/A"}
                        </Text>
                      </Box>
                      <Box
                        display="flex"
                        flexDirection={"row"}
                        mt={3}
                        alignItems={"center"}
                        justifyContent="space-between"
                      >
                        <Box>
                          <Tag
                            variant="outline"
                            colorScheme="green"
                            size={"sm"}
                          >
                            <TagLabel>{team.workflow || "N/A"}</TagLabel>
                          </Tag>
                        </Box>
                        <Box>
                          <ActionsMenu type={"Team"} value={team} />
                        </Box>
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

export default Teams;
