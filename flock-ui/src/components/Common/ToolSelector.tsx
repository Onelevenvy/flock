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
  PopoverProps,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAvailableTools } from '../../hooks/useAvailableTools';
import { ToolsIcon } from './Icons';
import { IconSearch, IconX, IconPlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export interface ToolSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  position?: PopoverProps['position'];
  /** 只显示触发按鈕，不显示 Badge 区域（供 ToolList 内嵌使用） */
  triggerOnly?: boolean;
}

export default function ToolSelector({
  value = [],
  onChange,
  label,
  placeholder,
  disabled = false,
  position = 'bottom-start',
  triggerOnly = false,
}: ToolSelectorProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchText, setSearchText] = useState('');
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const { providers, tools, loading } = useAvailableTools();

  // 1. 局部临时状态，用来隔离直接更改 onChange。点 Confirm 才会生效，点 Cancel/空白则会回滚撤销。
  const [tempValue, setTempValue] = useState<string[]>(value);

  // 每次打开 Popover 时，同步最新的 value 到局部 tempValue 状态中
  useEffect(() => {
    if (opened) {
      setTempValue(value);
    }
  }, [opened, value]);

  // 2. 过滤及搜索
  const filteredProviders = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return providers
      .map((prov) => {
        const provTools = tools.filter((t) => t.provider_id === prov.id);
        const matchedTools = provTools.filter((tool) => {
          if (!query) return true;
          return (
            tool.name.toLowerCase().includes(query) ||
            prov.provider_name.toLowerCase().includes(query)
          );
        });
        return {
          ...prov,
          tools: matchedTools,
          totalCount: provTools.length,
        };
      })
      .filter((prov) => prov.tools.length > 0);
  }, [providers, tools, searchText]);

  // 3. 某个服务商下已选择的工具数量（基于 tempValue 计算）
  const getSelectedCount = (providerId: string) => {
    const provTools = tools.filter((t) => t.provider_id === providerId);
    return provTools.filter((tool) => tempValue.includes(tool.name)).length;
  };

  // 4. 处理添加/删除单个工具（仅修改局部临时状态）
  const handleToggleTool = (toolName: string) => {
    if (disabled) return;
    if (tempValue.includes(toolName)) {
      setTempValue(tempValue.filter((n) => n !== toolName));
    } else {
      setTempValue([...tempValue, toolName]);
    }
  };

  // 5. 处理全选/反选服务商下所有工具（仅修改局部临时状态）
  const handleBatchToggle = (providerTools: typeof tools, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    const toolNames = providerTools.map((t) => t.name);
    const selectedInProv = toolNames.filter((name) => tempValue.includes(name));
    const allSelected = selectedInProv.length === toolNames.length;

    if (allSelected) {
      // 取消选择该服务商下所有已选工具
      setTempValue(tempValue.filter((name) => !toolNames.includes(name)));
    } else {
      // 选择该服务商下所有未选工具
      const toAdd = toolNames.filter((name) => !tempValue.includes(name));
      setTempValue([...tempValue, ...toAdd]);
    }
  };

  // 主界面 Pills 上的 x 移除事件直接生效
  const handleRemoveTool = (toolName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(value.filter((n) => n !== toolName));
  };

  const handleConfirm = () => {
    onChange(tempValue);
    close();
  };

  const handleCancel = () => {
    setTempValue(value); // 显式将临时状态回滚为真实的外部 value，避免影响后续操作
    close();
  };

  // 根据 value 映射出完整的 Tool 对象，用于主界面 Pills 渲染
  const selectedToolObjects = useMemo(() => {
    return value
      .map((name) => tools.find((t) => t.name === name))
      .filter((t): t is typeof tools[0] => !!t);
  }, [value, tools]);

  return (
    <Stack gap={4}>
      {label && (
        <Text size="sm" fw={500} style={{ color: 'var(--flock-text-secondary)' }}>
          {label}
        </Text>
      )}

      {/* Popover 悬浮面板：加入 withinPortal 确保定位在安全区域内 */}
      <Popover
        opened={opened}
        onClose={handleCancel}
        width={320}
        position={position} // 默认为 bottom-start，支持外部传入自定义 position，防止左侧偏出屏幕
        withArrow
        shadow="md"
        closeOnClickOutside={true}
        withinPortal={true} // 完美避免任何 overflow: hidden 裁剪与定位失效
        middlewares={{ flip: true, shift: true, inline: false }} // 自动翻转+位移，防止超出视口
        styles={{
          dropdown: {
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-dim)',
            borderRadius: 12,
            padding: 14,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 9999,
            maxHeight: 'min(560px, 80vh)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <Popover.Target>
          {/* triggerOnly 模式下用隐藏 span 占位，实际触发由外部 Button 控制 */}
          {triggerOnly ? (
            <span style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
          ) : (
            /* 触发容器：已选工具 Badges 的展示区域 */
            <Box
              onClick={!disabled ? (opened ? close : open) : undefined}
              style={{
                minHeight: 46,
                background: 'var(--flock-bg-surface)',
                border: opened ? '1px solid var(--flock-accent)' : '1px solid var(--flock-border-dim)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.2s ease',
              }}
            >
              {selectedToolObjects.length === 0 ? (
                <Text size="xs" c="dimmed" py={4}>
                  {placeholder || t('assistant.form.toolsPlaceholder')}
                </Text>
              ) : (
                <Group gap={6}>
                  {selectedToolObjects.map((tool) => (
                    <Badge
                      key={tool.id}
                      variant="light"
                      color="blue"
                      size="sm"
                      styles={{
                        root: {
                          background: 'var(--flock-bg-hover)',
                          border: '1px solid var(--flock-border-dim)',
                          color: 'var(--flock-text-bright)',
                          textTransform: 'none',
                          fontFamily: 'var(--mantine-font-family-monospace)',
                          paddingRight: !disabled ? 4 : undefined,
                        },
                      }}
                      rightSection={
                        !disabled && (
                          <IconX
                            size={12}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => handleRemoveTool(tool.name, e)}
                          />
                        )
                      }
                    >
                      {tool.name}
                    </Badge>
                  ))}
                </Group>
              )}
            </Box>
          )}
        </Popover.Target>

        <Popover.Dropdown onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Stack gap="sm" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 顶栏标题及搜索框 */}
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
                input: {
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  height: 32,
                  fontSize: 12,
                },
              }}
            />

            {/* 滚动工具列表：高度自适应视口，避免超出屏幕 */}
            <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
              {loading ? (
                <Text size="xs" c="dimmed" ta="center" py="xl">
                  {t('common.loading', { defaultValue: 'Loading...' })}
                </Text>
              ) : filteredProviders.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="xl">
                  {searchText ? t('assistant.form.noMatchingTools') : t('assistant.form.noAvailableTools')}
                </Text>
              ) : (
                <Accordion
                  multiple
                  defaultValue={[]}
                  styles={{
                    item: {
                      border: 'none',
                      background: 'var(--flock-bg-surface)',
                      marginBottom: 8,
                      borderRadius: 8,
                      overflow: 'hidden',
                    },
                    control: {
                      padding: '8px 12px',
                    },
                    content: {
                      padding: '0 12px 8px 12px',
                    },
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
                              {/* 修正为 ToolsIcon 完美在界面加载 provider 图标 */}
                              <ToolsIcon name={provider.id} size={16} />
                              <Text fw={600} size="xs" style={{ color: 'var(--flock-text-bright)' }}>
                                {provider.provider_name}
                              </Text>
                            </Group>
                            {/* 悬停显示全选/取消全选，平时显示精简的 n/m 状态 */}
                            <Box style={{ minWidth: 72, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {hoveredProviderId === provider.id && totalCount > 0 ? (
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={(e) => handleBatchToggle(provider.tools, e)}
                                  styles={{
                                    root: {
                                      height: 22,
                                      padding: '0 6px',
                                      fontSize: 10,
                                      color: 'var(--flock-accent)',
                                    },
                                  }}
                                >
                                  {allSelected ? t('assistant.form.removeAllTools') : t('assistant.form.addAllTools')}
                                </Button>
                              ) : (
                                <Text
                                  size="11px"
                                  style={{
                                    color: 'var(--flock-text-dim)',
                                    fontFamily: 'var(--mantine-font-family-monospace)',
                                  }}
                                >
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
                              return (
                                <Box
                                  key={tool.id}
                                  onClick={() => handleToggleTool(tool.name)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    background: isSelected
                                      ? 'var(--flock-bg-hover)'
                                      : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = 'var(--flock-bg-hover)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  <Group justify="space-between" align="center" style={{ width: '100%' }}>
                                    <Text
                                      size="xs"
                                      fw={isSelected ? 600 : 400}
                                      style={{
                                        fontFamily: 'var(--mantine-font-family-monospace)',
                                        color: 'var(--flock-text-bright)',
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {tool.name}
                                    </Text>
                                    {isSelected && (
                                      <Text
                                        size="10px"
                                        style={{
                                          color: 'var(--flock-text-dim)',
                                          fontWeight: 500,
                                        }}
                                      >
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
            </ScrollArea>

            {/* 确认/取消底栏 */}
            <Group justify="flex-end" pt="xs" gap="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
              <Button
                variant="subtle"
                size="xs"
                onClick={handleCancel}
                style={{ height: 28, fontSize: 11 }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="filled"
                color="blue"
                size="xs"
                onClick={handleConfirm}
                style={{ background: 'var(--flock-accent)', height: 28, fontSize: 11 }}
              >
                {t('assistant.form.confirm')}
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {/* 选择/编辑按钮 */}
      {!disabled && triggerOnly && (
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
            },
          }}
        >
          {t('assistant.form.selectTools')}
        </Button>
      )}
      {!disabled && !triggerOnly && (
        <Group>
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
              },
            }}
          >
            {t('assistant.form.selectTools')}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
