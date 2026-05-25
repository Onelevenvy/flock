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
import { ChatMessage, InfoChunk, MessageChunk } from '../../types/protocol';
import { ToolCard } from './ToolApproval/ToolCard';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkspacesQuery, useCreateConversationMutation } from '../../hooks/useWorkspaces';
import { useAgentStore } from '../../store/agentStore';
import { useUiStore } from '../../store/uiStore';
import { MarkdownRenderer } from './MarkdownRenderer';

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
            wordBreak: 'break-all',
          }}
        >
          {text}
        </Text>
      </Collapse>
    </Box>
  );
}

type RenderChunk = MessageChunk | { kind: 'info_group'; infos: InfoChunk[] };

function groupContinuousInfoChunks(chunks: MessageChunk[]): RenderChunk[] {
  const result: RenderChunk[] = [];
  let currentGroup: InfoChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.kind === 'info') {
      currentGroup.push(chunk);
    } else {
      if (currentGroup.length > 0) {
        result.push({ kind: 'info_group', infos: currentGroup });
        currentGroup = [];
      }
      result.push(chunk);
    }
  }

  if (currentGroup.length > 0) {
    result.push({ kind: 'info_group', infos: currentGroup });
  }

  return result;
}

function parseInfoMessage(message: string): { summary: string; output?: string } {
  const outputIndex = message.indexOf('[输出]');
  if (outputIndex !== -1) {
    const summary = message.substring(0, outputIndex).trim();
    const output = message.substring(outputIndex + 4).trim().replace(/^[:：\s]+/, '');
    return { summary, output };
  }
  
  if (message.length > 150 && message.includes('\n')) {
    const lines = message.split('\n');
    const summary = lines[0].trim();
    const output = lines.slice(1).join('\n').trim();
    return { summary, output };
  }

  const toolResultRegex = /^\[([a-zA-Z0-9_-]+)\s+(success|error)\]\s*([\s\S]*)$/;
  const match = message.match(toolResultRegex);
  if (match) {
    const name = match[1];
    const status = match[2];
    const content = match[3].trim();
    
    const innerOutputIndex = content.indexOf('[输出]');
    if (innerOutputIndex !== -1) {
      const summary = `[${name} ${status}] ${content.substring(0, innerOutputIndex).trim()}`;
      const output = content.substring(innerOutputIndex + 4).trim().replace(/^[:：\s]+/, '');
      return { summary, output };
    }

    if (content.length > 120 || content.includes('\n')) {
      const statusText = status === 'success' ? '成功' : '失败';
      const summary = `工具 ${name} 执行${statusText}`;
      return { summary, output: content };
    }
  }

  return { summary: message };
}

function InfoItem({ info }: { info: InfoChunk }) {
  const { summary, output } = parseInfoMessage(info.message);
  const [outputCollapsed, setOutputCollapsed] = useState(true);
  const { t } = useTranslation();
  
  const isSuccess = info.message.includes('已就绪') || info.message.includes('成功') || info.message.includes('完成');
  const isError = info.message.includes('失败') || info.message.includes('出错') || info.message.includes('健康状态') || info.message.includes('失效');

  return (
    <Box style={{ marginBottom: 6 }}>
      <Group gap={6} align="center" wrap="nowrap">
        {isSuccess && <Text size="xs" fw={800} style={{ color: '#0ca678', display: 'flex', alignItems: 'center' }}>✓</Text>}
        {isError && <Text size="xs" fw={800} style={{ color: '#f03e3e', display: 'flex', alignItems: 'center' }}>✗</Text>}
        {!isSuccess && !isError && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--flock-accent)', marginRight: 2 }} />}
        
        <Text
          size="xs"
          fw={500}
          style={{
            color: 'var(--flock-text-secondary)',
            flex: 1,
            wordBreak: 'break-all',
          }}
        >
          {summary}
        </Text>

        {output && (
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            styles={{ root: { height: 18, padding: '0 4px', fontSize: 10 } }}
            onClick={() => setOutputCollapsed(v => !v)}
          >
            {outputCollapsed ? t('showOutput') : t('hideOutput')}
          </Button>
        )}
      </Group>

      {output && (
        <Collapse in={!outputCollapsed} mt={4}>
          <Paper
            p="xs"
            style={{
              background: 'var(--flock-bg-surface-dim, #1a1a1a)',
              borderRadius: 4,
              border: '1px solid var(--flock-border-dim)',
              maxHeight: 250,
              overflowY: 'auto',
            }}
          >
            <Text
              size="xs"
              style={{
                fontFamily: 'var(--mantine-font-family-monospace)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#e0e0e0',
                lineHeight: 1.5,
              }}
            >
              {output}
            </Text>
          </Paper>
        </Collapse>
      )}
    </Box>
  );
}

function InfoGroupRenderer({ infos, isStreaming }: { infos: InfoChunk[]; isStreaming: boolean }) {
  const [collapsed, setCollapsed] = useState(!isStreaming);
  const { t } = useTranslation();

  const lastStreaming = useRef(isStreaming);
  useEffect(() => {
    if (lastStreaming.current && !isStreaming) {
      setCollapsed(true);
    }
    lastStreaming.current = isStreaming;
  }, [isStreaming]);

  if (infos.length === 0) return null;

  const hasError = infos.some(info => 
    info.message.includes('失败') || info.message.includes('出错') || info.message.includes('健康状态') || info.message.includes('失效')
  );
  
  const latestMessage = infos[infos.length - 1].message;
  const isFinished = !isStreaming;

  let status: 'success' | 'error' | 'running' = 'running';
  if (hasError) {
    status = 'error';
  } else if (isFinished) {
    status = 'success';
  }

  const borderLeftColor = 
    status === 'success' 
      ? '#0ca678' 
      : status === 'error' 
      ? '#f03e3e' 
      : 'var(--flock-accent)';

  let summaryTitle = '';
  if (status === 'error') {
    summaryTitle = t('sandboxLogsError');
  } else if (status === 'success') {
    summaryTitle = t('sandboxLogsSuccess');
  } else {
    summaryTitle = t('sandboxLogsRunning');
  }

  const { summary: latestSummary } = parseInfoMessage(latestMessage);

  return (
    <Paper
      p="xs"
      radius="sm"
      style={{
        background: 'var(--flock-bg-surface)',
        borderLeft: `3px solid ${borderLeftColor}`,
        padding: '6px 12px',
        marginBottom: 6,
        border: '1px solid var(--flock-border-dim)',
        borderLeftWidth: 3,
        minWidth: 0,
      }}
    >
      <Group
        gap={8}
        wrap="nowrap"
        style={{ cursor: 'pointer' }}
        onClick={() => setCollapsed(v => !v)}
      >
        {status === 'running' && <Loader size={12} type="dots" color="var(--flock-accent)" />}
        {status === 'success' && <Text size="xs" fw={800} style={{ color: '#0ca678', display: 'inline-flex', alignItems: 'center' }}>✓</Text>}
        {status === 'error' && <Text size="xs" fw={800} style={{ color: '#f03e3e', display: 'inline-flex', alignItems: 'center' }}>✗</Text>}

        <Text
          size="xs"
          fw={600}
          style={{
            color: status === 'success' ? '#0ca678' : status === 'error' ? '#f03e3e' : 'var(--flock-text-primary)',
            flexShrink: 0,
          }}
        >
          {summaryTitle}
        </Text>

        <Text
          size="xs"
          fw={400}
          style={{
            color: 'var(--flock-text-secondary)',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {collapsed ? `(${t('sandboxLogs', { count: infos.length })}) ${latestSummary}` : ''}
        </Text>

        <ActionIcon size="xs" variant="transparent" color="gray">
          {collapsed ? <IconChevronRight size={11} /> : <IconChevronDown size={11} />}
        </ActionIcon>
      </Group>

      <Collapse in={!collapsed} mt={8}>
        <Box style={{ paddingLeft: 4, paddingTop: 4 }}>
          {infos.map((info, idx) => (
            <InfoItem key={idx} info={info} />
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ---- Chunk 渲染 ----
function ChunkRenderer({ chunk, isStreaming }: { chunk: RenderChunk; isStreaming: boolean }) {
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
  if (chunk.kind === 'info_group') {
    return <InfoGroupRenderer infos={chunk.infos} isStreaming={isStreaming} />;
  }
  if (chunk.kind === 'info') {
    return <InfoGroupRenderer infos={[chunk]} isStreaming={isStreaming} />;
  }
  return null;
}

// ---- 消息气泡 ----
function MessageBubble({ message }: { message: ChatMessage }) {
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
                  leftSection={<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0ca678' }} />}
                  styles={{
                    root: {
                      fontSize: '11px',
                      height: '24px',
                      padding: '0 8px',
                      background: 'rgba(12, 166, 120, 0.08)',
                      border: '1px solid rgba(12, 166, 120, 0.25)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(12, 166, 120, 0.15)',
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

                    useUiStore.getState().setPreviewFile({
                      path: '.flock/sandbox/screenshot.png',
                      content: '',
                      extension: 'vnc',
                    });
                  }}
                >
                  {t('chat.viewStepsPlayback', { defaultValue: '查看此步骤屏幕回放' })}
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
