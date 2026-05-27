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
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../store/uiStore';

interface CollapsibleCodeBlockProps {
  codeString: string;
  lang: string;
}

export function CollapsibleCodeBlock({ codeString, lang }: CollapsibleCodeBlockProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [collapsed, setCollapsed] = useState(true);
  const lineCount = codeString.split('\n').length;
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

      <Box
        style={{
          fontSize: 13,
          background: 'transparent',
          maxHeight: shouldCollapse && collapsed ? (isDomTree ? '85px' : '135px') : 'none',
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
          onMouseEnter={(e: any) => (e.currentTarget.style.background = isDark ? '#222' : '#e9ecef')}
          onMouseLeave={(e: any) => (e.currentTarget.style.background = isDark ? '#1a1a1a' : '#f1f3f5')}
        >
          {collapsed ? (
            <>
              <span>{t('chat.markdown.expandAll', { count: lineCount })}</span>
              <IconChevronDown size={11} />
            </>
          ) : (
            <>
              <span>{t('chat.markdown.collapse')}</span>
              <IconChevronUp size={11} />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
