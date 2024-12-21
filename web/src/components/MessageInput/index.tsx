import {
  Box,
  IconButton,
  Textarea,
  InputGroup,
  Tooltip,
  Image,
  Flex,
  CloseButton,
  HStack,
  Text,
} from "@chakra-ui/react";
import type React from "react";
import { GrNewWindow } from "react-icons/gr";
import { VscSend } from "react-icons/vsc";
import { useRef } from "react";
import ImageUploadModal from "./ImageUploadPopoverMenu";
import { useTranslation } from "react-i18next";

interface MessageInputProps {
  isPlayground?: boolean;
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStreaming: boolean;
  newChatHandler?: () => void;
  imageData: string | null;
  setImageData: (value: string | null) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  isPlayground,
  input,
  setInput,
  onSubmit,
  isStreaming,
  newChatHandler,
  imageData,
  setImageData,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();

  const handleImageSelect = (imageData: string) => {
    setImageData(imageData);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleNewChat = () => {
    if (newChatHandler) {
      newChatHandler();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
      e.preventDefault();
      setInput(input + "\n");
    } else if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      px={isPlayground ? "6" : "0"}
      // px="6"
      pt="2"
      pb="6"
      position="relative"
      w="full"
    >
      {imageData && (
        <Flex alignItems="center" mb={2}>
          <Box
            position="relative"
            borderRadius="lg"
            overflow="hidden"
            boxShadow="sm"
            transition="all 0.2s"
            _hover={{ transform: "scale(1.02)" }}
          >
            <Image
              src={imageData}
              alt="Uploaded preview"
              boxSize="60px"
              objectFit="cover"
            />
            <CloseButton
              position="absolute"
              top={1}
              right={1}
              size="sm"
              bg="blackAlpha.300"
              color="white"
              onClick={() => setImageData(null)}
              _hover={{
                bg: "blackAlpha.400",
                transform: "rotate(90deg)",
              }}
              transition="all 0.2s"
            />
          </Box>
        </Flex>
      )}

      <InputGroup as="form" onSubmit={onSubmit} w="full">
        <Box
          position="relative"
          boxShadow="0 0 10px rgba(0,0,0,0.1)"
          borderRadius="lg"
          transition="all 0.2s"
          _hover={{
            boxShadow: "0 0 15px rgba(0,0,0,0.15)",
          }}
          w="full"
        >
          <Textarea
            ref={textareaRef}
            placeholder={t("components.messageInput.placeholder") as string}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            minHeight="150px"
            maxHeight="300px"
            resize="none"
            overflow="auto"
            transition="height 0.2s"
            border="none"
            w="full"
            px={4}
            pt={4}
            _focus={{
              boxShadow: "none",
              border: "none",
            }}
            pb="50px"
            sx={{
              "&:focus ~ div": {
                pointerEvents: "auto",
              },
            }}
          />

          <HStack
            position="absolute"
            bottom="0"
            right="0"
            left="0"
            p="3"
            bg="white"
            borderBottomRadius="lg"
            justifyContent="space-between"
            borderTop="1px solid"
            borderColor="gray.100"
            zIndex="1"
            pointerEvents="auto"
          >
            <Text fontSize="xs" color="gray.500">
              {t("components.messageInput.shortcuts.send")} /{" "}
              {t("components.messageInput.shortcuts.newLine")}
            </Text>

            <HStack spacing={2}>
              {newChatHandler && (
                <Tooltip
                  label={t("components.messageInput.tooltips.newChat")}
                  fontSize="md"
                  bg="gray.700"
                >
                  <IconButton
                    aria-label="new chat"
                    icon={<GrNewWindow />}
                    onClick={handleNewChat}
                    size="sm"
                    variant="ghost"
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-1px)",
                      bg: "gray.100",
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip
                label={t("components.messageInput.tooltips.uploadImage")}
                fontSize="md"
                bg="gray.700"
              >
                <Box>
                  <ImageUploadModal onImageSelect={handleImageSelect} />
                </Box>
              </Tooltip>

              <IconButton
                type="submit"
                icon={<VscSend />}
                aria-label={t("components.messageInput.tooltips.send")}
                isLoading={isStreaming}
                isDisabled={!input.trim().length && !imageData}
                size="sm"
                colorScheme="blue"
                transition="all 0.2s"
                _hover={{
                  transform: "translateY(-1px)",
                  shadow: "md",
                }}
              />
            </HStack>
          </HStack>
        </Box>
      </InputGroup>
    </Box>
  );
};

export default MessageInput;
