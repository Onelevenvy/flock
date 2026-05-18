import {
  Box,
  Text,
  Group,
  ActionIcon,
  CopyButton,
  Tooltip,
} from '@mantine/core';
import {
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeMathjax]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';

          if (!inline && lang) {
            const codeString = String(children).replace(/\n$/, '');
            return (
              <Box
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  margin: '8px 0',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: '#1e1e1e',
                }}
              >
                {/* 代码头部栏 */}
                <Group
                  justify="space-between"
                  px="sm"
                  py={4}
                  style={{
                    background: '#181818',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                    {lang}
                  </Text>
                  <CopyButton value={codeString} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? '已复制' : '复制代码'} withArrow>
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          color={copied ? 'green' : 'gray'}
                          onClick={copy}
                        >
                          {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
                
                {/* 代码高亮内容 */}
                <Box style={{ fontSize: 13, background: 'transparent' }}>
                  <SyntaxHighlighter
                    language={lang}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      background: 'transparent',
                      padding: '12px',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                    wrapLongLines={true}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </Box>
              </Box>
            );
          }

          // 行内代码样式
          return (
            <code
              className={className}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.9em',
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
