import { useState } from 'react';
import { Box, Text, Group, Switch, ActionIcon, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { Tool, ToolProvider } from '../../../hooks/useAvailableTools';
import { ToolsIcon } from '../Icons';
import { ToolDetailPopover } from './ToolDetailPopover';

export interface ToolCardProps {
  tool: Tool;
  provider?: ToolProvider;
  enabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ToolCard({ tool, provider, enabled, onToggle, onRemove, disabled }: ToolCardProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        background: enabled ? 'var(--flock-bg-surface)' : 'var(--flock-bg-raised)',
        border: `1px solid ${enabled ? 'var(--flock-border-dim)' : 'var(--flock-border-subtle)'}`,
        transition: 'all 0.15s ease',
        opacity: enabled ? 1 : 0.55,
      }}
    >
      {/* Provider 图标 */}
      <Box
        style={{
          width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
          background: 'var(--flock-bg-hover)',
          border: '1px solid var(--flock-border-subtle)',
          flexShrink: 0,
        }}
      >
        <ToolsIcon name={tool.provider_id} size={15} />
      </Box>

      {/* 名称 + Provider 标签 */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        {provider && (
          <Text
            size="9px" fw={600} tt="uppercase"
            style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.06em', lineHeight: 1, marginBottom: 1 }}
          >
            {provider.provider_name}
          </Text>
        )}
        <Text
          size="xs" fw={500} truncate
          style={{
            fontFamily: 'var(--mantine-font-family-monospace)',
            color: enabled ? 'var(--flock-text-bright)' : 'var(--flock-text-dim)',
            lineHeight: 1.2,
          }}
        >
          {tool.name}
        </Text>
      </Box>

      {/* 右侧操作区 */}
      <Group gap={3} style={{ flexShrink: 0 }}>
        {/* 悬浮时显示：详情按钮 */}
        {hovered && !disabled && (
          <ToolDetailPopover tool={tool} provider={provider} />
        )}

        {/* 悬浮时显示：删除按钮 */}
        {hovered && !disabled && (
          <Tooltip label={t('workflow.properties.agent.toolRemove')} withinPortal>
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              <IconX size={12} />
            </ActionIcon>
          </Tooltip>
        )}

        {/* 开关（始终显示） */}
        <Switch
          size="xs"
          checked={enabled}
          onChange={() => !disabled && onToggle()}
          onClick={(e) => e.stopPropagation()}
          styles={{ track: { cursor: disabled ? 'not-allowed' : 'pointer' } }}
        />
      </Group>
    </Box>
  );
}
