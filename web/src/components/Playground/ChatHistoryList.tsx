import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { StarIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";

import useChatMessageStore from "@/stores/chatMessageStore";
import { type ApiError, MembersService, ThreadsService } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface ChatHistoryProps {
  teamId: number;
  isPlayground?: boolean;
}

const ChatHistoryList = ({ teamId, isPlayground }: ChatHistoryProps) => {
  const queryClient = useQueryClient();
  const navigate = useRouter();
  const showToast = useCustomToast();
  const rowTint = useColorModeValue("blackAlpha.50", "whiteAlpha.50");
  const selctedColor = useColorModeValue(
    "ui.selctedColor",
    "ui.selctedColorDark"
  );
  const [localTeamId, setLocalTeamId] = useState(teamId);
  const { t } = useTranslation();

  useEffect(() => {
    setLocalTeamId(teamId);
  }, [teamId]);

  const {
    data: members,
    isLoading: membersLoading,
    isError: membersIsError,
    error: membersError,
  } = useQuery(
    ["teams", localTeamId, "members"],
    () => MembersService.readMembers({ teamId: localTeamId }),
    {
      enabled: !!localTeamId,
    }
  );

  const {
    data: threads,
    isLoading,
    isError,
    error,
  } = useQuery(["threads", teamId], () =>
    ThreadsService.readThreads({ teamId: teamId })
  );

  const deleteThread = async (threadId: string) => {
    await ThreadsService.deleteThread({
      teamId: teamId,
      id: threadId,
    });
  };

  const deleteThreadMutation = useMutation(deleteThread, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      console.log("error", errDetail);
    },
    onSettled: () => {
      queryClient.invalidateQueries(["threads", teamId]);
      queryClient.invalidateQueries(["threads", selectedThreadId]);
    },
  });

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { setMessages } = useChatMessageStore();
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const onClickRowHandler = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (isPlayground) {
      navigate.push(`/playground?teamId=${teamId}&threadId=${threadId}`);
    } else {
      navigate.push(`/teams/${teamId}?threadId=${threadId}`);
    }
  };

  const handleDeleteThread = () => {
    if (selectedThreadId) {
      deleteThreadMutation.mutate(selectedThreadId);
      setMessages([]);
      setShouldNavigate(true);
    }
  };

  useEffect(() => {
    if (shouldNavigate) {
      if (isPlayground) {
        navigate.push(`/playground?teamId=${teamId}`);
      } else {
        navigate.push(`/teams/${teamId}`);
      }
      setShouldNavigate(false);
    }
  }, [shouldNavigate, isPlayground, teamId, navigate]);

  if (isError || membersIsError) {
    const errors = error || membersError;
    const errDetail = (errors as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  return (
    <Box h="100vh" bg="white" borderLeft="1px solid" borderColor="gray.200">
      {isLoading && membersLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" thickness="3px" />
        </Flex>
      ) : (
        threads &&
        members && (
          <VStack h="full" spacing={0}>
            <Box p={4} w="full" borderBottom="1px solid" borderColor="gray.100">
              <Text fontSize="lg" fontWeight="bold">
                {t("chat.chatHistoryList.chatHistory")}
              </Text>
            </Box>

            <VStack
              flex={1}
              w="full"
              spacing={0}
              overflowY="auto"
              overflowX="hidden"
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
              {threads.data.map((thread) => (
                <Box
                  key={thread.id}
                  w="full"
                  borderRadius="md"
                  cursor="pointer"
                  onClick={() => onClickRowHandler(thread.id)}
                  onMouseEnter={() => setShowMenu(true)}
                  onMouseLeave={() => setShowMenu(false)}
                  position="relative"
                  transition="all 0.2s"
                  bg={
                    selectedThreadId === thread.id
                      ? selctedColor
                      : "transparent"
                  }
                  _hover={{ bg: rowTint }}
                >
                  <Flex align="center" p={4} position="relative">
                    <Icon as={StarIcon} color="gray.400" />
                    <Box flex={1} ml={4}>
                      <Box minW="45%" maxW="45%" mr={2}>
                        <Text
                          fontFamily="Arial, sans-serif"
                          fontSize="sm"
                          color="gray.500"
                          noOfLines={1}
                        >
                          {thread.query}
                        </Text>
                      </Box>
                      <Box minW="40%" maxW="40%" mr={2}>
                        <Text
                          fontFamily="Arial, sans-serif"
                          fontSize="sm"
                          color="gray.500"
                          noOfLines={1}
                        >
                          {new Date(thread.updated_at).toLocaleString()}
                        </Text>
                      </Box>
                    </Box>
                    {showMenu && selectedThreadId === thread.id && (
                      <Box position="absolute" right={4}>
                        <Button
                          as={IconButton}
                          size="sm"
                          aria-label="Delete thread"
                          icon={<Icon as={Trash2Icon} boxSize={4} />}
                          variant="ghost"
                          colorScheme="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread();
                          }}
                        />
                      </Box>
                    )}
                  </Flex>
                </Box>
              ))}
            </VStack>
          </VStack>
        )
      )}
    </Box>
  );
};

export default ChatHistoryList;
