import { Box, CloseButton } from "@chakra-ui/react";

import ChatMain from "@/components/Playground/ChatMain";

import DebugPreviewHead from "./head";

interface DebugPreviewProps {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
  useApiKeyButton: boolean;
  isWorkflow?: boolean;
  showHistoryButton?: boolean;
  onClose?: () => void;
}

function DebugPreview({
  teamId,
  triggerSubmit,
  useDeployButton,
  useApiKeyButton,
  isWorkflow = false,
  showHistoryButton = false,
  onClose,
}: DebugPreviewProps) {
  return (
    <Box
      w="full"
      h="full"
      bg="white"
      borderRadius={"lg"}
      display={"flex"}
      flexDirection={"column"}
      position="relative"
    >
      {onClose && (
        <CloseButton
          onClick={onClose}
          position="absolute"
          right={2}
          top={2}
          size={"md"}
          zIndex={2}
        />
      )}
      
      <Box 
        py="5" 
        position="absolute"
        top={0}
        left={0}
        right={0}
        bg="white"
        zIndex={1}
      >
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
        position="absolute"
        top="80px"
        bottom="0"
        left="0"
        right="0"
        overflowY="auto"
        display="flex"
      >
        <ChatMain isPlayground={false} />
      </Box>
    </Box>
  );
}

export default DebugPreview;
