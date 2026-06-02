import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  Select,
  Text,
  Stack,
  Card,
  Group,
  Switch,
  Divider,
  ThemeIcon,
  Badge,
  Box,
} from '@mantine/core';
import { IconPuzzle, IconCode, IconList } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextInput, VariableTextarea } from '../VariableInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';

export interface PluginFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PluginFields({ node, onDataChange }: PluginFieldsProps) {
  const { t } = useTranslation();
  const { tools, groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

  // 是否处于高级 JSON 模式
  const [isAdvancedJson, setIsAdvancedJson] = useState<boolean>(() => {
    // 如果 node.data.args 无法用 JSON 解析或者原本就是个复杂的文本，可以默认 JSON 模式
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

      {/* 展现已选择的工具详情 */}
      {selectedTool && (
        <Card
          padding="sm"
          radius="md"
          withBorder
          style={{
            background: 'var(--flock-bg-deepest)',
            borderColor: 'var(--flock-border-dim)',
          }}
        >
          <Group gap="xs" mb={4} align="center">
            <ThemeIcon size={20} radius="md" color="blue" variant="light">
              <IconPuzzle size={12} />
            </ThemeIcon>
            <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
              {selectedTool.name}
            </Text>
            <Badge size="xs" color="blue" variant="light" style={{ fontSize: 9 }}>
              {selectedTool.category || 'tool'}
            </Badge>
          </Group>
          {selectedTool.description && (
            <Text size="11px" c="dimmed">
              {selectedTool.description}
            </Text>
          )}
        </Card>
      )}

      {selectedTool && (
        <>
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
              minRows={5}
              size="xs"
              style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 }}
            />
          ) : (
            /* 标准模式：从 schema properties 动态渲染表单 (类似于 Dify) */
            <Stack gap="sm">
              <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }} mb={2}>
                {t('workflow.properties.plugin.inputVariables', 'INPUT VARIABLES')}
              </Text>

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
                      <VariableTextInput
                        currentNodeId={node.id}
                        value={paramValue}
                        onChange={(val) => handleParamValueChange(key, val)}
                        label={
                          <Group gap={4} align="center" style={{ display: 'inline-flex' }}>
                            <Text size="xs" fw={500} style={{ color: 'var(--flock-text-bright)' }}>
                              {key}
                            </Text>
                            {isRequired && (
                              <Text component="span" c="red" size="xs" style={{ fontWeight: 700 }}>
                                *
                              </Text>
                            )}
                            <Badge size="xs" color="gray" variant="outline" style={{ textTransform: 'lowercase', fontSize: 9, transform: 'scale(0.85)' }}>
                              {details.type || 'string'}
                            </Badge>
                          </Group>
                        }
                        placeholder={details.description || t('workflow.properties.plugin.paramPlaceholder', 'Type or press / to insert variable')}
                      />
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
