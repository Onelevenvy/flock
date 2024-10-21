"use client";
import { Box, Center, Flex, useColorModeValue } from "@chakra-ui/react";
import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import PaneStateControl from "@/components/Common/PaneStateControl";
import ChatBotList from "@/components/Playground/ChatBotList";
import ChatHistoryList from "@/components/Playground/ChatHistoryList";
import ChatMain from "@/components/Playground/ChatMain";
import useChatTeamIdStore from "@/stores/chatTeamIDStore";

const ChatPlayground = () => {
  const [isChatBotListOpen, setIsChatBotListOpen] = useState(true);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const { teamId } = useChatTeamIdStore(); // 使用 Zustand store

  const selctedColor = useColorModeValue(
    "ui.selctedColor",
    "ui.selctedColorDark",
  );
  const toggleChatBotList = () => {
    setIsChatBotListOpen(!isChatBotListOpen);
  };

  const toggleChatHistoryList = () => {
    setIsChatHistoryOpen(!isChatHistoryOpen);
  };

  const chatAreaWidth =
    !isChatBotListOpen && !isChatHistoryOpen
      ? "full"
      : isChatBotListOpen && isChatHistoryOpen
        ? "60%"
        : "80%";

  return (
    <Flex
      height="full"
      direction="row"
      overflow={"hidden"}
      maxH="full"
      w="full"
      maxW="full"
    >
      <Box
        w={isChatBotListOpen ? "20%" : "0"}
        maxW={isChatBotListOpen ? "20%" : "0"}
        minW={isChatBotListOpen ? "20%" : "0"}
        bg="transparent"
        border="1px solid #cccccc"
        visibility={isChatBotListOpen ? "visible" : "hidden"}
        transition="width 0.1s, visibility 0.1s"
      >
        <ChatBotList />
      </Box>

      <Box
        w={chatAreaWidth}
        maxW={chatAreaWidth}
        minW={chatAreaWidth}
        h="full"
        maxH="full"
        display="flex"
        overflowY="auto"
        overflowX="hidden"
        border={"1px solid #cccccc"}
        bg={"white"}
      >
        <Center>
          <PaneStateControl
            onClick={toggleChatBotList}
            background={"transparent"}
            selectedColor={selctedColor}
            Icon={isChatBotListOpen ? LuChevronLeft : LuChevronRight}
          />
        </Center>

        <ChatMain isPlayground={true} />
        <Center>
          <PaneStateControl
            selectedColor={selctedColor}
            onClick={toggleChatHistoryList}
            background={"transparent"}
            Icon={isChatHistoryOpen ? LuChevronRight : LuChevronLeft}
          />
        </Center>
      </Box>

      <Box
        w={isChatHistoryOpen ? "20%" : "0"}
        maxW={isChatHistoryOpen ? "20%" : "0"}
        minW={isChatHistoryOpen ? "20%" : "0"}
        h={"full"}
        maxH="full"
        p={4}
        mt="0"
        bg="transparent"
        border="1px solid #cccccc"
        borderRadius="md"
        overflow="hidden"
        visibility={isChatHistoryOpen ? "visible" : "hidden"}
        transition="width 0.1s, visibility 0.1s"
      >
        <Box maxH="full" h="full">
          <ChatHistoryList teamId={teamId!} isPlayground={true} />
        </Box>
      </Box>
    </Flex>
  );
};

export default ChatPlayground;
