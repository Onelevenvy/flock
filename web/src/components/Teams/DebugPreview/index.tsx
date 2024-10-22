import { Box } from "@chakra-ui/react";

import ChatMain from "@/components/Playground/ChatMain";

import DebugPreviewHead from "./head";

interface DebugPreviewProps {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
  useApiKeyButton: boolean;
  isWorkflow?: boolean;
  showHistoryButton?: boolean;
}

function DebugPreview({
  teamId,
  triggerSubmit,
  useDeployButton,
  useApiKeyButton,
  isWorkflow = false,
  showHistoryButton = false,
}: DebugPreviewProps) {
  return (
    <Box
      w="full"
      h="full"
      bg="white"
      borderRadius={"lg"}
      display={"flex"}
      flexDirection={"column"}
      overflow={"hidden"}
    >
      <Box py="5" overflow={"hidden"}>
        <DebugPreviewHead
          teamId={teamId}
          triggerSubmit={triggerSubmit}
          useDeployButton={useDeployButton}
          useApiKeyButton={useApiKeyButton}
          isWorkflow={isWorkflow}
          showHistoryButton={showHistoryButton}
        />
      </Box>
      <Box
        display={"flex"}
        w="full"
        h="full"
        maxH={"full"}
        bg={"white"}
        mt={"2"}
        overflowY={"auto"}
      >
        <ChatMain isPlayground={false} />
      </Box>
    </Box>
  );
}

export default DebugPreview;
