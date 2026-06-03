import React, { useMemo, useCallback } from 'react';
import {
  Select,
  Text,
  Stack,
  Group,
  Badge,
  Box,
  Tooltip,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { VariableTextInput } from '@/pages/Workflow/components/VariableInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';

export interface PluginNodePropertiesProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PluginNodeProperties({ node, onDataChange }: PluginNodePropertiesProps) {
  const { t } = useTranslation();
  const { tools, groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

  // 获取当前选中的工具 name (唯一标识符)
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

  // 当切换所选工具时 (在未绑定工具时显示)
  const handleToolChange = useCallback(
    (toolName: string | null) => {
      if (!toolName) {
        onDataChange(node.id, 'tool', null);
        onDataChange(node.id, 'args', '');
        return;
      }

      const toolObj = tools.find((t) => t.name === toolName);
      onDataChange(node.id, 'tool', { name: toolName });
      
      // 动态将画布上节点的展示标题同步重命名为该工具的名称！让 Tool 2 瞬间蜕变为具体工具名
      const displayLabel = toolObj ? toolObj.name : toolName;
      onDataChange(node.id, 'label', displayLabel);

      // 根据工具的 schema properties 生成初始 of 默认 args
      const defaultArgs: Record<string, string> = {};
      try {
        if (toolObj?.input_schema) {
          const parsed = JSON.parse(toolObj.input_schema);
          const props = parsed.properties || {};
          Object.keys(props).forEach((key) => {
            defaultArgs[key] = '';
          });
        }
      } catch (err) {
        console.warn('Failed to parse input schema for tool:', err);
      }

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
      {/* 仅在节点尚未绑定任何工具时展示“Select Tool”下拉框。 */}
      {!selectedToolName && (
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
      )}

      {selectedTool && (
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
              {t('workflow.properties.plugin.inputVariables', 'INPUT VARIABLES')}
            </Text>
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
                  <Stack gap={2} mb={4}>
                    <Group gap={6} align="center" style={{ display: 'inline-flex' }}>
                      <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', textTransform: 'lowercase' }}>
                        {key}
                      </Text>
                      {isRequired && (
                        <Text component="span" c="red" size="xs" style={{ fontWeight: 700 }}>
                          *
                        </Text>
                      )}
                      <Badge
                        size="xs"
                        color="gray"
                        variant="light"
                        style={{
                          fontSize: 9,
                          textTransform: 'capitalize',
                          borderRadius: 4,
                          height: 14,
                        }}
                      >
                        {details.type || 'string'}
                      </Badge>
                    </Group>
                    {details.description && (
                      <Tooltip label={details.description} position="top-start" multiline w={260} withArrow openDelay={200}>
                        <Text
                          size="11px"
                          c="dimmed"
                          style={{
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'help'
                          }}
                        >
                          {details.description}
                        </Text>
                      </Tooltip>
                    )}
                  </Stack>

                  {/* 输入行：横向铺满 */}
                  <Box style={{ width: '100%' }}>
                    <VariableTextInput
                      currentNodeId={node.id}
                      value={paramValue}
                      onChange={(val) => handleParamValueChange(key, val)}
                      placeholder={t('workflow.properties.plugin.paramPlaceholder', 'Type or press / to insert variable')}
                    />
                  </Box>
                </Box>
              );
            })
          )}
        </Stack>
      )}

      {!selectedTool && (
        <Text size="xs" c="dimmed" ta="center" py="xl" style={{ border: '1px dashed var(--flock-border-dim)', borderRadius: 8 }}>
          {t('workflow.properties.plugin.pleaseSelectTool', 'Please select a tool above first')}
        </Text>
      )}
    </Stack>
  );
}
