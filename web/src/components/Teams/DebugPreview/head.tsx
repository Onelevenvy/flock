import {
  Box,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuHistory } from "react-icons/lu";
import { MdBuild } from "react-icons/md";

import ChatHistoryList from "@/components/Playground/ChatHistoryList";
import CustomButton from "@/components/Common/CustomButton";
import ApiKeyButton from "../Apikey/ApiKeyManageButton";

interface DebugPreviewHeadProps {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
  useApiKeyButton: boolean;
  isWorkflow?: boolean;
}

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
  useApiKeyButton,
  isWorkflow = false,
}: DebugPreviewHeadProps) {
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
        {!isWorkflow && (
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
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverHeader>{t("team.teamsetting.chathistory")}</PopoverHeader>
              <PopoverBody maxH="50vh" overflowY="auto">
                <Box>
                  <ChatHistoryList teamId={teamId} isPlayground={false} />
                </Box>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        )}
        {useApiKeyButton && <ApiKeyButton teamId={teamId.toString()} />}
        {useDeployButton && (
          <CustomButton
            text={t("team.teamsetting.savedeploy")}
            variant="blue"
            rightIcon={<MdBuild color={"white"} />}
            onClick={triggerSubmit}
            ml={5}
          />
        )}
      </Box>
    </Box>
  );
}

export default DebugPreviewHead;
