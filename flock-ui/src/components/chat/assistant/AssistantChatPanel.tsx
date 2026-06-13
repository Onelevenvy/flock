import { useEffect, useRef, useCallback } from 'react';
import { Box } from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from '@/types/protocol';
import { EmptyState } from './components/EmptyState';
import { MessageBubble } from './components/MessageBubble';

interface ChatPanelProps {
  messages: ChatMessage[];
}

export function AssistantChatPanel({ messages }: ChatPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(false);

  // 检测是否正在流式输出（最后一条消息的 streaming 字段）
  const lastMsg = messages[messages.length - 1];
  const isStreaming = !!lastMsg?.streaming;
  isStreamingRef.current = isStreaming;

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,       // 每条消息预估高度，虚拟化引擎会动态修正
    overscan: 5,                   // 上下多渲染 5 条，避免滚动时白屏
    measureElement: (el) => el?.getBoundingClientRect().height ?? 120,
  });

  // 平滑滚动到底部，防抖避免每个 token 都触发
  const scrollToBottom = useCallback((instant = false) => {
    if (!parentRef.current) return;
    const el = parentRef.current;
    if (instant) {
      el.scrollTop = el.scrollHeight;
    } else {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 80); // 80ms debounce，约 12fps 的滚动触发频率，流畅且不跟不上
    }
  }, []);

  // 消息数量变化时（新消息到来）立刻滚到底部
  useEffect(() => {
    scrollToBottom(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // 流式 streaming 期间，内容增长时 debounce scroll
  useEffect(() => {
    if (isStreaming) {
      scrollToBottom(false);
    } else {
      // streaming 刚结束，立刻滚一次确保看到完整回复
      scrollToBottom(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, lastMsg?.chunks?.length]);

  // 组件卸载时清理 debounce timer
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Box
      ref={parentRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16,
      }}
    >
      {/* 虚拟列表容器，高度由 virtualizer 管理 */}
      <Box
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualRow) => (
            <Box
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{ paddingBottom: 16 }}
            >
              <MessageBubble message={messages[virtualRow.index]} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
