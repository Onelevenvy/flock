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
  IconPhoto,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { t } = useTranslation();

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
                  <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                    {lang}
                  </Text>
                  <CopyButton value={codeString} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? t('chat.copied') : t('chat.copyCode')} withArrow>
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
                background: 'var(--flock-bg-surface)',
                color: 'var(--flock-accent)',
                border: '1px solid var(--flock-border-dim)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: '0.9em',
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        img({ node, src, alt, ...props }: any) {
          let finalSrc = src;
          if (src) {
            const normalized = src.replace(/\\/g, '/');
            if (normalized.startsWith('file:///')) {
              finalSrc = convertFileSrc(normalized.substring(8));
            } else if (normalized.startsWith('file://')) {
              finalSrc = convertFileSrc(normalized.substring(7));
            } else if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
              finalSrc = convertFileSrc(normalized);
            } else {
              finalSrc = convertFileSrc(normalized);
            }
          }

          return (
            <Box
              style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                margin: '16px 0',
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--flock-accent, #3b82f6)';
                e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(59, 130, 246, 0.25)';
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
              }}
            >
              {/* 卡片头部精致栏 */}
              <Group
                justify="space-between"
                px="md"
                py={8}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <Group gap="xs">
                  <IconPhoto size={14} color="var(--flock-accent, #3b82f6)" />
                  <Text size="xs" fw={600} c="dimmed">
                    {alt || '网页操作步骤截图'}
                  </Text>
                </Group>
                <Text size="10px" c="var(--flock-accent, #3b82f6)" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                  STEP SNAPSHOT
                </Text>
              </Group>

              {/* 截图渲染区域 */}
              <Box
                style={{
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                }}
              >
                <img
                  src={finalSrc}
                  alt={alt || '网页截图'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '380px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    transition: 'transform 0.5s ease',
                  }}
                  onMouseEnter={(e: any) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e: any) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  {...props}
                />
              </Box>
            </Box>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
