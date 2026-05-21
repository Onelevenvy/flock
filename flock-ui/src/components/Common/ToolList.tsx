import { useState, useMemo } from 'react';
import {
  Box,
  Text,
  Group,
  Switch,
  ActionIcon,
  Stack,
  Popover,
  Badge,
  Accordion,
  Divider,
  Tooltip,
} from '@mantine/core';
import { IconX, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAvailableTools, type Tool, type ToolProvider } from '../../hooks/useAvailableTools';
import { ToolsIcon } from './Icons';
import ToolSelector from './ToolSelector';

// ────────────────────────────────────────────────────────────────
// 工具详情 Popover（内联展示描述 + 参数）
// ────────────────────────────────────────────────────────────────
function ToolDetailPopover({
  tool,
  provider,
}: {
  tool: Tool;
  provider?: ToolProvider;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  let params: Record<string, { type: string; description: string }> = {};
  try {
    const schema = JSON.parse(tool.input_schema);
    params = schema.properties || {};
  } catch {
    params = {};
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={300}
      withinPortal
      position="right"
      shadow="md"
      styles={{
        dropdown: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 12,
          padding: 0,
          zIndex: 9999,
          maxHeight: 'min(480px, 80vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Popover.Target>
        <Tooltip label={t('workflow.properties.agent.toolDetail', { defaultValue: '查看工具详情' })} withinPortal>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setOpened((o) => !o);
            }}
          >
            <IconInfoCircle size={13} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <Group gap="sm" p="md" pb="sm">
          <Box
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-subtle)',
              flexShrink: 0,
            }}
          >
            <ToolsIcon name={tool.provider_id} size={18} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            {provider && (
              <Text
                size="9px"
                fw={600}
                tt="uppercase"
                style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.06em', lineHeight: 1 }}
              >
                {provider.provider_name}
              </Text>
            )}
            <Text
              size="sm"
              fw={600}
              style={{
                color: 'var(--flock-text-bright)',
                fontFamily: 'var(--mantine-font-family-monospace)',
              }}
            >
              {tool.name}
            </Text>
          </Box>
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        <Box p="md" style={{ flex: 1, overflowY: 'auto' }}>
          {/* 描述 */}
          <Text size="xs" c="dimmed" mb={Object.keys(params).length > 0 ? 'md' : 0} style={{ lineHeight: 1.5 }}>
            {tool.description || t('common.noDescription', { defaultValue: '暂无描述' })}
          </Text>

          {/* 参数列表 */}
          {Object.keys(params).length > 0 && (
            <>
              <Text size="xs" fw={600} mb="xs" style={{ color: 'var(--flock-text-secondary)' }}>
                {t('skills.tools.params', { defaultValue: 'Parameters' })}
              </Text>
              <Stack gap={5}>
                {Object.entries(params).map(([paramName, param]) => (
                  <Box
                    key={paramName}
                    p={8}
                    style={{
                      borderRadius: 6,
                      background: 'var(--flock-bg-surface)',
                      border: '1px solid var(--flock-border-subtle)',
                    }}
                  >
                    <Group justify="space-between" mb={3}>
                      <Text
                        size="xs"
                        fw={500}
                        style={{
                          fontFamily: 'var(--mantine-font-family-monospace)',
                          color: 'var(--flock-text-bright)',
                        }}
                      >
                        {paramName}
                      </Text>
                      <Badge size="xs" variant="filled" color="blue">
                        {param.type || 'any'}
                      </Badge>
                    </Group>
                    {param.description && (
                      <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {param.description}
                      </Text>
                    )}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}

// ────────────────────────────────────────────────────────────────
// 单个工具卡片
// ────────────────────────────────────────────────────────────────
function ToolCard({
  tool,
  provider,
  enabled,
  onToggle,
  onRemove,
  disabled,
}: {
  tool: Tool;
  provider?: ToolProvider;
  enabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
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
      {/* 图标 */}
      <Box
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: 'var(--flock-bg-hover)',
          border: '1px solid var(--flock-border-subtle)',
          flexShrink: 0,
        }}
      >
        <ToolsIcon name={tool.provider_id} size={15} />
      </Box>

      {/* 名称 + 分组 */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        {provider && (
          <Text
            size="9px"
            fw={600}
            tt="uppercase"
            style={{
              color: 'var(--flock-text-dim)',
              letterSpacing: '0.06em',
              lineHeight: 1,
              marginBottom: 1,
            }}
          >
            {provider.provider_name}
          </Text>
        )}
        <Text
          size="xs"
          fw={500}
          truncate
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
        {/* 详情按钮（悬浮时显示） */}
        {hovered && !disabled && (
          <ToolDetailPopover tool={tool} provider={provider} />
        )}

        {/* 删除按钮（悬浮时显示） */}
        {hovered && !disabled && (
          <Tooltip label={t('common.remove', { defaultValue: '移除' })} withinPortal>
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <IconX size={12} />
            </ActionIcon>
          </Tooltip>
        )}

        {/* 开关 */}
        <Switch
          size="xs"
          checked={enabled}
          onChange={() => !disabled && onToggle()}
          onClick={(e) => e.stopPropagation()}
          styles={{
            track: { cursor: disabled ? 'not-allowed' : 'pointer' },
          }}
        />
      </Group>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────────
// ToolList 主组件
// ────────────────────────────────────────────────────────────────
export interface ToolListProps {
  /** 所有选中（绑定）的工具 names */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** 工具 Selector Popover 的弹出位置 */
  selectorPosition?: 'bottom-start' | 'bottom' | 'bottom-end' | 'left' | 'right' | 'top';
  label?: string;
}

export default function ToolList({
  value = [],
  onChange,
  disabled = false,
  selectorPosition,
  label,
}: ToolListProps) {
  const { t } = useTranslation();
  const { tools, providers, loading } = useAvailableTools();

  // 维护被禁用（关闭开关）的工具集合（本地状态）
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());

  // 将 value 映射为完整 Tool 对象
  const selectedTools = useMemo(() => {
    return value
      .map((name) => tools.find((t) => t.name === name))
      .filter((t): t is Tool => !!t);
  }, [value, tools]);

  const getProvider = (providerId: string) => providers.find((p) => p.id === providerId);

  const handleToggle = (toolName: string) => {
    if (disabled) return;
    setDisabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const handleRemove = (toolName: string) => {
    if (disabled) return;
    onChange(value.filter((n) => n !== toolName));
    setDisabledTools((prev) => {
      const next = new Set(prev);
      next.delete(toolName);
      return next;
    });
  };

  const enabledCount = value.filter((n) => !disabledTools.has(n)).length;
  const totalCount = value.length;

  return (
    <Stack gap={6}>
      {/* 标题栏 */}
      <Group justify="space-between" align="center">
        <Group gap={6}>
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)' }}>
            {label || t('workflow.properties.agent.toolsSelect', { defaultValue: '工具列表' })}
          </Text>
          {totalCount > 0 && (
            <Text size="xs" c="dimmed">
              {enabledCount}/{totalCount} {t('workflow.properties.agent.toolsEnabled', { defaultValue: '启用' })}
            </Text>
          )}
        </Group>

        {!disabled && (
          <ToolSelector
            value={value}
            onChange={onChange}
            position={selectorPosition || 'bottom-end'}
            disabled={loading}
            triggerOnly
          />
        )}
      </Group>

      {/* 工具卡片列表 */}
      {value.length === 0 ? (
        <Box
          style={{
            padding: '14px 12px',
            borderRadius: 8,
            border: '1px dashed var(--flock-border-dim)',
            textAlign: 'center',
          }}
        >
          <Text size="xs" c="dimmed">
            {t('workflow.properties.agent.noTools', { defaultValue: '暂无工具，点击 + 添加' })}
          </Text>
        </Box>
      ) : (
        <Stack gap={4}>
          {selectedTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              provider={getProvider(tool.provider_id)}
              enabled={!disabledTools.has(tool.name)}
              onToggle={() => handleToggle(tool.name)}
              onRemove={() => handleRemove(tool.name)}
              disabled={disabled}
            />
          ))}
          {/* value 中有但 tools 未加载到的（fallback） */}
          {value
            .filter((name) => !selectedTools.find((t) => t.name === name))
            .map((name) => (
              <Box
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                }}
              >
                <Text
                  size="xs"
                  style={{
                    flex: 1,
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    color: 'var(--flock-text-dim)',
                  }}
                >
                  {name}
                </Text>
                {!disabled && (
                  <ActionIcon variant="subtle" color="red" size="xs" onClick={() => handleRemove(name)}>
                    <IconX size={12} />
                  </ActionIcon>
                )}
              </Box>
            ))}
        </Stack>
      )}
    </Stack>
  );
}
