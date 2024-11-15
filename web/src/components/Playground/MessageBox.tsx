import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
  useDisclosure,
  HStack,
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
    setTimestamp(new Date().toLocaleString());
  }, [message]);

  const tqxIcon = () => {
    const hw = 5;

    if (type === "human") {
      return <Icon as={FaUser} w={hw} h={hw} color="blue.500" />;
    }
    if (type === "tool") {
      return <Icon as={FaTools} w={hw} h={hw} color="gray.500" />;
    }
    if (type === "ai") {
      return <Icon as={FaRobot} w={hw} h={hw} color="green.400" />;
    }
    if (type === "interrupt") {
      return <Icon as={FaHandPaper} w={hw} h={hw} color="cyan.500" />;
    }

    return <Icon as={FaBook} w={hw} h={hw} color="orange.500" />;
  };

  function isImag(content: any): boolean {
    if (typeof content === "string") {
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
          bg: "gray.50",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "gray.200",
          borderRadius: "24px",
        },
        scrollBehavior: "smooth",
        overscrollBehavior: "contain",
      }}
    >
      <Box
        w="full"
        mx={isPlayground ? "10" : "0"}
        px={isPlayground ? "10" : "0"}
        display="flex"
        alignItems="center"
        justifyContent={type === "human" ? "flex-end" : "flex-start"}
        maxW="full"
      >
        <Box
          w="full"
          display="flex"
          flexDirection={type === "human" ? "row-reverse" : "row"}
          alignItems="flex-start"
          maxW="full"
          gap={4}
        >
          <Box
            borderRadius="lg"
            bg={type === "human" ? "blue.50" : "blue.50"}
            alignSelf="flex-start"
            as={IconButton}
          >
            {tqxIcon()}
          </Box>

          <Box display="flex" flexDirection="column" maxW="70%">
            <HStack spacing={2} mb={1}>
              <Box
                display="flex"
                flexDirection={type === "human" ? "row-reverse" : "row"}
                alignItems="center"
                gap={2}
              >
                {next && <Icon as={GrFormNextLink} />}
                {next && next}
                <Text fontSize="sm" fontWeight="500" color="gray.700">
                  {name}
                </Text>
                {tool_calls?.map((tool_call, index) => (
                  <Text key={index} fontSize="xs" color="gray.500">
                    {tool_call.name}
                  </Text>
                ))}
                <Text fontSize="xs" color="gray.500">
                  {timestamp}
                </Text>
              </Box>
            </HStack>

            {imgdata && (
              <Box
                mt={2}
                borderRadius="lg"
                overflow="hidden"
                transition="all 0.2s"
                _hover={{ shadow: "sm" }}
              >
                <Image src={imgdata} alt="img" height="auto" width="auto" />
              </Box>
            )}

            {content && (
              <Box
                bg={type === "human" ? "blue.50" : "gray.50"}
                borderRadius="lg"
                p={4}
                maxW="full"
                transition="all 0.2s"
                _hover={{ shadow: "sm" }}
              >
                <Markdown content={content} />
              </Box>
            )}

            {/* Tool Calls */}
            {tool_calls?.map((tool_call, index) => (
              <Box
                key={index}
                mt={2}
                p={4}
                bg={type === "human" ? "blue.50" : "gray.50"}
                borderRadius="lg"
                transition="all 0.2s"
                _hover={{
                  shadow: "sm",
                }}
              >
                <Text fontSize="sm" fontWeight="500" color="gray.700" mb={2}>
                  {tool_call.name}
                </Text>
                {Object.entries(tool_call.args).map(([key, value], i) => (
                  <Box key={i} ml={2}>
                    <Text fontSize="sm" color="gray.600">
                      <strong>{key}:</strong> {value}
                    </Text>
                  </Box>
                ))}
              </Box>
            ))}

            {/* Tool Output */}
            {tool_output && (
              <Box
                mt={2}
                maxH="10rem"
                overflowY="auto"
                overflowX="hidden"
                borderRadius="lg"
                bg={type === "human" ? "blue.50" : "gray.50"}
                transition="all 0.2s"
                _hover={{
                  shadow: "sm",
                }}
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

            {/* Documents */}
            {documents && (
              <Box
                mt={2}
                borderRadius="lg"
                bg={type === "human" ? "blue.50" : "gray.50"}
                transition="all 0.2s"
                _hover={{
                  shadow: "sm",
                }}
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

            {/* Interrupt Controls */}
            {type === "interrupt" && (
              <Box mt={4}>
                {name === "human" && !decision && (
                  <InputGroup size="md">
                    <Input
                      placeholder="Your reply..."
                      bg="white"
                      borderRadius="lg"
                      onChange={(e) => setToolMessage(e.target.value)}
                      _focus={{
                        borderColor: "blue.400",
                        boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                      }}
                    />
                    <InputRightElement>
                      <IconButton
                        icon={<VscSend />}
                        aria-label="Send reply"
                        variant="ghost"
                        colorScheme="blue"
                        isDisabled={!toolMessage?.trim().length}
                        onClick={() => onDecisionHandler("replied")}
                      />
                    </InputRightElement>
                  </InputGroup>
                )}

                {name === "interrupt" && !decision && (
                  <HStack spacing={4}>
                    <Button
                      leftIcon={<FaCheck />}
                      colorScheme="green"
                      variant="solid"
                      onClick={() => onDecisionHandler("approved")}
                      size="sm"
                    >
                      Approve
                    </Button>

                    <InputGroup size="md">
                      <Input
                        placeholder="Optional rejection instructions..."
                        bg="white"
                        borderRadius="lg"
                        onChange={(e) => setToolMessage(e.target.value)}
                        _focus={{
                          borderColor: "red.400",
                          boxShadow: "0 0 0 1px var(--chakra-colors-red-400)",
                        }}
                      />
                      <InputRightElement>
                        <IconButton
                          icon={<FaTimes />}
                          aria-label="Reject"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => onDecisionHandler("rejected")}
                          size="sm"
                        />
                      </InputRightElement>
                    </InputGroup>
                  </HStack>
                )}
              </Box>
            )}

            <Box ref={messagesEndRef} pb="5" />
          </Box>
        </Box>
      </Box>
    </VStack>
  );
};

export default MessageBox;
