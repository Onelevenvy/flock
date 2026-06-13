import { useState, memo } from 'react';
import { Box, Group, Text, ActionIcon } from '@mantine/core';
import { IconBrain, IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ThinkingBlockProps {
  text: string;
  defaultCollapsed: boolean;
}

// memo 包裹：thinking 流式期间 text 持续变化，但 collapsed 不变，
// 仅在 text 或 collapsed 变化时重渲染
export const ThinkingBlock = memo(function ThinkingBlock({ text, defaultCollapsed }: ThinkingBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { t } = useTranslation();

  return (
    <Box
      style={{
        background: 'var(--flock-bg-surface)',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 6,
        border: '1px solid var(--flock-border-dim)',
      }}
    >
      <Group
        gap={6}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <IconBrain size={13} color="var(--flock-text-secondary)" />
        <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)' }}>
          {t('chat.thinkingProcess')}
        </Text>
        <ActionIcon size="xs" variant="transparent" color="gray">
          {collapsed ? <IconChevronRight size={11} /> : <IconChevronDown size={11} />}
        </ActionIcon>
      </Group>

      {/*
        用 CSS max-height 过渡替代 Mantine Collapse：
        - Collapse 内部有 ResizeObserver + height 动态计算，在 thinking 流式期间每次文本增加都触发测量
        - 改用 overflow:hidden + max-height:0/max-height:9999px 的 CSS 过渡更轻量
        - 流式期间始终 collapsed=false，所以不会有过渡开销
      */}
      <Box
        style={{
          overflow: 'hidden',
          maxHeight: collapsed ? 0 : '9999px',
          // 只在 collapse（用户手动折叠）时有过渡动画，展开时瞬间显示
          transition: collapsed ? 'max-height 0.2s ease' : 'none',
          marginTop: collapsed ? 0 : 6,
        }}
      >
        {/* 用 <pre> 直接渲染纯文本，无 Markdown 解析开销 */}
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: 12,
            lineHeight: 1.65,
            color: 'var(--flock-text-secondary)',
            wordBreak: 'break-all',
          }}
        >
          {text}
        </pre>
      </Box>
    </Box>
  );
});
