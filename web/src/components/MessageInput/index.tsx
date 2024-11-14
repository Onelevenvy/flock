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
import { RiImageAddLine } from "react-icons/ri";
import { VscSend } from "react-icons/vsc";

interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStreaming: boolean;
  newChatHandler?: () => void;
  imageData: string | null;
  setImageData: (value: string | null) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  setInput,
  onSubmit,
  isStreaming,
  newChatHandler,
  imageData,
  setImageData,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageData!(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeImage = () => {
    setImageData!(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
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
      px={6}
      py={4}
      position="relative"
      bg="white"
      borderTop="1px solid"
      borderColor="gray.100"
    >
      {imageData && (
        <Flex alignItems="center" mb={3}>
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
              onClick={removeImage}
              _hover={{
                bg: "blackAlpha.400",
                transform: "rotate(90deg)",
              }}
              transition="all 0.2s"
            />
          </Box>
        </Flex>
      )}

      <InputGroup as="form" onSubmit={onSubmit}>
        <Box
          position="relative"
          w="full"
          bg="white"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.200"
          boxShadow="sm"
          transition="all 0.2s"
          _hover={{
            boxShadow: "md",
            borderColor: "gray.300",
          }}
        >
          <Textarea
            placeholder="Input your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            minH="100px"
            maxH="200px"
            resize="none"
            border="none"
            _focus={{
              boxShadow: "none",
              borderColor: "blue.500",
            }}
            pb="40px"
            transition="all 0.2s"
          />

          <HStack
            position="absolute"
            bottom={0}
            right={0}
            left={0}
            p={2}
            bg="white"
            borderTop="1px solid"
            borderColor="gray.100"
            justify="space-between"
            align="center"
          >
            <Text fontSize="xs" color="gray.500">
              Enter to send / Shift + Enter for new line
            </Text>
            
            <HStack spacing={2}>
              {newChatHandler && (
                <Tooltip 
                  label="New Chat" 
                  placement="top"
                  bg="gray.700"
                  color="white"
                >
                  <IconButton
                    aria-label="New chat"
                    icon={<GrNewWindow />}
                    onClick={newChatHandler}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-1px)",
                      bg: "gray.100",
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip 
                label="Upload Image" 
                placement="top"
                bg="gray.700"
                color="white"
              >
                <IconButton
                  aria-label="Upload image"
                  icon={<RiImageAddLine />}
                  onClick={() => document.getElementById("file-input")?.click()}
                  size="sm"
                  variant="ghost"
                  colorScheme="gray"
                  transition="all 0.2s"
                  _hover={{
                    transform: "translateY(-1px)",
                    bg: "gray.100",
                  }}
                />
              </Tooltip>

              <IconButton
                type="submit"
                icon={<VscSend />}
                aria-label="Send message"
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

        <input
          type="file"
          id="file-input"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </InputGroup>
    </Box>
  );
};

export default MessageInput;
