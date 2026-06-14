import { memo } from 'react';
import { Box, Stack, Paper, Text, Group, Avatar, Loader, Badge, Button } from '@mantine/core';
import { IconUser, IconRobot } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, MessageChunk } from '@/types/protocol';
import { useAgentStore } from '@/store/agentStore';
import { useUiStore } from '@/store/uiStore';
import { ToolCard } from '@/components/chat/assistant/ToolApproval/ToolCard';
import { MarkdownRenderer } from '@/components/chat/shared/MarkdownRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import { InfoGroupRenderer, groupContinuousInfoChunks, RenderChunk } from './InfoGroupRenderer';

// 结构化提取消息中的截图物理绝对路径
function extractScreenshotsStructured(messages: any[]): { path: string; callId: string }[] {
  const list: { path: string; callId: string }[] = [];
  const fileRegex = /file:\/\/\/([^\s'")\])]+\.png)/gi;
  
  const foundPaths: string[] = [];
  messages.forEach(msg => {
    if (!msg.chunks) return;
    msg.chunks.forEach((chunk: any) => {
      let textToScan = '';
      if (chunk.kind === 'text') {
        textToScan = chunk.text || '';
      } else if (chunk.kind === 'tool_request' && chunk.result) {
        textToScan = chunk.result || '';
      }
      
      if (textToScan) {
        let match;
        const scanText = textToScan.replace(/\\/g, '/');
        fileRegex.lastIndex = 0;
        while ((match = fileRegex.exec(scanText)) !== null) {
          let path = match[1];
          if (path.match(/^\/[a-zA-Z]:/)) {
            path = path.substring(1);
          }
          if (!foundPaths.includes(path)) {
            foundPaths.push(path);
          }
        }
      }
    });
  });

  foundPaths.forEach(path => {
    const baseName = path.split(/[/\\]/).pop() || '';
    const callId = baseName.replace(/\.png$/i, '');
    list.push({ path, callId });
  });

  return list;
}

interface ChunkRendererProps {
  chunk: RenderChunk;
  isStreaming: boolean;
}

// memo 包裹：只有当 chunk 内容或 isStreaming 变化时才重新渲染
// 对于历史 chunk（非最后一个）isStreaming=false，内容不变，完全跳过渲染
const ChunkRenderer = memo(function ChunkRenderer({ chunk, isStreaming }: ChunkRendererProps) {
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
    if (!chunk.text || !chunk.text.trim()) return null;
    return <ThinkingBlock text={chunk.text} defaultCollapsed={!isStreaming} />;
  }
  if (chunk.kind === 'image') {
    return (
      <Box mt={6} style={{ maxWidth: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <img
          src={chunk.text}
          alt="Attachment"
          style={{
            maxWidth: '100%',
            maxHeight: 300,
            objectFit: 'contain',
            borderRadius: 8,
            display: 'block',
            border: '1px solid var(--flock-border-dim)',
          }}
        />
      </Box>
    );
  }
  if (chunk.kind === 'tool_request') {
    return <ToolCard chunk={chunk} />;
  }
  if (chunk.kind === 'info_group') {
    return <InfoGroupRenderer infos={chunk.infos} isStreaming={isStreaming} />;
  }
  if (chunk.kind === 'info') {
    return <InfoGroupRenderer infos={[chunk]} isStreaming={isStreaming} />;
  }
  return null;
});

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();

  // 检查本条消息中是否含有截图
  const hasScreenshots = message.chunks.some((chunk: any) => {
    let text = '';
    if (chunk.kind === 'text') {
      text = chunk.text || '';
    } else if (chunk.kind === 'tool_request' && chunk.result) {
      text = chunk.result || '';
    }
    return text.includes('.flock/sandbox/screenshots') || text.includes('.flock\\sandbox\\screenshots');
  });

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
      {isUser ? (
        <Avatar
          size={32}
          radius="xl"
          style={{
            background: 'var(--flock-accent)',
            border: '1px solid rgba(21, 90, 239, 0.15)',
            boxShadow: '0 2px 8px rgba(21, 90, 239, 0.15)',
            flexShrink: 0,
          }}
        >
          <IconUser size={16} color="white" />
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

      <Box
        style={{
          flex: isUser ? '0 1 auto' : '1 1 0%',
          maxWidth: isUser ? '72%' : '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        <Paper
          p="sm"
          radius="lg"
          style={{
            width: 'fit-content',
            maxWidth: '100%',
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
            {groupContinuousInfoChunks(message.chunks).map((chunk, i, arr) => (
              <ChunkRenderer
                key={i}
                chunk={chunk}
                isStreaming={message.streaming && i === arr.length - 1}
              />
            ))}
            {message.streaming && message.chunks.length === 0 && (
              <Group gap={4}>
                <Loader size={12} type="dots" color="blue" />
                <Text size="xs" c="dimmed">{t('chat.thinking')}</Text>
              </Group>
            )}
            {/* 双向联动：一键拉起沙盒回放时间轴并跳转到指定步骤 */}
            {hasScreenshots && !message.streaming && (
              <Group mt="xs" gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--mantine-color-teal-6)' }} />}
                  styles={{
                    root: {
                      fontSize: '11px',
                      height: '24px',
                      padding: '0 8px',
                      background: 'rgba(20, 184, 166, 0.08)',
                      border: '1px solid rgba(20, 184, 166, 0.25)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(20, 184, 166, 0.15)',
                      }
                    }
                  }}

                  onClick={() => {
                    const allMessages = useAgentStore.getState().messages;
                    const allScreenshots = extractScreenshotsStructured(allMessages);
                    
                    const thisMsgScreenshotPaths: string[] = [];
                    const fileRegex = /file:\/\/\/([^\s'")\])]+\.png)/gi;
                    message.chunks.forEach((chunk: any) => {
                      let textToScan = '';
                      if (chunk.kind === 'text') {
                        textToScan = chunk.text || '';
                      } else if (chunk.kind === 'tool_request' && chunk.result) {
                        textToScan = chunk.result || '';
                      }
                      if (textToScan) {
                        let match;
                        const scanText = textToScan.replace(/\\/g, '/');
                        fileRegex.lastIndex = 0;
                        while ((match = fileRegex.exec(scanText)) !== null) {
                          let path = match[1];
                          if (path.match(/^\/[a-zA-Z]:/)) path = path.substring(1);
                          thisMsgScreenshotPaths.push(path);
                        }
                      }
                    });

                    if (thisMsgScreenshotPaths.length > 0) {
                      const targetIdx = allScreenshots.findIndex(s => thisMsgScreenshotPaths.includes(s.path));
                      if (targetIdx !== -1) {
                        useAgentStore.getState().setPlaybackIndex(targetIdx);
                      }
                    }

                    useUiStore.getState().setEnvironmentMode('computer');
                    useUiStore.getState().setPreviewFile({
                      path: '.flock/sandbox/screenshot.png',
                      content: '',
                      extension: 'vnc',
                    });
                  }}
                >
                  {t('chat.viewStepsPlayback')}
                </Button>
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
