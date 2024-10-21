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
      pl="6"
      pr="6"
      pt="2"
      pb="6"
      position="relative"
    >
      {/* 图片预览区域 */}
      {imageData && (
        <Flex alignItems="center" mb={2}>
          <Image
            src={imageData}
            alt="Uploaded preview"
            boxSize="60px"
            borderRadius="md"
            objectFit="cover"
            mr={2}
          />
          <CloseButton onClick={removeImage} variant="outline" size="sm" />
        </Flex>
      )}
      <InputGroup as="form" onSubmit={onSubmit} flexDirection="column">
        <Box
          position="relative"
          boxShadow="0 0 10px rgba(0,0,0,0.2)"
          borderRadius="md"
        >
          <Textarea
            placeholder="Input your message ..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            minHeight="100px"
            maxHeight="200px"
            resize="none"
            overflow="auto"
            transition="height 0.2s"
            border="none"
            _focus={{
              boxShadow: "none",
              border: "none",
            }}
            pb="40px" // 为底部按钮留出空间
          />
          <HStack
            position="absolute"
            bottom="0"
            right="0"
            left="0"
            p="2"
            bg="white"
            borderBottomRadius="md"
            justifyContent="flex-end" // 将内容靠右对齐
            spacing={2} // 增加按钮之间的间距
          >
            <Text fontSize="xs" color="gray.500">
              ↵ 发送 / ^ ↵ 换行
            </Text>
            {newChatHandler && (
              <Tooltip label="New Chat" fontSize="md" bg="green">
                <IconButton
                  aria-label="new chat"
                  icon={<GrNewWindow />}
                  onClick={newChatHandler}
                  size="sm"
                />
              </Tooltip>
            )}
            <Tooltip label="Upload Image" fontSize="md">
              <IconButton
                aria-label="upload-image"
                icon={<RiImageAddLine />}
                onClick={() => document.getElementById("file-input")?.click()}
                size="sm"
              />
            </Tooltip>
            <IconButton
              type="submit"
              icon={<VscSend />}
              aria-label="send-question"
              isLoading={isStreaming}
              isDisabled={!input.trim().length && !imageData}
              size="sm"
            />
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
