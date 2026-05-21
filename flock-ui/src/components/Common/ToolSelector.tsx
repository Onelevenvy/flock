import { useState, useMemo } from 'react';
import {
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Modal,
  TextInput,
  ScrollArea,
  Accordion,
  Checkbox,
  Box,
  SimpleGrid,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAvailableTools } from '../../hooks/useAvailableTools';
import { ProviderIcon } from './Icons/DynamicIcon';
import { IconSearch, IconX, IconPlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export interface ToolSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function ToolSelector({
  value = [],
  onChange,
  label,
  placeholder,
  disabled = false,
}: ToolSelectorProps) {
  const { t } = useTranslation('assistant');
  const [opened, { open, close }] = useDisclosure(false);
  const [searchText, setSearchText] = useState('');
  const { providers, tools, loading } = useAvailableTools();

  // 1. 过滤及搜索
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

  // 2. 某个服务商下已选择的工具数量
  const getSelectedCount = (providerId: string) => {
    const provTools = tools.filter((t) => t.provider_id === providerId);
    return provTools.filter((tool) => value.includes(tool.name)).length;
  };

  // 3. 处理添加/删除单个工具
  const handleToggleTool = (toolName: string) => {
    if (disabled) return;
    if (value.includes(toolName)) {
      onChange(value.filter((n) => n !== toolName));
    } else {
      onChange([...value, toolName]);
    }
  };

  // 4. 处理全选/反选服务商下所有工具
  const handleBatchToggle = (providerTools: typeof tools, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    const toolNames = providerTools.map((t) => t.name);
    const selectedInProv = toolNames.filter((name) => value.includes(name));
    const allSelected = selectedInProv.length === toolNames.length;

    if (allSelected) {
      // 取消选择该服务商下所有已选工具
      onChange(value.filter((name) => !toolNames.includes(name)));
    } else {
      // 选择该服务商下所有未选工具
      const toAdd = toolNames.filter((name) => !value.includes(name));
      onChange([...value, ...toAdd]);
    }
  };

  const handleRemoveTool = (toolName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(value.filter((n) => n !== toolName));
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

      {/* 触发容器：已选工具 Badges 的展示区域 */}
      <Box
        onClick={!disabled ? open : undefined}
        style={{
          minHeight: 46,
          background: 'var(--flock-bg-surface)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 8,
          padding: '8px 12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.2s ease',
        }}
      >
        {selectedToolObjects.length === 0 ? (
          <Text size="xs" c="dimmed" py={4}>
            {placeholder || t('form.toolsPlaceholder')}
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

      {/* 选择/编辑按钮 */}
      {!disabled && (
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
            {t('form.selectTools')}
          </Button>
        </Group>
      )}

      {/* 统一工具选择 Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={t('form.selectTools')}
        size="lg"
        styles={{
          content: {
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-dim)',
            borderRadius: 16,
          },
          header: {
            background: 'var(--flock-bg-raised)',
            borderBottom: '1px solid var(--flock-border-subtle)',
          },
        }}
      >
        <Stack gap="md" py="xs">
          {/* 搜索框 */}
          <TextInput
            placeholder={t('form.searchTools')}
            leftSection={<IconSearch size={16} />}
            value={searchText}
            onChange={(e) => setSearchText(e.currentTarget.value)}
            rightSection={
              searchText ? (
                <IconX
                  size={16}
                  style={{ cursor: 'pointer', color: 'var(--flock-text-dim)' }}
                  onClick={() => setSearchText('')}
                />
              ) : null
            }
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />

          {/* 滚动工具列表 */}
          <ScrollArea mah="50vh" offsetScrollbars>
            {loading ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                加载中...
              </Text>
            ) : filteredProviders.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                {searchText ? t('form.noMatchingTools') : t('form.noAvailableTools')}
              </Text>
            ) : (
              <Accordion
                multiple
                defaultValue={providers.map((p) => p.id)}
                styles={{
                  item: {
                    border: 'none',
                    background: 'var(--flock-bg-surface)',
                    marginBottom: 10,
                    borderRadius: 8,
                    overflow: 'hidden',
                  },
                  control: {
                    padding: '10px 16px',
                  },
                }}
              >
                {filteredProviders.map((provider) => {
                  const selectedCount = getSelectedCount(provider.id);
                  const totalCount = provider.tools.length;
                  const allSelected = selectedCount === totalCount;

                  return (
                    <Accordion.Item key={provider.id} value={provider.id}>
                      <Accordion.Control>
                        <Group justify="space-between" style={{ width: '100%' }}>
                          <Group gap="xs">
                            <ProviderIcon name={provider.icon || provider.provider_name} size={18} />
                            <Text fw={600} size="sm">
                              {provider.provider_name}
                            </Text>
                            {selectedCount > 0 && (
                              <Badge size="xs" variant="light" color="blue">
                                {t('form.addedCount', { count: selectedCount })}
                              </Badge>
                            )}
                          </Group>
                          {totalCount > 0 && (
                            <Button
                              size="xs"
                              variant="subtle"
                              onClick={(e) => handleBatchToggle(provider.tools, e)}
                              styles={{
                                root: {
                                  height: 24,
                                  padding: '0 6px',
                                  fontSize: 11,
                                },
                              }}
                            >
                              {allSelected ? t('form.removeAllTools') : t('form.addAllTools')}
                            </Button>
                          )}
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Box p="xs" pt={0}>
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing="xs">
                            {provider.tools.map((tool) => {
                              const isSelected = value.includes(tool.name);
                              return (
                                <Box
                                  key={tool.id}
                                  onClick={() => handleToggleTool(tool.name)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    border: isSelected
                                      ? '1.5px solid var(--flock-accent)'
                                      : '1px solid var(--flock-border-dim)',
                                    background: isSelected
                                      ? 'var(--flock-bg-hover)'
                                      : 'var(--flock-bg-surface)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected
                                      ? '0 2px 8px rgba(21, 90, 239, 0.08)'
                                      : undefined,
                                  }}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => {}} // 阻止默认点击，统一由外层 Box 触发
                                    onClick={(e) => e.stopPropagation()}
                                    styles={{
                                      input: { cursor: 'pointer' },
                                    }}
                                  />
                                  <Stack gap={2} style={{ flex: 1 }}>
                                    <Text
                                      size="sm"
                                      fw={600}
                                      style={{
                                        fontFamily: 'var(--mantine-font-family-monospace)',
                                        color: isSelected ? 'var(--flock-accent)' : 'inherit',
                                      }}
                                    >
                                      {tool.name}
                                    </Text>
                                    {tool.description && (
                                      <Text size="xs" c="dimmed" lineClamp={2}>
                                        {tool.description}
                                      </Text>
                                    )}
                                  </Stack>
                                </Box>
                              );
                            })}
                          </SimpleGrid>
                        </Box>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </ScrollArea>

          {/* 确认底栏 */}
          <Group justify="flex-end" pt="sm">
            <Button variant="filled" color="blue" onClick={close} style={{ background: 'var(--flock-accent)' }}>
              {t('form.confirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
