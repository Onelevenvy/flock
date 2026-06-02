import {
  Box,
  Text,
  Group,
} from '@mantine/core';
import {
  IconPhoto,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { CollapsibleCodeBlock } from '@/components/chat/assistant/components/CollapsibleCodeBlock';

interface MarkdownRendererProps {
  content: string;
}

function filterBase64(text: string, t: any): string {
  if (!text) return '';

  const markerRegex = /SCREENSHOT_B64_START[\s\S]*?(SCREENSHOT_B64_END|$)/g;
  let processed = text.replace(markerRegex, (match) => {
    const cleanB64 = match
      .replace('SCREENSHOT_B64_START', '')
      .replace('SCREENSHOT_B64_END', '')
      .trim();

    if (cleanB64.length > 100) {
      const prefix = cleanB64.substring(0, 30);
      const suffix = cleanB64.substring(Math.max(0, cleanB64.length - 20));
      return `SCREENSHOT_B64_START [${t('chat.markdown.screenshotFolded')}: ${prefix}... (${t('chat.markdown.charCount', { count: cleanB64.length })}) ...${suffix}] SCREENSHOT_B64_END`;
    }
    return match;
  });

  const rawB64Regex = /\b([a-zA-Z0-9+/=]{120,})\b/g;
  processed = processed.replace(rawB64Regex, (word) => {
    const prefix = word.substring(0, 30);
    const suffix = word.substring(word.length - 20);
    return `${prefix}... [${t('chat.markdown.base64Folded')}(${t('chat.markdown.charCount', { count: word.length })})] ...${suffix}`;
  });

  return processed;
}

function normalizeFileSrc(src: string): string {
  let localPath = src;
  if (src.startsWith('file:///')) {
    localPath = src.substring(8);
  } else if (src.startsWith('file://')) {
    localPath = src.substring(7);
  }

  const normPath = localPath.replace(/\\/g, '/');
  const isWindows = normPath.includes(':') || !normPath.startsWith('/');
  if (isWindows) {
    let winPath = normPath.replace(/\//g, '\\');
    if (winPath.startsWith('\\')) {
      winPath = winPath.substring(1);
    }
    return convertFileSrc(winPath);
  }
  return convertFileSrc(normPath);
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  let processedContent = filterBase64(content, t);
  if (processedContent) {
    processedContent = processedContent
      .replace(/\n\n\*🚫 对话已被用户中止\*/g, t('chat.aborted'))
      .replace(/\*🚫 对话已被用户中止\*/g, t('chat.aborted').trim())
      .replace(/🚫 对话已被用户中止/g, t('chat.aborted').replace(/\n/g, '').replace(/\*/g, '').replace(/🚫\s*/, '').trim());
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeMathjax]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : 'text';

          if (!inline) {
            const codeString = String(children).replace(/\n$/, '');
            return <CollapsibleCodeBlock codeString={codeString} lang={lang} />;
          }

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
          const finalSrc = src ? normalizeFileSrc(src) : src;

          return (
            <Box
              style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                margin: '16px 0',
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                backdropFilter: 'blur(20px)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 8px 24px 0 rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--flock-accent, #3b82f6)';
                e.currentTarget.style.boxShadow = isDark
                  ? '0 12px 40px 0 rgba(59, 130, 246, 0.25)'
                  : '0 12px 24px 0 rgba(21, 90, 239, 0.15)';
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.boxShadow = isDark
                  ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                  : '0 8px 24px 0 rgba(0, 0, 0, 0.08)';
              }}
            >
              <Group
                justify="space-between"
                px="md"
                py={8}
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                }}
              >
                <Group gap="xs">
                  <IconPhoto size={14} color="var(--flock-accent, #3b82f6)" />
                  <Text size="xs" fw={600} c="dimmed">
                    {alt || t('chat.markdown.stepSnapshot')}
                  </Text>
                </Group>
                <Text size="10px" c="var(--flock-accent, #3b82f6)" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {t('chat.markdown.stepSnapshotLabel')}
                </Text>
              </Group>

              <Box
                style={{
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                <img
                  src={finalSrc}
                  alt={alt || t('chat.markdown.webScreenshot')}
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
      {processedContent}
    </ReactMarkdown>
  );
}
