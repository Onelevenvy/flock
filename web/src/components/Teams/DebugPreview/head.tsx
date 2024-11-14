import {
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
  HStack,
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
  showHistoryButton?: boolean;
}

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
  useApiKeyButton,
  isWorkflow = false,
  showHistoryButton = false,
}: DebugPreviewHeadProps) {
  const bgColor = useColorModeValue("ui.bgMain", "gray.700");
  const buttonColor = useColorModeValue("ui.main", "blue.300");
  const { t } = useTranslation();

  return (
    <HStack justify="space-between" align="center" spacing={4}>
      <Text fontSize="lg" fontWeight="600" color="gray.800">
        {t("team.teamsetting.debugoverview")}
      </Text>

      <HStack spacing={3}>
        {(showHistoryButton || !isWorkflow) && (
          <Popover placement="bottom-end" isLazy>
            <PopoverTrigger>
              <IconButton
                aria-label="history"
                icon={<Icon as={LuHistory} boxSize={5} color={buttonColor} />}
                size="sm"
                variant="ghost"
                borderRadius="lg"
                transition="all 0.2s"
                _hover={{
                  bg: bgColor,
                  transform: "translateY(-1px)",
                }}
                _active={{
                  transform: "translateY(0)",
                }}
              />
            </PopoverTrigger>
            <PopoverContent
              border="1px solid"
              borderColor="gray.100"
              borderRadius="xl"
              boxShadow="lg"
              _focus={{ outline: "none" }}
            >
              <PopoverArrow />
              <PopoverCloseButton
                borderRadius="full"
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  transform: "rotate(90deg)",
                }}
              />
              <PopoverHeader fontWeight="600" borderBottomWidth="1px" py={3}>
                {t("team.teamsetting.chathistory")}
              </PopoverHeader>
              <PopoverBody
                maxH="50vh"
                overflowY="auto"
                p={4}
                sx={{
                  "&::-webkit-scrollbar": {
                    width: "4px",
                  },
                  "&::-webkit-scrollbar-track": {
                    bg: "gray.50",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    bg: "gray.300",
                    borderRadius: "full",
                  },
                }}
              >
                <ChatHistoryList teamId={teamId} isPlayground={false} />
              </PopoverBody>
            </PopoverContent>
          </Popover>
        )}

        {useApiKeyButton && <ApiKeyButton teamId={teamId.toString()} />}

        {useDeployButton && (
          <CustomButton
            text={t("team.teamsetting.savedeploy")}
            variant="blue"
            rightIcon={<MdBuild />}
            onClick={triggerSubmit}
          />
        )}
      </HStack>
    </HStack>
  );
}

export default DebugPreviewHead;
