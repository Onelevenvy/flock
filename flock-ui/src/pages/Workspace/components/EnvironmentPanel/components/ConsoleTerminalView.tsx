import React, { useEffect, useRef } from 'react';
import { Box, Text, ScrollArea, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import { useAgentStore } from '@/store/agentStore';
import { buildLiveTerminalContent } from '@/pages/Workspace/components/EnvironmentPanel/utils/consoleUtils';
import { useTypewriterStream } from '@/pages/Workspace/components/EnvironmentPanel/hooks/useTypewriterStream';

interface ConsoleTerminalViewProps {
  content: string;
}

export function ConsoleTerminalView({ content }: ConsoleTerminalViewProps) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  const previewFile = useUiStore((s) => s.previewFile);
  const isLiveTerminal = previewFile?.path === '.flock/sandbox/code_result.log';

  const messages = useAgentStore((s) => s.messages);
  const liveContent = isLiveTerminal ? buildLiveTerminalContent(messages) : content;

  const displayedContent = useTypewriterStream(liveContent);

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
        background: isDark ? '#121212' : '#f8f9fa',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4) inset' : '0 2px 8px rgba(0,0,0,0.06) inset',
        margin: '16px',
        border: isDark ? '1px solid #333' : '1px solid #e4e4e7',
      }}
    >
      {/* macOS-style terminal chrome */}
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

      {/* Terminal output area */}
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
            color: isDark ? '#a9b7c6' : '#18181b',
          }}
        >
          {displayedContent || t('chat.console.sandboxPrompt', { defaultValue: 'flock-sandbox:/workspace$ ' })}
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
