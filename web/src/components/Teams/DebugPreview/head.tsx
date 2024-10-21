import {
  Box,
  Button,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuHistory } from "react-icons/lu";
import { MdBuild } from "react-icons/md";

import ChatHistoryList from "@/components/Playground/ChatHistoryList";

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
}: {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
}) {
  const bgColor = useColorModeValue("ui.bgMain", "ui.bgMainDark");
  const buttonColor = useColorModeValue("ui.main", "ui.main");
  const { t } = useTranslation();

  return (
    <Box
      display={"flex"}
      flexDirection={"row"}
      justifyContent={"space-between"}
      alignItems={"center"}
    >
      <Text ml="5" fontSize={"xl"} fontWeight={"bold"}>
        {t("team.teamsetting.debugoverview")}
      </Text>
      <Box display={"flex"} flexDirection={"row"} mr="5" alignItems={"center"}>
        <Popover preventOverflow={false} isLazy={true}>
          <PopoverTrigger>
            <IconButton
              aria-label="history"
              icon={<Icon as={LuHistory} h="6" w="6" color={buttonColor} />}
              h="10"
              w="10"
              bg={bgColor}
              as={"button"}
            />
          </PopoverTrigger>
          <PopoverContent
          // zIndex="9999"
          >
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverHeader> {t("team.teamsetting.chathistory")}</PopoverHeader>
            <PopoverBody
              maxH="50vh"
              overflowY="auto"
              //  zIndex="9999"
            >
              <Box
              // zIndex="1001"
              >
                <ChatHistoryList teamId={teamId} isPlayground={false} />
              </Box>
            </PopoverBody>
            <PopoverFooter />
          </PopoverContent>
        </Popover>
        {useDeployButton && (
          <Button
            ml={"5"}
            bg={buttonColor}
            borderRadius={"md"}
            onClick={triggerSubmit}
            _hover={{ backgroundColor: "#1c86ee" }}
            rightIcon={<MdBuild color={"white"} />}
          >
            <Text color={"white"}>{t("team.teamsetting.savedeploy")}</Text>
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default DebugPreviewHead;
