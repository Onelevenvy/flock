"use client";
import { Box, Center, Flex, IconButton, useDisclosure } from "@chakra-ui/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import ChatBotList from "@/components/Playground/ChatBotList";
import ChatHistoryList from "@/components/Playground/ChatHistoryList";
import ChatMain from "@/components/Playground/ChatMain";
import useChatTeamIdStore from "@/stores/chatTeamIDStore";

function Playground() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId");
  const { setTeamId } = useChatTeamIdStore();
  const { isOpen: isChatBotListOpen, onToggle: toggleChatBotList } =
    useDisclosure({ defaultIsOpen: true });
  const { isOpen: isChatHistoryOpen, onToggle: toggleChatHistoryList } =
    useDisclosure({ defaultIsOpen: false });

  useEffect(() => {
    if (!teamId) {
      setTeamId(1);
      return;
    }
    setTeamId(Number(teamId));
  }, [teamId, setTeamId]);

  const chatAreaWidth =
    !isChatBotListOpen && !isChatHistoryOpen
      ? "100%"
      : isChatBotListOpen && isChatHistoryOpen
        ? "60%"
        : "80%";

  return (
    <Flex
      height="full"
      direction="row"
      overflow="hidden"
      maxH="full"
      w="full"
      maxW="full"
      bg="ui.bgMain"
      py={1}
      pl={2}
      pr={3}
      gap={0}
    >
      {/* Left Sidebar */}
      <Box
        w={isChatBotListOpen ? "20%" : "0"}
        maxW={isChatBotListOpen ? "20%" : "0"}
        minW={isChatBotListOpen ? "20%" : "0"}
        h="full"
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.100"
        transition="all 0.2s"
        visibility={isChatBotListOpen ? "visible" : "hidden"}
        opacity={isChatBotListOpen ? 1 : 0}
        overflow="hidden"
      >
        <ChatBotList />
      </Box>

      {/* Main Chat Area */}
      <Box
        w={chatAreaWidth}
        maxW={chatAreaWidth}
        minW={chatAreaWidth}
        h="full"
        maxH="full"
        display="flex"
        bg="white"
        border="1px solid"
        borderColor="gray.100"
        borderRadius="xl"
        position="relative"
        transition="all 0.2s"
        mx={0.5}
      >
        <Center>
          <IconButton
            aria-label="Toggle chatbot list"
            icon={isChatBotListOpen ? <LuChevronLeft /> : <LuChevronRight />}
            onClick={toggleChatBotList}
            variant="ghost"
            size="sm"
            borderRadius="full"
            bg="white"
            boxShadow="sm"
            _hover={{ bg: "gray.100" }}
            zIndex={2}
          />
        </Center>

        <Box flex={1} h="full" maxH="full" overflow="hidden">
          <ChatMain isPlayground={true} />
        </Box>

        <Center>
          <IconButton
            aria-label="Toggle chat history"
            icon={isChatHistoryOpen ? <LuChevronRight /> : <LuChevronLeft />}
            onClick={toggleChatHistoryList}
            variant="ghost"
            size="sm"
            borderRadius="full"
            bg="white"
            boxShadow="sm"
            _hover={{ bg: "gray.100" }}
            zIndex={2}
          />
        </Center>
      </Box>

      {/* Right Sidebar */}
      <Box
        w={isChatHistoryOpen ? "20%" : "0"}
        maxW={isChatHistoryOpen ? "20%" : "0"}
        minW={isChatHistoryOpen ? "20%" : "0"}
        h="full"
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.100"
        transition="all 0.2s"
        visibility={isChatHistoryOpen ? "visible" : "hidden"}
        opacity={isChatHistoryOpen ? 1 : 0}
        overflow="hidden"
      >
        <ChatHistoryList teamId={Number(teamId)} isPlayground={true} />
      </Box>
    </Flex>
  );
}

export default Playground;
