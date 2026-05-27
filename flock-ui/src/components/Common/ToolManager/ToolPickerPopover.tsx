/**
 * ToolPickerPopover
 *
 * 弹出式工具选择面板。通过 triggerSlot 渲染触发按钮（使 Popover Target 与外部 UI 解耦）。
 * 内部用临时状态隔离，点「确认」才 commit 到外部。
 */
import { useState, useMemo, useEffect } from 'react';
import {
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Popover,
  TextInput,
  ScrollArea,
  Accordion,
  Box,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAvailableTools } from '../../../hooks/useAvailableTools';
import { ToolsIcon } from '../Icons';
import { IconSearch, IconX, IconPlus } from '@tabler/icons-react';
import { getProviderName } from '../../../pages/Skills/helpers';


import { useDisclosure } from '@mantine/hooks';
import type { PopoverProps } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface ToolPickerPopoverProps {
  /** 当前已选工具名列表 */
  value: string[];
  /** 确认选择后回调 */
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** Popover 弹出方向 */
  position?: PopoverProps['position'];
}

export function ToolPickerPopover({
  value = [],
  onChange,
  disabled = false,
  position = 'bottom-end',
}: ToolPickerPopoverProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchText, setSearchText] = useState('');
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const { providers, tools, loading } = useAvailableTools();

  // 临时状态：Popover 打开时的草稿选择
  const [tempValue, setTempValue] = useState<string[]>(value);
  useEffect(() => {
    if (opened) setTempValue(value);
  }, [opened]);

  // 过滤搜索
  const filteredProviders = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return providers
      .map((prov) => {
        const provTools = tools.filter((t) => t.provider_id === prov.id);
        const matched = provTools.filter((tool) =>
          !q || tool.name.toLowerCase().includes(q) || getProviderName(prov).toLowerCase().includes(q)
        );
        return { ...prov, tools: matched, totalCount: provTools.length };
      })
      .filter((prov) => prov.tools.length > 0);
  }, [providers, tools, searchText]);

  const getSelectedCount = (providerId: string) =>
    tools.filter((t) => t.provider_id === providerId && tempValue.includes(t.name)).length;

  const handleToggleTool = (toolName: string) => {
    const tool = tools.find((t) => t.name === toolName);
    if (tool) {
      const provider = providers.find((p) => p.id === tool.provider_id);
      const isUnauthorized = provider?.credentials_schema && !provider.is_available;
      if (isUnauthorized && !tempValue.includes(toolName)) {
        notifications.show({
          title: t('assistant.form.toolUnauthorizedTitle'),
          message: t('assistant.form.toolUnauthorizedMsg'),
          color: 'red',
          autoClose: 5000,
        });
        return;
      }
    }
    setTempValue((prev) =>
      prev.includes(toolName) ? prev.filter((n) => n !== toolName) : [...prev, toolName]
    );
  };

  const handleBatchToggle = (providerTools: typeof tools, e: React.MouseEvent) => {
    e.stopPropagation();
    const names = providerTools.map((t) => t.name);
    const allSelected = names.every((n) => tempValue.includes(n));
    
    if (allSelected) {
      setTempValue((prev) => prev.filter((n) => !names.includes(n)));
    } else {
      // 批量添加，只添加已授权的
      const allowedNames = names.filter((name) => {
        const tool = providerTools.find((t) => t.name === name);
        if (!tool) return true;
        const provider = providers.find((p) => p.id === tool.provider_id);
        const isUnauthorized = provider?.credentials_schema && !provider.is_available;
        return !isUnauthorized;
      });

      const unauthorizedCount = names.length - allowedNames.length;
      if (unauthorizedCount > 0) {
        notifications.show({
          title: t('assistant.form.batchToolUnauthorizedTitle'),
          message: t('assistant.form.batchToolUnauthorizedMsg'),
          color: 'orange',
          autoClose: 5000,
        });
      }

      setTempValue((prev) => [
        ...prev,
        ...allowedNames.filter((n) => !prev.includes(n)),
      ]);
    }
  };

  const handleConfirm = () => { onChange(tempValue); close(); };
  const handleCancel = () => { setTempValue(value); close(); };

  return (
    <>
      {/* Popover 本体 */}
      <Popover
        opened={opened}
        onClose={handleCancel}
        width={320}
        position={position}
        withArrow
        shadow="md"
        closeOnClickOutside
        withinPortal
        middlewares={{ flip: true, shift: true }}
        styles={{
          dropdown: {
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-dim)',
            borderRadius: 12,
            padding: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 9999,
            maxHeight: 'min(460px, 70vh)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* 将触发按钮直接作为 Target，确保定位精确。禁用时通过 display: none 隐藏，保持 ref 稳定 */}
        <Popover.Target>
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconPlus size={14} />}
            onClick={open}
            styles={{
              root: {
                padding: '0 8px',
                height: 28,
                fontSize: 12,
                display: disabled ? 'none' : 'inline-flex',
              },
            }}
          >
            {t('workflow.properties.agent.addTools')}
          </Button>
        </Popover.Target>

        <Popover.Dropdown
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <Stack gap="sm" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 顶部标题 */}
            <Group justify="space-between" align="center">
              <Text fw={700} size="sm" style={{ color: 'var(--flock-text-bright)' }}>
                {t('assistant.form.selectTools')}
              </Text>
              <IconX
                size={16}
                style={{ cursor: 'pointer', color: 'var(--flock-text-dim)' }}
                onClick={handleCancel}
              />
            </Group>

            {/* 搜索框 */}
            <TextInput
              placeholder={t('assistant.form.searchTools')}
              leftSection={<IconSearch size={14} style={{ color: 'var(--flock-text-dim)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.currentTarget.value)}
              rightSection={
                searchText ? (
                  <IconX
                    size={14}
                    style={{ cursor: 'pointer', color: 'var(--flock-text-dim)' }}
                    onClick={() => setSearchText('')}
                  />
                ) : null
              }
              styles={{
                input: { background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)', height: 32, fontSize: 12 },
              }}
            />

            {/* 工具列表：使用更稳健的原生 overflow-y auto，防止 flexbox 溢出挤压底栏 */}
            <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
              {loading ? (
                <Text size="xs" c="dimmed" ta="center" py="xl">{t('common.loading')}</Text>
              ) : filteredProviders.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="xl">
                  {searchText ? t('assistant.form.noMatchingTools') : t('assistant.form.noAvailableTools')}
                </Text>
              ) : (
                <Accordion
                  multiple
                  defaultValue={[]}
                  styles={{
                    item: { border: 'none', background: 'var(--flock-bg-surface)', marginBottom: 8, borderRadius: 8, overflow: 'hidden' },
                    control: { padding: '8px 12px' },
                    content: { padding: '0 12px 8px 12px' },
                  }}
                >
                  {filteredProviders.map((provider) => {
                    const selectedCount = getSelectedCount(provider.id);
                    const totalCount = provider.tools.length;
                    const allSelected = selectedCount === totalCount;

                    return (
                      <Accordion.Item
                        key={provider.id}
                        value={provider.id}
                        onMouseEnter={() => setHoveredProviderId(provider.id)}
                        onMouseLeave={() => setHoveredProviderId(null)}
                      >
                        <Accordion.Control>
                          <Group justify="space-between" style={{ width: '100%' }}>
                            <Group gap="xs">
                              <ToolsIcon name={provider.icon || provider.id} size={16} />
                              <Text fw={600} size="xs" style={{ color: 'var(--flock-text-bright)' }}>
                                {getProviderName(provider)}
                              </Text>
                            </Group>
                            <Box style={{ minWidth: 72, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {hoveredProviderId === provider.id && totalCount > 0 ? (
                                <Button
                                  size="xs" variant="subtle"
                                  onClick={(e) => handleBatchToggle(provider.tools, e)}
                                  styles={{ root: { height: 22, padding: '0 6px', fontSize: 10, color: 'var(--flock-accent)' } }}
                                >
                                  {allSelected ? t('assistant.form.removeAllTools') : t('assistant.form.addAllTools')}
                                </Button>
                              ) : (
                                <Text size="11px" style={{ color: 'var(--flock-text-dim)', fontFamily: 'var(--mantine-font-family-monospace)' }}>
                                  {selectedCount} / {totalCount}
                                </Text>
                              )}
                            </Box>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap={4}>
                            {provider.tools.map((tool) => {
                              const isSelected = tempValue.includes(tool.name);
                              const isUnauthorized = provider.credentials_schema && !provider.is_available;
                              return (
                                <Box
                                  key={tool.id}
                                  onClick={() => handleToggleTool(tool.name)}
                                  style={{
                                    display: 'flex', alignItems: 'center', padding: '6px 8px',
                                    borderRadius: 6,
                                    background: isSelected ? 'var(--flock-bg-hover)' : 'transparent',
                                    cursor: isUnauthorized ? 'not-allowed' : 'pointer',
                                    opacity: isUnauthorized ? 0.55 : 1,
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => { if (!isUnauthorized && !isSelected) e.currentTarget.style.background = 'var(--flock-bg-hover)'; }}
                                  onMouseLeave={(e) => { if (!isUnauthorized && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <Group justify="space-between" align="center" style={{ width: '100%' }}>
                                    <Group gap={6} align="center">
                                      <Text
                                        size="xs" fw={isSelected ? 600 : 400}
                                        style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-bright)', lineHeight: 1.3 }}
                                      >
                                        {tool.name}
                                      </Text>
                                      {isUnauthorized && (
                                        <Text size="9px" fw={600} style={{ color: 'var(--mantine-color-red-6)' }}>
                                          🔒 {t('assistant.form.unauthorizedTag')}
                                        </Text>
                                      )}
                                    </Group>
                                    {isSelected && (
                                      <Text size="10px" style={{ color: 'var(--flock-text-dim)', fontWeight: 500 }}>
                                        {t('assistant.form.addedTag')}
                                      </Text>
                                    )}
                                  </Group>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </Box>

            {/* 底栏 */}
            <Group
              justify="flex-end" pt="xs" gap="xs"
              style={{ borderTop: '1px solid var(--flock-border-subtle)', flexShrink: 0 }}
            >
              <Button variant="subtle" size="xs" onClick={handleCancel} style={{ height: 28, fontSize: 11 }}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="filled" color="blue" size="xs" onClick={handleConfirm}
                style={{ background: 'var(--flock-accent)', height: 28, fontSize: 11 }}
              >
                {t('common.confirm')}
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
