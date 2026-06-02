import React, { useCallback, useMemo } from 'react';
import { Box, Group, Badge, ActionIcon, Button, Stack, Select, Text, Divider } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { VariableTextInput } from '../VariableInput';
import { useWorkflowStore } from '@/store/workflowStore';
import { getAvailableVariables } from '../helper';

export interface IfElseFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function IfElseFields({ node, onDataChange }: IfElseFieldsProps) {
  const { t } = useTranslation();
  const cases = (node.data.cases as { case_id: string; logical_operator: string; conditions: any[] }[]) ?? [];

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);

  // 获得当前节点能取得的全部上游变量列表（包含类型 varType）
  const variables = useMemo(
    () => getAvailableVariables(node.id, nodes, edges, environmentVariables),
    [node.id, nodes, edges, environmentVariables]
  );

  // 提取条件已选变量的类型
  const getVariableType = useCallback((variableTemplate: string) => {
    if (!variableTemplate) return null;
    const found = variables.find((v) => v.value === variableTemplate);
    return found ? (found.varType as string) : null;
  }, [variables]);

  // 根据所选变量类型，自适应分配 Dify 精准匹配符号组
  const getOperatorOptions = useCallback((varType: string | null) => {
    if (varType === 'number') {
      return [
        { value: 'equals', label: '=' },
        { value: 'not_equals', label: '≠' },
        { value: 'largerThan', label: '>' },
        { value: 'lessThan', label: '<' },
        { value: 'largerThanOrEqual', label: '≥' },
        { value: 'lessThanOrEqual', label: '≤' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    }
    if (varType === 'boolean') {
      return [
        { value: 'equals', label: 'is True' },
        { value: 'not_equals', label: 'is False' },
      ];
    }
    // 默认 String 类型匹配符号
    return [
      { value: 'contains', label: 'contains' },
      { value: 'not_contains', label: 'does not contain' },
      { value: 'startWith', label: 'starts with' },
      { value: 'endWith', label: 'ends with' },
      { value: 'equals', label: 'is' },
      { value: 'not_equals', label: 'is not' },
      { value: 'empty', label: 'is empty' },
      { value: 'not_empty', label: 'is not empty' },
    ];
  }, []);

  // 添加新的 ELIF 条件分支
  const handleAddCase = useCallback(() => {
    const others = cases.filter((c) => c.case_id === 'false_else');
    const rest = cases.filter((c) => c.case_id !== 'false_else');
    onDataChange(node.id, 'cases', [
      ...rest,
      {
        case_id: uuidv4(),
        logical_operator: 'and',
        conditions: [
          {
            id: uuidv4(),
            variable: '',
            operator: 'equals',
            value: '',
          },
        ],
      },
      ...others,
    ]);
  }, [node.id, cases, onDataChange]);

  // 删除指定的 ELIF 条件分支
  const handleRemoveCase = useCallback((index: number) => {
    const next = cases.filter((_, idx) => idx !== index);
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  // 给特定分支添加一条判定条件
  const handleAddCondition = useCallback((caseIndex: number) => {
    const next = [...cases];
    const targetCase = next[caseIndex];
    next[caseIndex] = {
      ...targetCase,
      conditions: [
        ...(targetCase.conditions || []),
        {
          id: uuidv4(),
          variable: '',
          operator: 'equals',
          value: '',
        },
      ],
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  // 删除特定分支的指定判定条件
  const handleRemoveCondition = useCallback((caseIndex: number, condIndex: number) => {
    const next = [...cases];
    const targetCase = next[caseIndex];
    next[caseIndex] = {
      ...targetCase,
      conditions: targetCase.conditions.filter((_, idx) => idx !== condIndex),
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  // 更新判定条件的具体字段值
  const handleUpdateCondition = useCallback((caseIndex: number, condIndex: number, key: string, val: any) => {
    const next = [...cases];
    const targetCase = next[caseIndex];
    const conditions = [...(targetCase.conditions || [])];
    
    // 如果修改了变量类型，我们需要自动重置操作符为该类型支持的首项
    let finalOperator = conditions[condIndex].operator;
    let finalValue = conditions[condIndex].value;

    if (key === 'variable') {
      const varType = getVariableType(val);
      if (varType === 'number' || varType === 'integer') {
        finalOperator = 'equals';
      } else if (varType === 'boolean') {
        finalOperator = 'equals';
        finalValue = 'true'; // 布尔默认对比为 true 且隐藏值表单
      } else {
        finalOperator = 'contains';
      }
    }

    conditions[condIndex] = {
      ...conditions[condIndex],
      [key]: val,
      operator: key === 'variable' ? finalOperator : (key === 'operator' ? val : finalOperator),
      value: key === 'variable' ? finalValue : (key === 'value' ? val : finalValue),
    };

    next[caseIndex] = {
      ...targetCase,
      conditions,
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange, getVariableType]);

  // 切换 AND/OR 关系
  const handleToggleLogicalOperator = useCallback((caseIndex: number, value: string) => {
    const next = [...cases];
    next[caseIndex] = {
      ...next[caseIndex],
      logical_operator: value,
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  return (
    <Stack gap="lg" style={{ width: '100%' }}>
      {cases.map((c, caseIdx) => {
        const isElse = c.case_id === 'false_else';
        const hasMultipleConds = c.conditions && c.conditions.length > 1;

        if (isElse) {
          // ELSE 分支渲染
          return (
            <Box
              key={c.case_id}
              style={{
                borderRadius: '12px',
                background: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
                padding: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
              }}
            >
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Badge size="xs" color="gray" variant="filled" fw={700} style={{ borderRadius: 4 }}>
                    ELSE
                  </Badge>
                  <Text size="11px" c="dimmed">
                    {t('workflow.properties.ifelse.elseDesc', 'Default case when no conditions match')}
                  </Text>
                </Group>
              </Group>
            </Box>
          );
        }

        // IF & ELIF 分支渲染
        return (
          <Box
            key={c.case_id}
            style={{
              borderRadius: '12px',
              background: 'var(--flock-bg-base)',
              border: '1px solid var(--flock-border-dim)',
              padding: '14px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
              position: 'relative',
            }}
          >
            {/* 分支标题头部 */}
            <Group justify="space-between" mb="md" align="center">
              <Group gap="xs">
                <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                  {caseIdx === 0 ? 'IF' : 'ELIF'}
                </Text>
                <Text size="10px" c="dimmed" fw={500}>
                  CASE {caseIdx + 1}
                </Text>
              </Group>

              {caseIdx > 0 && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={12} />}
                  styles={{ root: { height: 24, padding: '0 8px', fontSize: 10 } }}
                  onClick={() => handleRemoveCase(caseIdx)}
                >
                  {t('workflow.properties.ifelse.removeCase', 'Remove')}
                </Button>
              )}
            </Group>

            {/* 条件编辑器区域 */}
            <Box style={{ position: 'relative', paddingLeft: hasMultipleConds ? 24 : 0 }}>
              
              {/* Dify 极智左侧连接导轨线与逻辑小药丸 */}
              {hasMultipleConds && (
                <Box
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: 18,
                      bottom: 18,
                      width: 2,
                      background: 'var(--flock-accent)',
                      opacity: 0.25,
                      borderRadius: 1,
                    }}
                  />
                  <Badge
                    size="xs"
                    onClick={() => handleToggleLogicalOperator(caseIdx, c.logical_operator === 'and' ? 'or' : 'and')}
                    style={{
                      zIndex: 10,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      background: 'var(--flock-bg-base)',
                      border: '1.5px solid var(--flock-accent)',
                      color: 'var(--flock-accent)',
                      boxShadow: '0 2px 8px rgba(21, 90, 239, 0.18)',
                      textTransform: 'uppercase',
                      fontSize: 9,
                      padding: '0 6px',
                      height: 18,
                      fontWeight: 700,
                      borderRadius: 10,
                      userSelect: 'none',
                      transition: 'transform 0.1s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {c.logical_operator || 'and'}
                  </Badge>
                </Box>
              )}

              <Stack gap="sm">
                {(!c.conditions || c.conditions.length === 0) ? (
                  <Text size="xs" c="dimmed" ta="center" py="xs" style={{ border: '1px dashed var(--flock-border-dim)', borderRadius: 8 }}>
                    {t('workflow.properties.ifelse.noConditions', 'No conditions added yet')}
                  </Text>
                ) : (
                  c.conditions.map((cond, condIdx) => {
                    const varType = getVariableType(cond.variable);
                    const ops = getOperatorOptions(varType);
                    
                    // 判断是否需要显示右侧比较值文本框（is empty, is not empty 以及布尔值类型直接隐藏输入框，使交互优雅化）
                    const showValueField = cond.operator !== 'empty' && cond.operator !== 'not_empty' && varType !== 'boolean';

                    return (
                      <Box
                        key={cond.id}
                        style={{
                          borderRadius: '8px',
                          border: '1px solid var(--flock-border-subtle)',
                          background: 'var(--flock-bg-surface)',
                          padding: '10px',
                        }}
                      >
                        {/* 条件行：变量选框、判定下拉、删除 */}
                        <Group gap="xs" wrap="nowrap" align="center" mb={showValueField ? 'xs' : 0}>
                          <Box style={{ flex: 1 }}>
                            <VariableTextInput
                              currentNodeId={node.id}
                              value={cond.variable || ''}
                              placeholder={t('workflow.properties.ifelse.varPlaceholder', 'Select variable')}
                              onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'variable', v)}
                            />
                          </Box>

                          <Select
                            size="xs"
                            data={ops}
                            value={cond.operator || 'equals'}
                            onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'operator', v || 'equals')}
                            style={{ width: 105 }}
                            styles={{
                              input: {
                                background: 'var(--flock-bg-base)',
                                border: '1px solid var(--flock-border-dim)',
                                fontSize: 11,
                                fontWeight: 600,
                              }
                            }}
                          />

                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => handleRemoveCondition(caseIdx, condIdx)}
                          >
                            <IconTrash size={13} />
                          </ActionIcon>
                        </Group>

                        {/* 对比值输入（Enter value） */}
                        {showValueField && (
                          <VariableTextInput
                            currentNodeId={node.id}
                            value={cond.value || ''}
                            placeholder={t('workflow.properties.ifelse.valuePlaceholder', 'Enter value')}
                            onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'value', v)}
                          />
                        )}
                      </Box>
                    );
                  })
                )}
              </Stack>
            </Box>

            {/* 添加判定条件按钮 */}
            <Group justify="flex-start" mt="sm" style={{ paddingLeft: hasMultipleConds ? 24 : 0 }}>
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconPlus size={11} />}
                onClick={() => handleAddCondition(caseIdx)}
                styles={{ root: { height: 26, fontSize: 11 } }}
              >
                {t('workflow.properties.ifelse.addCondition', 'Add Condition')}
              </Button>
            </Group>
          </Box>
        );
      })}

      <Divider />

      {/* 一键新增 ELIF 分支 */}
      <Button
        size="sm"
        variant="outline"
        color="blue"
        leftSection={<IconPlus size={13} />}
        fullWidth
        styles={{
          root: {
            borderStyle: 'dashed',
            height: 36,
            fontSize: 12,
            '&:hover': {
              background: 'var(--flock-bg-hover)',
            }
          }
        }}
        onClick={handleAddCase}
      >
        {t('workflow.properties.ifelse.addElif', 'Add ELIF Case')}
      </Button>
    </Stack>
  );
}
