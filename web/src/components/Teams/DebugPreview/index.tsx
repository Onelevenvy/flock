import { Box, CloseButton, useColorModeValue } from "@chakra-ui/react";

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
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  return (
    <Box
      w="full"
      h="full"
      bg={bgColor}
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      display="flex"
      flexDirection="column"
      position="relative"
      transition="all 0.2s"
      boxShadow="sm"
      _hover={{
        boxShadow: "md",
        borderColor: "gray.200",
      }}
    >
      {onClose && (
        <CloseButton
          onClick={onClose}
          position="absolute"
          right={4}
          top={4}
          size="md"
          zIndex={2}
          borderRadius="full"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />
      )}
      
      <Box 
        py={5}
        px={4}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bg={bgColor}
        borderBottom="1px solid"
        borderColor={borderColor}
        zIndex={1}
        backdropFilter="blur(8px)"
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
        bottom={0}
        left={0}
        right={0}
        overflowY="hidden"
        display="flex"
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
        <ChatMain isPlayground={false} />
      </Box>
    </Box>
  );
}

export default DebugPreview;
