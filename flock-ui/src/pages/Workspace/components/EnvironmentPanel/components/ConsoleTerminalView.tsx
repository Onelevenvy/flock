import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, ScrollArea, Group } from '@mantine/core';
import { useUiStore } from '../../../../../store/uiStore';

interface ConsoleTerminalViewProps {
  content: string;
}

export function ConsoleTerminalView({ content }: ConsoleTerminalViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [displayedContent, setDisplayedContent] = useState('');
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastProcessedContentRef = useRef('');

  
  useEffect(() => {
    // 根源防御：如果传入的 content 与上一轮已开始处理的 content 物理上完全一致，立刻强行拦截，防止重复追加导致双份打印
    if (content === lastProcessedContentRef.current) {
      return;
    }
    lastProcessedContentRef.current = content;

    if (!content) {
      setDisplayedContent('');
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 等待和正在执行的状态，无需加打字机，直接显示
    if (content === '正在执行沙盒命令...' || content.startsWith('正在执行') || content.startsWith('等待命令')) {
      setDisplayedContent(content);
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 识别是增量更新还是全新输出
    if (content.startsWith(displayedContent)) {
      const extra = content.substring(displayedContent.length);
      if (extra) {
        const newLines = extra.split('\n');
        queueRef.current.push(...newLines);
      }
    } else {
      const newLines = content.split('\n');
      setDisplayedContent('');
      queueRef.current = newLines;
    }

    // 启动流式吐字渲染定时器
    if (!timerRef.current) {
      const processQueue = () => {
        if (queueRef.current.length > 0) {
          // 每次弹出 1-3 行以提供飞速流动又不致卡顿的视觉极客感
          const batchSize = Math.min(3, queueRef.current.length);
          const batch = queueRef.current.splice(0, batchSize);
          
          setDisplayedContent((prev) => {
            const separator = prev ? (prev.endsWith('\n') ? '' : '\n') : '';
            return prev + separator + batch.join('\n');
          });
          timerRef.current = requestAnimationFrame(processQueue);
        } else {
          timerRef.current = null;
        }
      };
      timerRef.current = requestAnimationFrame(processQueue);
    }

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, displayedContent]);

  // displayedContent 改变时触发，使终端滚屏极速且流畅
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayedContent]);

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
          {displayedContent || '等待命令执行...'}
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
