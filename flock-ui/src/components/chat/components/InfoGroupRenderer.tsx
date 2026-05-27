import { useState, useEffect, useRef } from 'react';
import { Box, Group, Paper, Text, Loader, ActionIcon, Collapse, Button } from '@mantine/core';
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MessageChunk, InfoChunk } from '../../../types/protocol';

export type RenderChunk = MessageChunk | { kind: 'info_group'; infos: InfoChunk[] };

export function groupContinuousInfoChunks(chunks: MessageChunk[]): RenderChunk[] {
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

export function parseInfoMessage(message: string, t: (key: string, opts?: any) => string): { summary: string; output?: string } {
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
      const statusText = status === 'success' ? t('common.success') : t('common.failed');
      const summary = t('chat.infoGroup.toolExecuted', { name, status: statusText });
      return { summary, output: content };
    }
  }

  return { summary: message };
}

export function InfoItem({ info }: { info: InfoChunk }) {
  const { t } = useTranslation();
  const { summary, output } = parseInfoMessage(info.message, t);
  const [outputCollapsed, setOutputCollapsed] = useState(true);

  // Matches backend Chinese output strings
  const isSuccess = info.message.includes('已就绪') || info.message.includes('成功') || info.message.includes('完成');
  // Matches backend Chinese output strings
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

interface InfoGroupRendererProps {
  infos: InfoChunk[];
  isStreaming: boolean;
}

export function InfoGroupRenderer({ infos, isStreaming }: InfoGroupRendererProps) {
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

  // Matches backend Chinese output strings
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

  const { summary: latestSummary } = parseInfoMessage(latestMessage, t);

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
