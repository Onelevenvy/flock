import React, { useEffect, useCallback } from 'react';
import {
  Box,
  Group,
  Text,
  Badge,
  ThemeIcon,
  Code,
  ScrollArea,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconTerminal2,
  IconPlug,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { PendingApproval, ToolCategory } from '../../../types/protocol';
import { useAgentStore } from '../../../store/agentStore';

interface ToolApprovalInlineProps {
  approval: PendingApproval | null;
}

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { color: string; label: string; icon: React.ReactNode; riskText: string }
> = {
  info: {
    color: 'blue',
    label: 'Info',
    icon: <IconEye size={14} />,
    riskText: '只读操作',
  },
  edit: {
    color: 'orange',
    label: 'Edit',
    icon: <IconEdit size={14} />,
    riskText: '修改文件',
  },
  exec: {
    color: 'red',
    label: 'Exec',
    icon: <IconTerminal2 size={14} />,
    riskText: '执行命令，请谨慎',
  },
  mcp: {
    color: 'grape',
    label: 'MCP',
    icon: <IconPlug size={14} />,
    riskText: '外部工具调用',
  },
};

export function ToolApprovalInline({ approval }: ToolApprovalInlineProps) {
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);

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
    removePendingApproval(approval.call_id);
    await invoke('deny_tool', { callId: approval.call_id, reason: 'User denied' });
  }, [approval, removePendingApproval]);

  // 键盘快捷键：Enter=允许一次, A=始终允许, Esc=拒绝
  useEffect(() => {
    if (!approval) return;

    const handleKey = (e: KeyboardEvent) => {
      // 如果焦点在输入框则忽略
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
  const argsStr = JSON.stringify(tool.args, null, 2);

  // 对 args 做人性化展示：取最显眼的字段
  const displayArgs = (() => {
    const args = tool.args as Record<string, unknown>;
    // 常见字段优先级
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
        <Text size="sm" fw={600} c={`${config.color}.3`}>
          {tool.name}
        </Text>
        <Badge size="xs" color={config.color} variant="dot">
          {config.riskText}
        </Badge>
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto', opacity: 0.5 }}>
          {tool.description}
        </Text>
      </Box>

      {/* 参数内容 */}
      <ScrollArea.Autosize mah={150} style={{ padding: '8px 14px' }} offsetScrollbars>
        {displayArgs ? (
          <Text
            size="xs"
            style={{
              fontFamily: '"JetBrains Mono", monospace',
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
          padding: '8px 14px 10px',
          borderTop: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
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
          <Text size="xs" c="teal.4" fw={500}>
            是，允许一次
          </Text>
        </Group>

        {/* 始终允许 */}
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
          <Text size="xs" c="indigo.4" fw={500}>
            是，始终允许
          </Text>
        </Group>

        {/* 拒绝 */}
        <Group
          gap={6}
          style={{ cursor: 'pointer', marginLeft: 'auto' }}
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
          <Text size="xs" c="red.4" fw={500}>
            否 (esc)
          </Text>
        </Group>
      </Box>
    </Box>
  );
}
