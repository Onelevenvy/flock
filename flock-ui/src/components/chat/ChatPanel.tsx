import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Paper,
  Text,
  Group,
  Avatar,
  Collapse,
  ActionIcon,
  ScrollArea,
  Loader,
  Badge,
  Button,
} from '@mantine/core';
import {
  IconUser,
  IconRobot,
  IconBrain,
  IconChevronDown,
  IconChevronRight,
  IconMessage,
  IconSparkles,
  IconPlus,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, MessageChunk } from '../../types/protocol';
import { ToolCard } from './ToolApproval/ToolCard';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkspacesQuery, useCreateConversationMutation } from '../../hooks/useWorkspaces';
import { useAgentStore } from '../../store/agentStore';
import { MarkdownRenderer } from './MarkdownRenderer';

// ---- 思考块 ----
function ThinkingBlock({ text, defaultCollapsed }: { text: string; defaultCollapsed: boolean }) {
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
        style={{ cursor: 'pointer' }}
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
      <Collapse in={!collapsed}>
        <Text
          size="xs"
          mt={6}
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--mantine-font-family-monospace)',
            lineHeight: 1.65,
            color: 'var(--flock-text-secondary)',
          }}
        >
          {text}
        </Text>
      </Collapse>
    </Box>
  );
}


// ---- Chunk 渲染 ----
function ChunkRenderer({ chunk, isStreaming }: { chunk: MessageChunk; isStreaming: boolean }) {
  if (chunk.kind === 'text') {
    return (
      <Box className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
        <MarkdownRenderer content={chunk.text} />
        {isStreaming && (
          <Box
            component="span"
            style={{
              display: 'inline-block',
              width: 8,
              height: 16,
              background: 'rgba(21, 90, 239, 0.8)',
              borderRadius: 2,
              marginLeft: 3,
              animation: 'blink 0.9s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </Box>
    );
  }
  if (chunk.kind === 'thinking') {
    return <ThinkingBlock text={chunk.text} defaultCollapsed={!isStreaming} />;
  }
  if (chunk.kind === 'tool_request') {
    return <ToolCard chunk={chunk} />;
  }
  if (chunk.kind === 'info') {
    const isSuccess = chunk.message.includes('已就绪') || chunk.message.includes('成功');
    const isError = chunk.message.includes('失败') || chunk.message.includes('出错') || chunk.message.includes('健康状态') || chunk.message.includes('失效');
    
    return (
      <Paper
        p="xs"
        radius="sm"
        style={{
          background: 'var(--flock-bg-surface)',
          borderLeft: isSuccess || (!isError && !isStreaming)
            ? '3px solid #0ca678'
            : isError
            ? '3px solid #f03e3e'
            : '3px solid var(--flock-accent)',
          padding: '6px 12px',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid var(--flock-border-dim)',
          borderLeftWidth: 3,
        }}
      >
        {!isSuccess && !isError && isStreaming && <Loader size={12} type="dots" color="var(--flock-accent)" />}
        {(!isSuccess && !isError && !isStreaming) && <Text size="xs" fw={800} style={{ color: '#0ca678', display: 'inline-flex', alignItems: 'center' }}>✓</Text>}
        {isSuccess && <Text size="xs" fw={800} style={{ color: '#0ca678', display: 'inline-flex', alignItems: 'center' }}>✓</Text>}
        {isError && <Text size="xs" fw={800} style={{ color: '#f03e3e', display: 'inline-flex', alignItems: 'center' }}>✗</Text>}
        <Text size="xs" fw={500} style={{ color: 'var(--flock-text-secondary)', flex: 1 }}>
          {chunk.message}
        </Text>
      </Paper>
    );
  }
  return null;
}

// ---- 消息气泡 ----
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '0 4px',
      }}
    >
      {/* 头像 */}
      {isUser ? (
        <Avatar
          size={32}
          radius="xl"
          style={{
            background: 'var(--flock-bg-surface)',
            border: '1px solid var(--flock-border-dim)',
            flexShrink: 0,
          }}
        >
          <IconUser size={16} color="var(--flock-text-dim)" />
        </Avatar>
      ) : (
        <Avatar
          size={32}
          radius="xl"
          style={{
            background: 'var(--flock-accent)',
            border: '1px solid rgba(21, 90, 239, 0.25)',
            boxShadow: '0 2px 8px rgba(21, 90, 239, 0.2)',
            flexShrink: 0,
          }}
        >
          <IconRobot size={16} color="white" />
        </Avatar>
      )}

      {/* 内容区 */}
      <Box style={{ maxWidth: isUser ? '72%' : '88%', minWidth: 0 }}>
        <Paper
          p="sm"
          radius="lg"
          style={{
            background: isUser
              ? 'var(--flock-accent-soft)'
              : 'var(--flock-bg-raised)',
            border: isUser
              ? '1px solid var(--flock-border-base)'
              : '1px solid var(--flock-border-subtle)',
            borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          }}
        >
          <Stack gap={6}>
            {message.chunks.map((chunk, i) => (
              <ChunkRenderer
                key={i}
                chunk={chunk}
                isStreaming={message.streaming && i === message.chunks.length - 1}
              />
            ))}
            {message.streaming && message.chunks.length === 0 && (
              <Group gap={4}>
                <Loader size={12} type="dots" color="blue" />
                <Text size="xs" c="dimmed">{t('chat.thinking')}</Text>
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Token 用量 */}
        {message.usage && !message.streaming && (
          <Group
            gap={4}
            mt={4}
            justify={isUser ? 'flex-end' : 'flex-start'}
            style={{ opacity: 0.5 }}
          >
            <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>
              ↑{message.usage.input_tokens} ↓{message.usage.output_tokens} tokens
            </Text>
            {message.usage.cache_read_tokens && (
              <Badge size="xs" variant="transparent" color="teal">
                {t('chat.cache')} {message.usage.cache_read_tokens}
              </Badge>
            )}
          </Group>
        )}
      </Box>
    </Box>
  );
}

// ---- 空状态 ----
function EmptyState() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { mutateAsync: createConversation } = useCreateConversationMutation();
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const { t } = useTranslation();

  const handleNewConv = async () => {
    if (!activeWorkspaceId) return;
    try {
      await createConversation({ workspaceId: activeWorkspaceId, title: '' });
      clearMessages();
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {!activeWorkspaceId ? (
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'var(--flock-accent-soft)',
              border: '1px solid var(--flock-border-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSparkles size={32} color="rgba(21, 90, 239, 0.7)" />
          </Box>
          <Stack align="center" gap={6}>
            <Text fw={600} size="lg" c="var(--flock-text-bright)">
              {t('chat.welcomeTitle')}
            </Text>
            <Text size="sm" c="dimmed" style={{ textAlign: 'center', maxWidth: 320 }}>
              {t('chat.welcomeDesc')}
            </Text>
          </Stack>
        </Stack>
      ) : (
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--flock-accent-soft)',
              border: '1px solid var(--flock-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMessage size={28} color="rgba(21, 90, 239, 0.6)" />
          </Box>
          <Stack align="center" gap={6}>
            <Text fw={500} size="md" c="var(--flock-text-primary)">
              {activeWs?.name}
            </Text>
            <Text size="sm" c="dimmed" style={{ textAlign: 'center', maxWidth: 280 }}>
              {t('chat.startNewConv')}
            </Text>
          </Stack>
          <Button
            variant="light"
            color="blue"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={handleNewConv}
          >
            {t('chat.newConv')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}

// ---- 聊天面板 ----
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
