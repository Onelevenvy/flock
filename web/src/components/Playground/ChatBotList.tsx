import {
  Box,
  Divider,
  Icon,
  IconButton,
  Text,
  useColorModeValue,
  VStack,
  HStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRobot } from "react-icons/fa";
import { useQuery } from "react-query";

import { type ApiError, TeamsService } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import useChatMessageStore from "@/stores/chatMessageStore";
import useChatTeamIdStore from "@/stores/chatTeamIDStore";

import { tqxIconLibrary } from "../Icons/TqxIcon";

const ChatBotList = () => {
  const showToast = useCustomToast();
  const navigate = useRouter();
  const { t } = useTranslation();
  const selectedBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const hoverBg = useColorModeValue("gray.100", "whiteAlpha.200");

  const {
    data: teams,
    isError,
    error,
  } = useQuery("teams", () => TeamsService.readTeams({}));
  const { teamId, setTeamId } = useChatTeamIdStore();
  const [selectedTeamId, setSelectedTeamId] = useState(teamId);

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const { setMessages } = useChatMessageStore();

  const handleRowClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    setTeamId(teamId);
    navigate.push(`/playground?teamId=${teamId}`);
    setMessages([]);
  };

  useEffect(() => {
    setTeamId(selectedTeamId);
  }, [selectedTeamId, setTeamId]);

  return (
    teams && (
      <VStack
        h="100vh"
        w="full"
        spacing={0}
        bg="white"
        borderRight="1px solid"
        borderColor="gray.200"
      >
        <Box p={4} w="full">
          <Box
            w="full"
            onClick={() => handleRowClick(1)}
            cursor="pointer"
            p={3}
            borderRadius="lg"
            transition="all 0.2s"
            bg={selectedTeamId === 1 ? selectedBg : "transparent"}
            _hover={{ bg: hoverBg }}
          >
            <HStack spacing={3}>
              <Box
                borderRadius="lg"
                bg="red.50"
                color="red.500"
                as={IconButton}
              >
                <Icon as={FaRobot} boxSize={5} />
              </Box>
              <Box>
                <Text fontWeight="600" color="gray.700">
                  {t("chat.chatBotList.easyTalk")}
                </Text>
                <Text color="gray.500" fontSize="sm">
                  {t("chat.chatBotList.description")}
                </Text>
              </Box>
            </HStack>
          </Box>
        </Box>

        <Box w="full" px={4} py={2}>
          <Text fontSize="sm" fontWeight="500" color="gray.500">
            {t("chat.chatBotList.agentList")}
          </Text>
        </Box>

        <Divider />

        <VStack
          flex={1}
          w="full"
          spacing={1}
          overflowY="auto"
          p={4}
          sx={{
            "&::-webkit-scrollbar": {
              width: "4px",
            },
            "&::-webkit-scrollbar-track": {
              width: "6px",
              bg: "gray.50",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "gray.200",
              borderRadius: "24px",
            },
          }}
        >
          {teams.data
            .filter((team) => team.id !== 1)
            .map((team) => (
              <Box
                key={team.id}
                w="full"
                onClick={() => handleRowClick(team.id)}
                cursor="pointer"
                p={3}
                borderRadius="lg"
                transition="all 0.2s"
                bg={selectedTeamId === team.id ? selectedBg : "transparent"}
                _hover={{ bg: hoverBg }}
              >
                <HStack spacing={3}>
                  {team.icon && (
                    <Box
                      p={2}
                      borderRadius="lg"
                      bg={`${tqxIconLibrary[team.icon].colorScheme}.50`}
                    >
                      <IconButton
                        aria-label="Team icon"
                        icon={tqxIconLibrary[team.icon].icon}
                        size="sm"
                        variant="ghost"
                        color={`${tqxIconLibrary[team.icon].colorScheme}.500`}
                      />
                    </Box>
                  )}
                  <Box>
                    <Text fontWeight="600" color="gray.700">
                      {team.name}
                    </Text>
                    <Text color="gray.500" fontSize="sm" noOfLines={1}>
                      {team.description}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            ))}
        </VStack>
      </VStack>
    )
  );
};

export default ChatBotList;
