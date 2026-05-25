import { useEffect, useRef } from 'react';
import { ScrollArea, Stack } from '@mantine/core';
import { ChatMessage } from '../../types/protocol';
import { EmptyState } from './components/EmptyState';
import { MessageBubble } from './components/MessageBubble';

interface ChatPanelProps {
  messages: ChatMessage[];
}

export function ChatPanel({ messages }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollArea style={{ flex: 1 }} px="md" py="md">
      <Stack gap="lg" pb="lg" style={{ maxWidth: 720, margin: '0 auto' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </Stack>
    </ScrollArea>
  );
}
