import { Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import "highlight.js/styles/atom-one-dark.css";
import { Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { v4 } from "uuid";

import CopyButton from "./CopyButton";

// const DynamicLoadMarkdownCSSStyle = dynamic(
//   () => import("./LoadMarkdownCSSStyle"),
//   {
//     ssr: false, // 关闭服务器端渲染，这样只在客户端执行
//   }
// );

const Markdown = ({ content }: { content: any }) => {
  const textColor = useColorModeValue("ui.dark", "ui.white");
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate");

  return (
    <>
      {/* <DynamicLoadMarkdownCSSStyle /> */}
      {content && !content.startsWith("data:image") ? (
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          components={{
            pre: ({ children }) => (
              <Box as="pre" overflow="auto">
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
                    borderRadius="md"
                    overflow="hidden"
                    my={2}
                    maxW="full"
                  >
                    <Flex
                      align="center"
                      justify="space-between"
                      bg={secBgColor}
                      p={1}
                      borderBottomWidth="1px"
                    >
                      <Flex align="center" gap={2}>
                        <Terminal size={18} />
                        <Text fontSize="sm" color={textColor}>
                          {match[0]}
                        </Text>
                      </Flex>
                      <CopyButton id={id} />
                    </Flex>
                    <Box
                      as="pre"
                      id={id}
                      p={2}
                      overflowX="auto"
                      whiteSpace="pre-wrap"
                    >
                      <Box
                        as="code"
                        backgroundColor={"white"}
                        className={className}
                        {...props}
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
                  bg={secBgColor}
                  px={2}
                  borderRadius="md"
                >
                  {children}
                </Box>
              );
            },
            img: ({ alt, src, title }) => {
              return (
                <Box as="figure" my={3}>
                  <Box
                    as="img"
                    alt={alt}
                    src={src}
                    title={title}
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                  {alt && (
                    <Text fontSize="sm" color={textColor} textAlign="center">
                      {alt}
                    </Text>
                  )}
                </Box>
              );
            },
          }}
          className="prose prose-zinc max-w-2xl dark:prose-invert"
        >
          {content}
        </ReactMarkdown>
      ) : (
        <Box as="img" src={content} alt="Image" width="100%" height={"100%"} />
      )}
    </>
  );
};

export default Markdown;
