import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  Icon,
  HStack,
} from "@chakra-ui/react";
import "highlight.js/styles/atom-one-dark.css";
import "katex/dist/katex.min.css";
import { Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { v4 } from "uuid";

import CopyButton from "./CopyButton";

const preprocessLaTeX = (content: string) => {
  if (typeof content !== "string") return content;
  return content
    .replace(/\\\[(.*?)\\\]/g, (_, equation) => `$$${equation}$$`)
    .replace(/\\\((.*?)\\\)/g, (_, equation) => `$$${equation}$$`)
    .replace(
      /(^|[^\\])\$(.+?)\$/g,
      (_, prefix, equation) => `${prefix}$${equation}$`
    );
};

const Markdown = ({ content }: { content: any }) => {
  const textColor = useColorModeValue("gray.700", "gray.200");
  const codeBg = useColorModeValue("gray.50", "gray.700");
  const headerBg = useColorModeValue("gray.50", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const inlineCodeBg = useColorModeValue("gray.100", "gray.700");

  const latexContent = preprocessLaTeX(content);

  return (
    <>
      {content && !content.startsWith("data:image") ? (
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeHighlight, rehypeKatex]}
          components={{
            pre: ({ children }) => (
              <Box
                as="pre"
                overflow="auto"
                sx={{
                  "&::-webkit-scrollbar": {
                    width: "4px",
                    height: "4px",
                  },
                  "&::-webkit-scrollbar-track": {
                    bg: "transparent",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    bg: "gray.300",
                    borderRadius: "full",
                  },
                }}
              >
                {children}
              </Box>
            ),
            code: ({ node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || "");

              if (match?.length) {
                const id = v4();

                return (
                  <Box
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="lg"
                    overflow="hidden"
                    my={4}
                    maxW="full"
                    transition="all 0.2s"
                    _hover={{
                      boxShadow: "md",
                      borderColor: "gray.300",
                    }}
                  >
                    <Flex
                      align="center"
                      justify="space-between"
                      bg={headerBg}
                      px={4}
                      py={2}
                      borderBottomWidth="1px"
                      borderColor={borderColor}
                    >
                      <HStack spacing={3}>
                        <Icon as={Terminal} boxSize={4} color="gray.500" />
                        <Text fontSize="sm" color="gray.600" fontWeight="500">
                          {match[1].toUpperCase()}
                        </Text>
                      </HStack>
                      <CopyButton id={id} />
                    </Flex>
                    <Box
                      as="pre"
                      id={id}
                      p={4}
                      overflowX="auto"
                      bg={codeBg}
                      fontSize="sm"
                      sx={{
                        "&::-webkit-scrollbar": {
                          width: "4px",
                          height: "4px",
                        },
                        "&::-webkit-scrollbar-track": {
                          bg: "transparent",
                        },
                        "&::-webkit-scrollbar-thumb": {
                          bg: "gray.300",
                          borderRadius: "full",
                        },
                      }}
                    >
                      <Box
                        as="code"
                        className={className}
                        {...props}
                        sx={{
                          "& .hljs": {
                            bg: "transparent",
                            color: textColor,
                          },
                        }}
                      >
                        {children}
                      </Box>
                    </Box>
                  </Box>
                );
              }

              return (
                <Box
                  as="code"
                  {...props}
                  px={2}
                  py={0.5}
                  bg={inlineCodeBg}
                  borderRadius="md"
                  fontSize="sm"
                  color={textColor}
                >
                  {children}
                </Box>
              );
            },
            img: ({ alt, src, title }) => {
              return (
                <Box
                  as="figure"
                  my={6}
                  transition="all 0.2s"
                  _hover={{
                    transform: "scale(1.01)",
                  }}
                >
                  <Box
                    as="img"
                    alt={alt}
                    src={src}
                    title={title}
                    borderRadius="lg"
                    boxShadow="sm"
                    maxW="100%"
                    h="auto"
                    transition="all 0.2s"
                    _hover={{
                      boxShadow: "md",
                    }}
                  />
                  {alt && (
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      textAlign="center"
                      mt={2}
                    >
                      {alt}
                    </Text>
                  )}
                </Box>
              );
            },
          }}
          className="prose prose-zinc max-w-2xl dark:prose-invert"
        >
          {latexContent}
        </ReactMarkdown>
      ) : (
        <Box
          as="img"
          src={content}
          alt="Image"
          width="100%"
          height="100%"
          objectFit="contain"
          borderRadius="lg"
          transition="all 0.2s"
          _hover={{
            transform: "scale(1.01)",
            boxShadow: "lg",
          }}
        />
      )}
    </>
  );
};

export default Markdown;
