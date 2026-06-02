import React, { useMemo, useCallback, useState } from 'react';
import {
  Select,
  Text,
  Stack,
  Group,
  Switch,
  Divider,
  Badge,
  Box,
  ActionIcon,
  Button,
} from '@mantine/core';
import { IconPuzzle, IconCode, IconList, IconSettings, IconKey, IconEdit } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextInput, VariableTextarea } from '../VariableInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';

export interface PluginFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PluginFields({ node, onDataChange }: PluginFieldsProps) {
  const { t } = useTranslation();
  const { tools, providers, groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

  // 是否处于高级 JSON 模式
  const [isAdvancedJson, setIsAdvancedJson] = useState<boolean>(() => {
    if (!node.data.args) return false;
    try {
      JSON.parse(node.data.args);
      return false;
    } catch {
      return true;
    }
  });

  // 获取当前选中的工具 name
  const selectedToolName = node.data.tool?.name || null;

  // 根据 selectedToolName 获取完整的 Tool 对象
  const selectedTool = useMemo(() => {
    if (!selectedToolName) return null;
    return tools.find((t) => t.name === selectedToolName) || null;
  }, [selectedToolName, tools]);

  // 获取该 Tool 所属的 Provider
  const selectedProvider = useMemo(() => {
    if (!selectedTool) return null;
    return providers.find((p) => p.id === selectedTool.provider_id) || null;
  }, [selectedTool, providers]);

  // 判断是否需要凭证授权鉴权 (即 provider 有 credentials_schema)
  const isAuthRequired = useMemo(() => {
    if (!selectedProvider) return false;
    const schemaStr = selectedProvider.credentials_schema;
    if (!schemaStr) return false;
    try {
      const schema = JSON.parse(schemaStr);
      return schema && Object.keys(schema.properties || {}).length > 0;
    } catch {
      return false;
    }
  }, [selectedProvider]);

  // 解析当前已选工具的 input_schema (JSON Schema)
  const toolProperties = useMemo(() => {
    if (!selectedTool?.input_schema) return null;
    try {
      const parsed = JSON.parse(selectedTool.input_schema);
      return parsed.properties || null;
    } catch {
      return null;
    }
  }, [selectedTool]);

  const toolRequiredList = useMemo(() => {
    if (!selectedTool?.input_schema) return [];
    try {
      const parsed = JSON.parse(selectedTool.input_schema);
      return Array.isArray(parsed.required) ? parsed.required : [];
    } catch {
      return [];
    }
  }, [selectedTool]);

  // 将 args 字符串解析为 key-value 映射对象 (给普通表单使用)
  const argValues = useMemo(() => {
    if (!node.data.args) return {};
    try {
      return JSON.parse(node.data.args);
    } catch {
      return {};
    }
  }, [node.data.args]);

  // 当切换所选工具时
  const handleToolChange = useCallback(
    (toolName: string | null) => {
      if (!toolName) {
        onDataChange(node.id, 'tool', null);
        onDataChange(node.id, 'args', '');
        return;
      }

      const toolObj = tools.find((t) => t.name === toolName);
      onDataChange(node.id, 'tool', { name: toolName });

      // 根据工具的 schema properties 生成初始的默认 args
      let defaultArgs: Record<string, string> = {};
      try {
        if (toolObj?.input_schema) {
          const parsed = JSON.parse(toolObj.input_schema);
          const props = parsed.properties || {};
          Object.keys(props).forEach((key) => {
            defaultArgs[key] = '';
          });
        }
      } catch {}

      onDataChange(node.id, 'args', JSON.stringify(defaultArgs, null, 2));
    },
    [node.id, tools, onDataChange]
  );

  // 当在普通表单模式下修改了特定参数值
  const handleParamValueChange = useCallback(
    (paramName: string, value: string) => {
      const nextArgs = {
        ...argValues,
        [paramName]: value,
      };
      onDataChange(node.id, 'args', JSON.stringify(nextArgs, null, 2));
    },
    [node.id, argValues, onDataChange]
  );

  return (
    <Stack gap="md" style={{ width: '100%' }}>
      {/* 工具选择下拉框 */}
      <Select
        label={t('workflow.properties.plugin.tool', 'Select Tool')}
        placeholder={t('workflow.properties.plugin.toolPlaceholder', 'Choose a system tool to execute')}
        data={toolOptions}
        value={selectedToolName}
        onChange={handleToolChange}
        searchable
        disabled={toolsLoading}
        size="xs"
      />

      {selectedTool && (
        <>
          {/* 只在真正需要鉴权的工具上，才显示 API Key 鉴权设置按钮卡片。无鉴权的工具(如 Math Calculator)直接隐藏，不予展示 */}
          {isAuthRequired && (
            <Button
              size="xs"
              variant="filled"
              fullWidth
              leftSection={<IconKey size={13} />}
              styles={{
                root: {
                  background: 'var(--flock-accent)',
                  height: 32,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(21, 90, 239, 0.15)',
                }
              }}
            >
              {t('workflow.properties.plugin.apiConfig', 'API Key Authorization Configuration')}
            </Button>
          )}

          <Divider my={4} />

          {/* 表单模式与 JSON 模板切换开关 */}
          <Group justify="space-between" align="center">
            <Group gap={6}>
              {isAdvancedJson ? <IconCode size={14} style={{ color: 'var(--flock-accent)' }} /> : <IconList size={14} style={{ color: 'var(--flock-accent)' }} />}
              <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
                {isAdvancedJson
                  ? t('workflow.properties.plugin.advancedJsonMode', 'Advanced JSON Template')
                  : t('workflow.properties.plugin.standardFormMode', 'Standard Form Mode')}
              </Text>
            </Group>
            <Switch
              checked={isAdvancedJson}
              onChange={(e) => setIsAdvancedJson(e.currentTarget.checked)}
              size="sm"
            />
          </Group>

          {/* 表单编辑 / JSON 编辑内容 */}
          {isAdvancedJson ? (
            /* 高级模式：JSON 模板 */
            <VariableTextarea
              label={t('workflow.properties.plugin.argsTemplate', 'JSON ARGS TEMPLATE')}
              placeholder='{\n  "query": "{{start.user_query}}"\n}'
              value={String(node.data.args ?? '')}
              currentNodeId={node.id}
              onChange={(val) => onDataChange(node.id, 'args', val)}
              minRows={6}
              size="xs"
              style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 }}
            />
          ) : (
            /* 标准模式：Dify 像素级视觉表单 */
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                  {t('workflow.properties.plugin.inputVariables', 'INPUT VARIABLES')}
                </Text>
                
                <Group gap={4} align="center">
                  <Text size="10px" c="dimmed">
                    SETTINGS
                  </Text>
                  <IconSettings size={11} style={{ color: 'var(--flock-text-muted)' }} />
                </Group>
              </Group>

              {!toolProperties || Object.keys(toolProperties).length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="xs">
                  {t('workflow.properties.plugin.noParams', 'No inputs required for this tool')}
                </Text>
              ) : (
                Object.entries(toolProperties).map(([key, details]: [string, any]) => {
                  const isRequired = toolRequiredList.includes(key);
                  const paramValue = argValues[key] !== undefined ? String(argValues[key]) : '';

                  return (
                    <Box key={key} style={{ width: '100%' }}>
                      {/* Dify 极智属性 Label 排版 */}
                      <Stack gap={2} mb={4}>
                        <Group gap={4} align="center" style={{ display: 'inline-flex' }}>
                          <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', textTransform: 'lowercase' }}>
                            {key}
                          </Text>
                          {isRequired && (
                            <Text component="span" c="red" size="xs" style={{ fontWeight: 700 }}>
                              *
                            </Text>
                          )}
                        </Group>
                        {details.description && (
                          <Text size="11px" c="dimmed" style={{ lineHeight: 1.2 }}>
                            {details.description}
                          </Text>
                        )}
                      </Stack>

                      {/* 输入行：左侧有 (x)/✎ 编辑胶囊, 右侧带数据类型 Badge */}
                      <Group gap="xs" wrap="nowrap" align="center" style={{ width: '100%' }}>
                        {/* 左侧 Dify 专属输入参数 (x) ✎ 选择图标 */}
                        <ActionIcon size="sm" variant="subtle" color="gray" radius="sm">
                          <Text size="10px" fw={700} style={{ color: 'var(--flock-text-dim)', fontFamily: 'monospace' }}>(x)</Text>
                        </ActionIcon>
                        <ActionIcon size="xs" variant="subtle" color="gray" radius="sm">
                          <IconEdit size={10} />
                        </ActionIcon>

                        <Box style={{ flex: 1, position: 'relative' }}>
                          <VariableTextInput
                            currentNodeId={node.id}
                            value={paramValue}
                            onChange={(val) => handleParamValueChange(key, val)}
                            placeholder={t('workflow.properties.plugin.paramPlaceholder', 'Type or press / to insert variable')}
                          />
                          {/* 右侧数据类型极简 Badge */}
                          <Badge
                            size="xs"
                            color="gray"
                            variant="light"
                            style={{
                              position: 'absolute',
                              right: 32,
                              top: 6,
                              pointerEvents: 'none',
                              fontSize: 9,
                              textTransform: 'capitalize',
                              borderRadius: 4,
                              height: 16,
                            }}
                          >
                            {details.type || 'string'}
                          </Badge>
                        </Box>
                      </Group>
                    </Box>
                  );
                })
              )}
            </Stack>
          )}
        </>
      )}

      {!selectedTool && (
        <Text size="xs" c="dimmed" ta="center" py="xl" style={{ border: '1px dashed var(--flock-border-dim)', borderRadius: 8 }}>
          {t('workflow.properties.plugin.pleaseSelectTool', 'Please select a tool above first')}
        </Text>
      )}
    </Stack>
  );
}
