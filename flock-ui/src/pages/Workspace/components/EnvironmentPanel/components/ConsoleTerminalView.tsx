import React, { useEffect, useRef } from 'react';
import { Box, Text, ScrollArea, Group } from '@mantine/core';
import { useUiStore } from '../../../../../store/uiStore';

interface ConsoleTerminalViewProps {
  content: string;
}

export function ConsoleTerminalView({ content }: ConsoleTerminalViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  // 自动滚动到最新日志
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [content]);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? '#121212' : '#f8f9fa', // 深色/浅色终端背景
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4) inset' : '0 2px 8px rgba(0,0,0,0.06) inset',
        margin: '16px',
        border: isDark ? '1px solid #333' : '1px solid #e4e4e7',
      }}
    >
      {/* 终端顶部标题栏 (macOS 风格) */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '28px',
          background: isDark ? '#2d2d2d' : '#f1f3f5',
          borderBottom: isDark ? '1px solid #111' : '1px solid #e4e4e7',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Group gap={6} style={{ position: 'absolute', left: '12px' }}>
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
        </Group>
        <Text size="xs" c={isDark ? '#888' : '#71717a'} fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
          bash — flock-sandbox
        </Text>
      </Box>

      {/* 终端输出内容区 */}
      <ScrollArea viewportRef={viewportRef} style={{ flex: 1, padding: '12px 16px' }}>
        <Box
          component="pre"
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: '13px',
            lineHeight: '1.5',
            color: isDark ? '#a9b7c6' : '#18181b', // 经典的 IDE/Terminal 文字颜色
          }}
        >
          {content || '等待命令执行...'}
          {/* 光标闪烁效果 */}
          <span className="blinking-cursor">_</span>
        </Box>
        <style>{`
          .blinking-cursor {
            font-weight: bold;
            color: ${isDark ? '#fff' : '#18181b'};
            animation: 1s blink step-end infinite;
            margin-left: 2px;
          }
          @keyframes blink {
            from, to { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </ScrollArea>
    </Box>
  );
}
