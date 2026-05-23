import React, { useEffect, useRef } from 'react';
import { Box, Text, ScrollArea, Group } from '@mantine/core';

interface ConsoleTerminalViewProps {
  content: string;
}

export function ConsoleTerminalView({ content }: ConsoleTerminalViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

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
        background: '#121212', // 深色终端背景
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4) inset',
        margin: '16px',
        border: '1px solid #333',
      }}
    >
      {/* 终端顶部标题栏 (macOS 风格) */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '28px',
          background: '#2d2d2d',
          borderBottom: '1px solid #111',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Group gap={6} style={{ position: 'absolute', left: '12px' }}>
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
        </Group>
        <Text size="xs" c="#888" fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
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
            color: '#a9b7c6', // 经典的 IDE/Terminal 文字颜色
          }}
        >
          {content || '等待命令执行...'}
          {/* 光标闪烁效果 */}
          <span className="blinking-cursor">_</span>
        </Box>
        <style>{`
          .blinking-cursor {
            font-weight: bold;
            color: #fff;
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
