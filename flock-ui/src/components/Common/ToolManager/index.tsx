/**
 * ToolManager / index.tsx
 *
 * 工具管理列表，显示已选工具（启用+禁用）的卡片列表。
 *
 * 设计约定：
 *   value          — 启用中的工具 name 列表（传给 LLM 的）
 *   disabledValue  — 已关闭开关但仍显示的工具 name 列表
 *   onChange / onDisabledChange — 原子回调（请在父组件使用函数式 setState 更新避免批量覆盖）
 *
 * 开关关闭：从 value 移入 disabledValue
 * 开关打开：从 disabledValue 移入 value
 * 删除：同时从 value 和 disabledValue 移除
 */
import { useMemo } from 'react';
import { Box, Text, Group, Stack, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAvailableTools, type Tool } from '../../../hooks/useAvailableTools';
import { ToolCard } from './ToolCard';
import { ToolPickerPopover } from './ToolPickerPopover';
import type { PopoverProps } from '@mantine/core';

export interface ToolManagerProps {
  /** 启用中的工具 names */
  value: string[];
  onChange: (v: string[]) => void;
  /** 禁用（开关关闭）但仍可见的工具 names */
  disabledValue?: string[];
  onDisabledChange?: (v: string[]) => void;
  disabled?: boolean;
  selectorPosition?: PopoverProps['position'];
  label?: string;
}

export default function ToolManager({
  value = [],
  onChange,
  disabledValue = [],
  onDisabledChange,
  disabled = false,
  selectorPosition = 'bottom-end',
  label,
}: ToolManagerProps) {
  const { t } = useTranslation();
  const { tools, providers, loading } = useAvailableTools();

  // 全量已选名称（value ∪ disabledValue，去重保序）
  const allNames = useMemo(() => {
    const inValue = new Set(value);
    return [...value, ...disabledValue.filter((n) => !inValue.has(n))];
  }, [value, disabledValue]);

  // 映射为完整 Tool 对象
  const selectedTools = useMemo(
    () => allNames.map((name) => tools.find((t) => t.name === name)).filter((t): t is Tool => !!t),
    [allNames, tools]
  );

  // value/disabledValue 中有但尚未加载的工具名（fallback 显示）
  const unloadedNames = useMemo(
    () => allNames.filter((name) => !selectedTools.find((t) => t.name === name)),
    [allNames, selectedTools]
  );

  const getProvider = (providerId: string) => providers.find((p) => p.id === providerId);
  const isEnabled = (name: string) => value.includes(name) && !disabledValue.includes(name);

  // ── 开关切换：在 value 和 disabledValue 之间原子移动 ──────────
  const handleToggle = (toolName: string) => {
    if (disabled) return;
    if (isEnabled(toolName)) {
      // 关闭：移出 value，移入 disabledValue
      onChange(value.filter((n) => n !== toolName));
      onDisabledChange?.([...disabledValue.filter((n) => n !== toolName), toolName]);
    } else {
      // 打开：移出 disabledValue，移入 value（如不在则加）
      onDisabledChange?.(disabledValue.filter((n) => n !== toolName));
      if (!value.includes(toolName)) {
        onChange([...value, toolName]);
      }
    }
  };

  // ── 删除：同时从两个列表移除 ──────────────────────────────────
  const handleRemove = (toolName: string) => {
    if (disabled) return;
    onChange(value.filter((n) => n !== toolName));
    onDisabledChange?.(disabledValue.filter((n) => n !== toolName));
  };

  // ── 添加（来自 Picker）：新选中的工具全部加入 value，同时从 disabledValue 移除重叠 ──
  const handleAdd = (newValue: string[]) => {
    onChange(newValue);
    if (onDisabledChange) {
      const cleaned = disabledValue.filter((n) => !newValue.includes(n));
      if (cleaned.length !== disabledValue.length) onDisabledChange(cleaned);
    }
  };

  const enabledCount = value.filter((n) => !disabledValue.includes(n)).length;
  const totalCount = allNames.length;

  return (
    <Stack gap={6}>
      {/* 标题栏 */}
      <Group justify="space-between" align="center">
        <Group gap={6}>
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)' }}>
            {label || t('workflow.properties.agent.toolsSelect')}
          </Text>
          {totalCount > 0 && (
            <Text size="xs" c="dimmed">
              {enabledCount}/{totalCount} {t('workflow.properties.agent.toolsEnabled')}
            </Text>
          )}
        </Group>

        {!disabled && (
          <ToolPickerPopover
            value={value}
            onChange={handleAdd}
            position={selectorPosition}
            disabled={loading}
          />
        )}
      </Group>

      {/* 工具卡片列表 */}
      {totalCount === 0 ? (
        <Box
          style={{
            padding: '14px 12px', borderRadius: 8,
            border: '1px dashed var(--flock-border-dim)', textAlign: 'center',
          }}
        >
          <Text size="xs" c="dimmed">{t('workflow.properties.agent.noTools')}</Text>
        </Box>
      ) : (
        <Stack gap={4}>
          {selectedTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              provider={getProvider(tool.provider_id)}
              enabled={isEnabled(tool.name)}
              onToggle={() => handleToggle(tool.name)}
              onRemove={() => handleRemove(tool.name)}
              disabled={disabled}
            />
          ))}

          {/* 工具数据未加载时的 fallback 行 */}
          {unloadedNames.map((name) => (
            <Box
              key={name}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                borderRadius: 8, background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)',
              }}
            >
              <Text size="xs" style={{ flex: 1, fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-dim)' }}>
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

// Re-export sub-components for direct use if needed
export { ToolCard } from './ToolCard';
export { ToolDetailPopover } from './ToolDetailPopover';
export { ToolPickerPopover } from './ToolPickerPopover';
