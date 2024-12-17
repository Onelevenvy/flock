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
  HStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GoGitMerge, GoGitPullRequestDraft, GoWorkflow } from "react-icons/go";
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

const getTeamIcon = (iconName: string | null | undefined) => {
  if (!iconName || !tqxIconLibrary[iconName]) {
    return tqxIconLibrary["default"].icon;
  }
  return tqxIconLibrary[iconName].icon;
};

function Teams() {
  const showToast = useCustomToast();
  const { t } = useTranslation();
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
    setTeamId(teamId);
    navigate.push(`/teams/${teamId}`);
  };

  const options = [
    {
      value: "all",
      text: t("panestate.team.all"),
      icon: <RiApps2Line className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "workflow",
      text: "Workflow",
      icon: <GoWorkflow className="w-[14px] h-[14px] mr-1" />,
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

  const getWorkflowColor = (workflow: string) => {
    const colors = {
      sequential: "green",
      hierarchical: "purple",
      chatbot: "yellow",
      ragbot: "orange",
      workflow: "blue",
    };
    return colors[workflow as keyof typeof colors] || "gray";
  };

  return (
    <Flex h="full">
      <Box
        flex="1"
        bg="ui.bgMain"
        display="flex"
        flexDirection="column"
        h="full"
      >
        <Box px={6} py={4}>
          <Flex direction="row" justify="space-between" align="center" mb={2}>
            <Box>
              <TabSlider
                value={activeTab}
                onChange={setActiveTab}
                options={options}
              />
            </Box>
            <Box>
              <Navbar type="Team" />
            </Box>
          </Flex>
        </Box>

        <Box flex="1" overflowY="auto" px={6} pb={4}>
          {isLoading ? (
            <Flex justify="center" align="center" height="full" width="full">
              <Spinner size="xl" color="ui.main" thickness="3px" />
            </Flex>
          ) : (
            filteredTeams && (
              <SimpleGrid
                columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
                spacing={6}
              >
                {filteredTeams.map((team) => (
                  <Box
                    key={team.id}
                    onClick={() => handleRowClick(team.id)}
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
                        borderRadius="lg"
                        bg={`${getWorkflowColor(team.workflow)}.50`}
                      >
                        <IconButton
                          aria-label="Team icon"
                          icon={getTeamIcon(team.icon)}
                          size="sm"
                          variant="ghost"
                          color={`${getWorkflowColor(team.workflow)}.500`}
                        />
                      </Box>
                      <Heading
                        size="md"
                        color="gray.700"
                        fontWeight="600"
                        noOfLines={1}
                      >
                        {team.name}
                      </Heading>
                    </HStack>

                    <Text
                      color="gray.600"
                      fontSize="sm"
                      mb={4}
                      noOfLines={2}
                      minH="2.5rem"
                    >
                      {team.description || "N/A"}
                    </Text>

                    <Flex justify="space-between" align="center" mt="auto">
                      <Tag
                        size="md"
                        variant="subtle"
                        colorScheme={getWorkflowColor(team.workflow)}
                        borderRadius="full"
                        px={3}
                        py={1}
                      >
                        <TagLabel fontWeight="500">{team.workflow}</TagLabel>
                      </Tag>
                      <ActionsMenu type="Team" value={team} />
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

export default Teams;
