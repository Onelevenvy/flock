import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import {
  FaBook,
  FaCheck,
  FaHandPaper,
  FaRobot,
  FaTimes,
  FaTools,
  FaUser,
} from "react-icons/fa";
import { GrFormNextLink } from "react-icons/gr";
import { VscSend } from "react-icons/vsc";

import useWorkflowStore from "@/stores/workflowStore";

import type { ChatResponse, InterruptDecision } from "../../client";
import Markdown from "../Markdown/Markdown";

interface MessageBoxProps {
  message: ChatResponse;
  onResume: (decision: InterruptDecision, toolMessage: string | null) => void;
  isPlayground?: boolean;
}

const MessageBox = ({ message, onResume, isPlayground }: MessageBoxProps) => {
  const {
    type,
    name,
    next,
    content,
    imgdata,
    tool_calls,
    tool_output,
    documents,
  } = message;
  const [decision, setDecision] = useState<InterruptDecision | null>(null);
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const { isOpen: showClipboardIcon, onOpen, onClose } = useDisclosure();
  const { activeNodeName } = useWorkflowStore();

  const onDecisionHandler = (decision: InterruptDecision) => {
    setDecision(decision);
    onResume(decision, toolMessage);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scrollToBottom = () => {
      if (contentRef.current) {
        const parentElement = contentRef.current.parentElement;
        if (parentElement) {
          parentElement.scrollTop = parentElement.scrollHeight;
        }
      }
    };

    scrollToBottom();

    const observer = new MutationObserver(scrollToBottom);

    if (contentRef.current) {
      observer.observe(contentRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [content, tool_calls, tool_output, documents]);

  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    // Generate and set timestamp when message is received
    setTimestamp(new Date().toLocaleString());
  }, [message]);

  const tqxIcon = () => {
    const hw = 6;

    if (type === "human") {
      return <Icon as={FaUser} w={hw} h={hw} />;
    }
    if (type === "tool") {
      return <Icon as={FaTools} w={hw} h={hw} />;
    }
    if (type === "ai") {
      return <Icon as={FaRobot} w={hw} h={hw} />;
    }
    if (type === "interrupt") {
      return <Icon as={FaHandPaper} w={hw} h={hw} />;
    }

    return <Icon as={FaBook} w={hw} h={hw} />; // 如果 type 不是 'human', 'tools', 'ai'，则不显示任何图标
  };

  function isImag(content: any): boolean {
    if (typeof content === "string") {
      // 检查是否为 data URL 或有效的图像 URL
      return (
        content.startsWith("data:image/") ||
        content.startsWith("http://") ||
        content.startsWith("https://")
      );
    }

    return false;
  }

  return (
    <VStack
      spacing={0}
      my={4}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      ref={contentRef}
      sx={{
        "&::-webkit-scrollbar": {
          width: "4px",
        },
        "&::-webkit-scrollbar-track": {
          width: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "gray.200",
          borderRadius: "24px",
        },
        scrollBehavior: "auto",
        overscrollBehavior: "contain",
      }}
    >
      <Box
        w="full"
        ml={isPlayground ? "10" : "0"}
        mr={isPlayground ? "10" : "0"}
        pl={isPlayground ? "10" : "0"}
        pr={isPlayground ? "10" : "0"}
        display="flex"
        alignItems="center"
        justifyContent={type === "human" ? "flex-end" : "flex-start"}
        maxW="full"
      >
        <Box
          w="full"
          display="flex"
          flexDirection={type === "human" ? "row-reverse" : "row"}
          alignItems="center"
          maxW="full"
        >
          <Box
            display="flex"
            flexDirection="column"
            pr={4}
            pl="4"
            alignItems="left"
            maxW="full"
          >
            <Box
              display="flex"
              flexDirection={type === "human" ? "row-reverse" : "row"}
              alignItems="center"
              gap={2}
              maxW="full"
            >
              {next && <Icon as={GrFormNextLink} />}
              {next && next}
              {tqxIcon()}
              <Box
                display="flex"
                flexDirection="column"
                alignItems={type === "human" ? "flex-end" : "flex-start"}
                maxW="full"
              >
                <Text fontSize={"xs"} color={"gray.500"}>
                  {name}
                </Text>
                {tool_calls?.map((tool_call, index) => (
                  <Box key={index}>
                    <Text fontSize={"xs"} color={"gray.500"}>
                      {tool_call.name}
                    </Text>
                  </Box>
                ))}
                <Text fontSize={"xs"} color={"gray.500"}>
                  {timestamp}
                </Text>
              </Box>
            </Box>

            <Box
              display="flex"
              maxW="full"
              bg={
                type === "human"
                  ? content
                    ? "green.50"
                    : "transparent"
                  : content
                    ? "gray.50"
                    : "transparent"
              }
              // zIndex={1000}
              borderRadius="lg" // 添加圆角
              p={content === null ? 0 : 2}
              flexDirection="column"
              alignItems={type === "human" ? "flex-end" : "flex-start"}
              mr={type === "human" ? "10" : "0"}
              ml={type !== "human" ? "10" : "0"}
              maxH="100%" // 设置最大高度，根据需要调整
              overflowY="auto" // 使其可滚动
              overflowX="hidden"
            >
              {imgdata && (
                <Image src={imgdata} alt="img" height={"auto"} width={"auto"} />
              )}
              {content && <Markdown content={content} />}
            </Box>

            {tool_calls?.map((tool_call, index) => (
              <Box
                key={index}
                p={2}
                bg={type === "human" ? "green.50" : "gray.50"}
                borderRadius="lg" // 添加圆角
                display="flex"
                alignItems="flex-start"
                ml="10"
              >
                <Box display="flex" flexDirection="column">
                  {Object.keys(tool_call.args).map((attribute, index) => (
                    <Box key={index} ml="2">
                      <Markdown
                        content={`${attribute}: ${tool_call.args[attribute]}`}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}

            {tool_output && (
              <Box
                maxH={"10rem"}
                overflowY="auto"
                overflowX="hidden"
                maxW="full"
                p={2}
                ml="10"
                bg={type === "human" ? "green.50" : "gray.50"}
                borderRadius="lg" // 添加圆角
              >
                <Accordion allowMultiple>
                  {(() => {
                    try {
                      const parsedOutput = JSON.parse(tool_output);

                      if (Array.isArray(parsedOutput)) {
                        // 处理数组情况
                        return parsedOutput.map((item, index) => (
                          <AccordionItem key={index}>
                            <h2>
                              <AccordionButton>
                                <Box
                                  as="span"
                                  flex="1"
                                  textAlign="left"
                                  noOfLines={1}
                                >
                                  {item.url || `Item ${index + 1}`}
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                            </h2>
                            <AccordionPanel pb={4}>
                              <p>
                                <strong>url:</strong> {item.url}
                              </p>
                              <p>
                                <strong>content:</strong> {item.content}
                              </p>
                            </AccordionPanel>
                          </AccordionItem>
                        ));
                      }

                      // 处理其他情况，例如数字, string 等
                      return (
                        <AccordionItem>
                          <h2>
                            <AccordionButton>
                              <Box
                                as="span"
                                flex="1"
                                textAlign="left"
                                noOfLines={1}
                              >
                                Tool output result:
                                {parsedOutput}
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            {isImag(content) ? (
                              <Image
                                src={content!}
                                alt="img"
                                width={"100%"}
                                height={"100%"}
                              />
                            ) : (
                              <Markdown content={parsedOutput} />
                            )}
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    } catch (e) {
                      // 处理解析错误
                      return (
                        <AccordionItem>
                          <h2>
                            <AccordionButton>
                              <Box
                                as="span"
                                flex="1"
                                textAlign="left"
                                noOfLines={1}
                              >
                                Error:无法解析工具输出。
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            <p>Error:无法解析工具输出。</p>
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    }
                  })()}
                </Accordion>
              </Box>
            )}

            {documents && (
              <Box
                ml="10"
                borderRadius="lg"
                bg={type === "human" ? "green.50" : "gray.50"}
              >
                <Accordion allowMultiple>
                  {(
                    JSON.parse(documents) as {
                      score: number;
                      content: string;
                    }[]
                  ).map((document, index) => (
                    <AccordionItem key={index}>
                      <h2>
                        <AccordionButton>
                          <Box
                            as="span"
                            flex="1"
                            textAlign="left"
                            noOfLines={1}
                          >
                            {document.content}
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                      </h2>
                      <AccordionPanel pb={4}>{document.content}</AccordionPanel>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Box>
            )}
            {type === "interrupt" && name === "human" && !decision && (
              <Flex alignItems={"center"} gap="1rem" mt={8}>
                <InputGroup size="md" width={"20rem"}>
                  <Input
                    pr="3rem"
                    placeholder="Your reply..."
                    onChange={(e) => setToolMessage(e.target.value)}
                  />
                  <InputRightElement>
                    <IconButton
                      icon={<VscSend />}
                      aria-label="human-reply"
                      isDisabled={!toolMessage?.trim().length}
                      onClick={() => onDecisionHandler("replied")}
                    />
                  </InputRightElement>
                </InputGroup>
              </Flex>
            )}
            {type === "interrupt" && name === "interrupt" && !decision && (
              <Flex alignItems={"center"} gap="1rem">
                <Tooltip>
                  <Button
                    autoFocus
                    variant={"outline"}
                    aria-label="approve"
                    leftIcon={<FaCheck />}
                    colorScheme="green"
                    onClick={() => onDecisionHandler("approved")}
                  >
                    Approve
                  </Button>
                </Tooltip>
                or
                <InputGroup size="md" width={"20rem"}>
                  <Input
                    pr="3rem"
                    placeholder="Optional rejection instructions..."
                    onChange={(e) => setToolMessage(e.target.value)}
                  />
                  <InputRightElement width="3rem">
                    <Tooltip label="Reject">
                      <IconButton
                        variant={"outline"}
                        h="1.75rem"
                        aria-label="reject"
                        icon={<FaTimes />}
                        size="sm"
                        colorScheme="red"
                        onClick={() => onDecisionHandler("rejected")}
                      >
                        Reject
                      </IconButton>
                    </Tooltip>
                  </InputRightElement>
                </InputGroup>
              </Flex>
            )}
          </Box>
        </Box>
        {/* 这个空的 div 用于自动滚动 */}
        <Box ref={messagesEndRef} pb={"5"} />
      </Box>
    </VStack>
  );
};

export default MessageBox;
