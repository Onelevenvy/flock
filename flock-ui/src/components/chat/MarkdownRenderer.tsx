import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  CopyButton,
  Tooltip,
  Badge,
} from '@mantine/core';
import {
  IconCopy,
  IconCheck,
  IconPhoto,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/uiStore';

import { convertFileSrc } from '@tauri-apps/api/core';

interface CollapsibleCodeBlockProps {
  codeString: string;
  lang: string;
  t: any;
}

function CollapsibleCodeBlock({ codeString, lang, t }: CollapsibleCodeBlockProps) {
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [collapsed, setCollapsed] = useState(true);
  const lineCount = codeString.split('\n').length;
  // 检测是否是 DOM 树交互元素（以 (x: x, y: y) 坐标结构为特征）
  const isDomTree = lang === 'text' && codeString.includes(' (x: ') && codeString.includes(', y: ');
  const shouldCollapse = lineCount > 8 || isDomTree;

  return (
    <Box
      style={{
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        margin: '8px 0',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
        background: isDark ? '#1e1e1e' : '#f8f9fa',
      }}
    >
      {/* 代码头部栏 */}
      <Group
        justify="space-between"
        px="sm"
        py={4}
        style={{
          background: isDark ? '#181818' : '#f1f3f5',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <Group gap={6}>
          <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
            {lang}
          </Text>
          {isDomTree && (
            <Badge size="xs" color="teal" variant="light" style={{ fontSize: 9, height: 16 }}>
              DOM Tree
            </Badge>
          )}
        </Group>
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
      <Box 
        style={{ 
          fontSize: 13, 
          background: 'transparent',
          maxHeight: (shouldCollapse && collapsed) ? (isDomTree ? '85px' : '135px') : 'none',
          overflow: 'hidden',
          position: 'relative',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
        <SyntaxHighlighter
          language={lang}
          style={isDark ? vscDarkPlus : prism}
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

        {/* 渐变遮罩 (仅在折叠时显示) */}
        {shouldCollapse && collapsed && (
          <Box
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '45px',
              background: isDark 
                ? 'linear-gradient(to top, rgba(30,30,30,1) 0%, rgba(30,30,30,0.5) 70%, rgba(30,30,30,0) 100%)'
                : 'linear-gradient(to top, rgba(248,249,250,1) 0%, rgba(248,249,250,0.5) 70%, rgba(248,249,250,0) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* 展开/收起切换按钮栏 */}
      {shouldCollapse && (
        <Box
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: isDark ? '#1a1a1a' : '#f1f3f5',
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.04)',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'var(--flock-accent)',
            fontWeight: 600,
            gap: '4px',
            userSelect: 'none',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e: any) => e.currentTarget.style.background = isDark ? '#222' : '#e9ecef'}
          onMouseLeave={(e: any) => e.currentTarget.style.background = isDark ? '#1a1a1a' : '#f1f3f5'}
        >
          {collapsed ? (
            <>
              <span>展开全部内容 (共 {lineCount} 行)</span>
              <IconChevronDown size={11} />
            </>
          ) : (
            <>
              <span>收起内容</span>
              <IconChevronUp size={11} />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  // 预处理过滤超长 Base64，防止撑爆或卡死聊天界面
  const filterBase64 = (text: string): string => {
    if (!text) return "";
    
    // 1. 专门处理包含标记的 SCREENSHOT_B64_START / SCREENSHOT_B64_END
    // 它可以跨多行，包含大量换行符和 base64 字符
    const markerRegex = /SCREENSHOT_B64_START[\s\S]*?(SCREENSHOT_B64_END|$)/g;
    let processed = text.replace(markerRegex, (match) => {
      const cleanB64 = match
        .replace("SCREENSHOT_B64_START", "")
        .replace("SCREENSHOT_B64_END", "")
        .trim();
      
      if (cleanB64.length > 100) {
        const prefix = cleanB64.substring(0, 30);
        const suffix = cleanB64.substring(Math.max(0, cleanB64.length - 20));
        return `SCREENSHOT_B64_START [${t('vnc.screenshotDataFolded', { defaultValue: '截图二进制数据已折叠' })}: ${prefix}... (共 ${cleanB64.length} 字符) ...${suffix}] SCREENSHOT_B64_END`;
      }
      return match;
    });

    // 2. 兜底处理任何可能导致排版被撑爆的超长无空格单词 (直接报错打出的 raw base64)
    // 只要一个连续单词的长度大于 120，且只包含 base64 常见字符，我们就将其截断并显示字数
    const rawB64Regex = /\b([a-zA-Z0-9+/=]{120,})\b/g;
    processed = processed.replace(rawB64Regex, (word) => {
      const prefix = word.substring(0, 30);
      const suffix = word.substring(word.length - 20);
      return `${prefix}... [${t('vnc.base64FoldedShort', { defaultValue: '超长二进制/Base64数据已自动折叠' })}(共 ${word.length} 字符)] ...${suffix}`;
    });

    return processed;
  };

  const processedContent = filterBase64(content);

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
            return <CollapsibleCodeBlock codeString={codeString} lang={lang} t={t} />;
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
              finalSrc = convertFileSrc(winPath);
            } else {
              finalSrc = convertFileSrc(normPath);
            }
          }

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
              {/* 卡片头部精致栏 */}
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
                  background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
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
      {processedContent}
    </ReactMarkdown>
  );
}
