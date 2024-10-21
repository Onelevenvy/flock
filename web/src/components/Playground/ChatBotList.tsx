import {
  Box,
  Divider,
  Icon,
  IconButton,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRobot } from "react-icons/fa";
import { useQuery } from "react-query";

import { type ApiError, TeamsService } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import useChatMessageStore from "@/stores/chatMessageStore";
import useChatTeamIdStore from "@/stores/chatTeamIDStore"; // 引入 Zustand store

import { tqxIconLibrary } from "../Icons/TqxIcon";

const ChatBotList = () => {
  const showToast = useCustomToast();
  const navigate = useRouter();
  const { t } = useTranslation();
  const selctedColor = useColorModeValue(
    "ui.selctedColor",
    "ui.selctedColorDark"
  );

  const {
    data: teams,
    isError,
    error,
  } = useQuery("teams", () => TeamsService.readTeams({}));
  const { teamId, setTeamId } = useChatTeamIdStore(); // 使用 Zustand store
  const [selectedTeamId, setSelectedTeamId] = useState(teamId);

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;

    showToast("Something went wrong.", `${errDetail}`, "error");
  }
  const { setMessages } = useChatMessageStore();
  const handleRowClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    setTeamId(teamId); // 更新 Zustand store 中的 teamId
    navigate.push(`/playground?teamId=${teamId}`);
    setMessages([]);
  };

  // 同步 selectedTeamId 和 Zustand store 中的 teamId
  useEffect(() => {
    setTeamId(selectedTeamId);
  }, [selectedTeamId, setTeamId]);

  return (
    teams && (
      <Box
        display="flex"
        flexDirection="column"
        width="full"
        p={1}
        overflow={"hidden"}
        maxH="100%"
        h="100%"
        justifyItems={"center"}
      >
        <Box
          width="full"
          _hover={{ cursor: "pointer", backgroundColor: selctedColor }}
          borderRadius="md"
          onClick={() => handleRowClick(1)}
          p={4}
          backgroundColor={selectedTeamId === 1 ? selctedColor : "transparent"}
          display="flex"
          alignItems="center"
        >
          <Icon as={FaRobot} mr={2} ml={5} w={8} h={8} color="red.500" />
          <Box width="full" display="flex" flexDirection="column">
            <Text fontWeight="bold" fontSize="md" noOfLines={1}>
              {t("chat.chatBotList.easyTalk")}
            </Text>
            <Text color="gray.500" fontSize="xs" noOfLines={1}>
              {t("chat.chatBotList.description")}
            </Text>
          </Box>
        </Box>

        <Box width="full" pb={4} display="flex" alignItems="center">
          <Text ml="6" fontSize="sm" color="gray.500">
            {t("chat.chatBotList.agentList")}
          </Text>
        </Box>
        <Divider colorScheme={"gray"} />
        <Box
          display="flex"
          flexDirection={"column"}
          maxH="100%"
          h="100%"
          overflow="auto"
        >
          {teams.data
            .filter((team) => team.id !== 1)
            .map((team) => (
              <Box
                width="full"
                key={team.id}
                onClick={() => handleRowClick(team.id)}
                _hover={{
                  cursor: "pointer",
                  backgroundColor: selctedColor,
                }}
                borderRadius="md"
                p={4}
                mt={0.5}
                backgroundColor={
                  selectedTeamId === team.id ? selctedColor : "transparent"
                }
                display="flex"
                alignItems="center"
              >
                {team.icon && (
                  <IconButton
                    aria-label="icon_team"
                    icon={tqxIconLibrary[team.icon].icon}
                    colorScheme={tqxIconLibrary[team.icon].colorScheme}
                    backgroundColor={tqxIconLibrary[team.icon].backgroundColor}
                    ml={5}
                    size={"sm"}
                  />
                )}
                <Box width="full" display="flex" flexDirection="column" ml={4}>
                  <Text fontWeight="bold" fontSize="md" noOfLines={1}>
                    {team.name}
                  </Text>
                  <Text
                    display="flex"
                    fontFamily="Arial, sans-serif"
                    color="gray.500"
                    fontSize="xs"
                    noOfLines={1}
                  >
                    {team.description}
                  </Text>
                </Box>
              </Box>
            ))}
        </Box>
      </Box>
    )
  );
};

export default ChatBotList;
