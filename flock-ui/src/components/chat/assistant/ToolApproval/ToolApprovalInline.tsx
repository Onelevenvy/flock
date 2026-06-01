import React, { useEffect, useCallback } from 'react';
import {
  Box,
  Group,
  Text,
  Badge,
  ThemeIcon,
  Code,
  ScrollArea,
  Input,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconTerminal2,
  IconPlug,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { PendingApproval, ToolCategory } from '@/types/protocol';
import { useAgentStore } from '@/store/agentStore';
import { useUiStore } from '@/store/uiStore';

interface ToolApprovalInlineProps {
  approval: PendingApproval | null;
}

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { color: string; label: string; icon: React.ReactNode; riskKey: string }
> = {
  info: {
    color: 'blue',
    label: 'Info',
    icon: <IconEye size={14} />,
    riskKey: 'chat.approval.riskRead',
  },
  edit: {
    color: 'orange',
    label: 'Edit',
    icon: <IconEdit size={14} />,
    riskKey: 'chat.approval.riskWrite',
  },
  exec: {
    color: 'red',
    label: 'Exec',
    icon: <IconTerminal2 size={14} />,
    riskKey: 'chat.approval.riskExec',
  },
  mcp: {
    color: 'grape',
    label: 'MCP',
    icon: <IconPlug size={14} />,
    riskKey: 'chat.approval.riskMcp',
  },
};

export function ToolApprovalInline({ approval }: ToolApprovalInlineProps) {
  const { t } = useTranslation();
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [feedback, setFeedback] = React.useState('');

  useEffect(() => {
    setFeedback('');
  }, [approval?.call_id]);

  const handleApprove = useCallback(
    async (scope: 'once' | 'always') => {
      if (!approval) return;
      removePendingApproval(approval.call_id);
      await invoke('approve_tool', { callId: approval.call_id, scope });
    },
    [approval, removePendingApproval]
  );

  const handleDeny = useCallback(async () => {
    if (!approval) return;
    const reason = feedback.trim() || 'User denied';
    removePendingApproval(approval.call_id);
    await invoke('deny_tool', { callId: approval.call_id, reason });
  }, [approval, removePendingApproval, feedback]);

  // 键盘快捷键：Enter=允许一次, A=始终允许, Esc=拒绝
  useEffect(() => {
    if (!approval) return;

    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleApprove('once');
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleApprove('always');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [approval, handleApprove, handleDeny]);

  if (!approval) return null;

  const { tool } = approval;
  const config = CATEGORY_CONFIG[tool.category] || CATEGORY_CONFIG.exec;
  const riskText = t(config.riskKey);
  const argsStr = JSON.stringify(tool.args, null, 2);

  const displayArgs = (() => {
    const args = tool.args as Record<string, unknown>;
    const primary = args.path || args.command || args.content || args.query || args.url;
    if (typeof primary === 'string') {
      return primary.length > 120 ? primary.slice(0, 120) + '...' : primary;
    }
    return null;
  })();

  return (
    <Box
      style={{
        margin: '8px 16px',
        borderRadius: 10,
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* 标题行 */}
      <Box
        style={{
          padding: '10px 14px 8px',
          background: 'var(--flock-bg-surface)',
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ThemeIcon size="sm" color={config.color} variant="light" radius="sm">
          {config.icon}
        </ThemeIcon>
        <Text size="sm" fw={600} c={isDark ? `${config.color}.3` : `${config.color}.8`}>
          {tool.name}
        </Text>
        <Badge size="xs" color={config.color} variant="dot">
          {riskText}
        </Badge>
        <Text
          size="xs"
          c="dimmed"
          style={{
            marginLeft: 'auto',
            opacity: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '40%',
          }}
          title={tool.description}
        >
          {tool.description}
        </Text>
      </Box>

      {/* 参数内容 */}
      <ScrollArea.Autosize mah={150} style={{ padding: '8px 14px' }} offsetScrollbars>
        {displayArgs ? (
          <Text
            size="xs"
            style={{
              fontFamily: 'var(--mantine-font-family-monospace)',
              color: 'var(--flock-text-dim)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {displayArgs}
          </Text>
        ) : (
          <Code
            block
            style={{
              fontSize: 11,
              background: 'transparent',
              color: 'var(--flock-text-muted)',
              padding: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {argsStr}
          </Code>
        )}
      </ScrollArea.Autosize>

      {/* 操作区 */}
      <Box
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--flock-border-dim)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        {/* 允许一次 */}
        <Group
          gap={6}
          style={{ cursor: 'pointer' }}
          onClick={() => handleApprove('once')}
          className="approval-btn"
        >
          <Box
            style={{
              width: 44,
              height: 22,
              borderRadius: 5,
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text size="xs" fw={600} style={{ fontSize: 10, letterSpacing: '0.03em' }}>
              Enter
            </Text>
          </Box>
          <Text size="xs" c={isDark ? 'teal.4' : 'teal.8'} fw={600}>
            {approval.is_workflow ? t('chat.approval.btnApprove') : t('chat.approval.btnApproveOnce')}
          </Text>
        </Group>

        {/* 始终允许 */}
        {!approval.is_workflow && (
          <Group
            gap={6}
            style={{ cursor: 'pointer' }}
            onClick={() => handleApprove('always')}
            className="approval-btn"
          >
            <Box
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="xs" fw={700} style={{ fontSize: 11 }}>
                A
              </Text>
            </Box>
            <Text size="xs" c={isDark ? 'blue.4' : 'blue.8'} fw={600}>
              {t('chat.approval.btnApproveAlways')}
            </Text>
          </Group>
        )}

        {/* 拒绝和输入反馈 */}
        <Group gap={12} style={{ width: '100%' }} wrap="nowrap">
          <Group
            gap={6}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={handleDeny}
            className="approval-btn"
          >
            <Box
              style={{
                width: 34,
                height: 22,
                borderRadius: 5,
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="xs" fw={600} style={{ fontSize: 10, letterSpacing: '0.03em' }}>
                Esc
              </Text>
            </Box>
            <Text size="xs" c={isDark ? 'red.4' : 'red.8'} fw={600} style={{ whiteSpace: 'nowrap' }}>
              {feedback.trim() ? t('chat.approval.btnDenyWithFeedback') : t('chat.approval.btnDeny')}
            </Text>
          </Group>

          <Input
            placeholder={t('chat.approval.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            style={{ flexGrow: 1 }}
            size="xs"
            styles={{
              input: {
                height: 26,
                fontSize: '11px',
                backgroundColor: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
                color: 'var(--flock-text-primary)',
                borderRadius: '4px',
                width: '100%',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDeny();
              }
            }}
          />
        </Group>
      </Box>
    </Box>
  );
}
