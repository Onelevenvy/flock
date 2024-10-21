import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Spinner,
  Text,
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
  const [localTeamId, setLocalTeamId] = useState(teamId);

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
      enabled: !!localTeamId, // 确保在 localTeamId 存在时才执行查询
    },
  );

  const {
    data: threads,
    isLoading,
    isError,
    error,
  } = useQuery(["threads", teamId], () =>
    ThreadsService.readThreads({ teamId: teamId }),
  );

  const deleteThread = async (threadId: string) => {
    await ThreadsService.deleteThread({
      teamId: teamId,
      id: threadId,
    });
  };
  const selctedColor = useColorModeValue(
    "ui.selctedColor",
    "ui.selctedColorDark",
  );
  const deleteThreadMutation = useMutation(deleteThread, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      // showToast("Unable to delete thread.", `${errDetail}`, "error");
      console.log("error", errDetail);
    },
    onSettled: () => {
      queryClient.invalidateQueries(["threads", teamId]);
      queryClient.invalidateQueries(["threads", selectedThreadId]);
    },
  });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const onClickRowHandler = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (isPlayground) {
      navigate.push(`/playground?teamId=${teamId}&threadId=${threadId}`);
    } else {
      navigate.push(`/teams/${teamId}?threadId=${threadId}`);
    }
  };

  const { setMessages } = useChatMessageStore();
  const [shouldNavigate, setShouldNavigate] = useState(false);

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
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      {isLoading && membersLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box h="full" maxH={"full"} overflow={"hidden"}>
          {threads && members && (
            <>
              <Box p={4} display="flex" overflow={"hidden"}>
                <Text fontSize="lg" fontWeight="bold">
                  {t("chat.chatHistoryList.chatHistory")}
                </Text>
              </Box>
              <Box overflowY={"auto"} overflowX={"hidden"} maxH="full" h="full">
                {threads.data.map((thread) => (
                  <Box
                    key={thread.id}
                    width={"full"}
                    borderRadius="md"
                    borderColor={rowTint}
                    cursor="pointer"
                    onClick={() => onClickRowHandler(thread.id)}
                    _hover={{ backgroundColor: rowTint }}
                    position="relative" // Ensure menu is positioned relative to this container
                    overflow={"hidden"}
                    onMouseEnter={() => {
                      setShowMenu(true);
                    }}
                    onMouseLeave={() => {
                      setShowMenu(false);
                    }}
                    backgroundColor={
                      selectedThreadId === thread.id.toString()
                        ? selctedColor
                        : "transparent"
                    }
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      alignContent="center"
                      flexDirection="row"
                      pt={4}
                      pb={4}
                      overflow={"hidden"}
                    >
                      <Icon as={StarIcon} mx={2} />
                      <Box mr={2} minW={"45%"} maxW={"45%"}>
                        <Text
                          fontFamily="Arial, sans-serif"
                          fontSize={"sm"}
                          color="gray.500"
                          noOfLines={1}
                        >
                          {thread.query}
                        </Text>
                      </Box>
                      <Box mr={2} minW={"40%"} maxW={"40%"}>
                        <Text
                          fontFamily="Arial, sans-serif"
                          fontSize={"sm"}
                          color={"gray.500"}
                          noOfLines={1}
                        >
                          {new Date(thread.updated_at).toLocaleString()}
                        </Text>
                      </Box>
                      {showMenu && (
                        <Box
                          display="flex"
                          position={"absolute"}
                          right={1}
                          ml={1}
                        >
                          <Button
                            as={IconButton}
                            size={"sm"}
                            aria-label="Options"
                            icon={<Icon as={Trash2Icon} w="4" h="4" />}
                            variant="ghost"
                            onClick={() => {
                              handleDeleteThread();
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}
    </>
  );
};

export default ChatHistoryList;
