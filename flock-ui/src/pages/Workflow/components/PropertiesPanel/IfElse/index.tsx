import React, { useCallback } from 'react';
import { Box, Group, Badge, ActionIcon, Button, Stack, Select, Text, SegmentedControl, Divider } from '@mantine/core';
import { IconTrash, IconPlus, IconSettings } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { VariableTextInput } from '../VariableInput';

export interface IfElseFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function IfElseFields({ node, onDataChange }: IfElseFieldsProps) {
  const { t } = useTranslation();
  const cases = (node.data.cases as { case_id: string; logical_operator: string; conditions: any[] }[]) ?? [];

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
    conditions[condIndex] = {
      ...conditions[condIndex],
      [key]: val,
    };
    next[caseIndex] = {
      ...targetCase,
      conditions,
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  // 切换 AND/OR 关系
  const handleToggleLogicalOperator = useCallback((caseIndex: number, value: string) => {
    const next = [...cases];
    next[caseIndex] = {
      ...next[caseIndex],
      logical_operator: value,
    };
    onDataChange(node.id, 'cases', next);
  }, [node.id, cases, onDataChange]);

  const operatorOptions = [
    { value: 'equals', label: t('workflow.properties.ifelse.ops.equals', 'equals (==)') },
    { value: 'not_equals', label: t('workflow.properties.ifelse.ops.notEquals', 'not equals (!=)') },
    { value: 'contains', label: t('workflow.properties.ifelse.ops.contains', 'contains') },
    { value: 'not_contains', label: t('workflow.properties.ifelse.ops.notContains', 'not contains') },
    { value: 'empty', label: t('workflow.properties.ifelse.ops.empty', 'is empty') },
    { value: 'not_empty', label: t('workflow.properties.ifelse.ops.notEmpty', 'is not empty') },
  ];

  return (
    <Stack gap="md" style={{ width: '100%' }}>
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
                position: 'relative',
              }}
            >
              <Group justify="space-between" mb="xs">
                <Badge size="xs" color="orange" variant="light" fw={700}>
                  ELSE
                </Badge>
                <Text size="11px" c="dimmed">
                  {t('workflow.properties.ifelse.elseDesc', 'Default case when no conditions match')}
                </Text>
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
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              padding: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              position: 'relative',
            }}
          >
            {/* 分支标题头部 */}
            <Group justify="space-between" mb="sm" align="center">
              <Badge size="xs" color={caseIdx === 0 ? 'blue' : 'violet'} variant="filled" fw={700}>
                {caseIdx === 0 ? 'IF' : `ELIF CASE ${caseIdx + 1}`}
              </Badge>
              
              <Group gap="xs">
                {hasMultipleConds && (
                  <SegmentedControl
                    size="xs"
                    value={c.logical_operator || 'and'}
                    onChange={(v) => handleToggleLogicalOperator(caseIdx, v)}
                    data={[
                      { label: 'AND', value: 'and' },
                      { label: 'OR', value: 'or' },
                    ]}
                    styles={{
                      root: { padding: 2, background: 'var(--flock-bg-deepest)' },
                      indicator: { background: 'var(--flock-bg-base)' },
                      control: { minWidth: 42 }
                    }}
                  />
                )}
                {caseIdx > 0 && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={12} />}
                    styles={{ root: { height: 24, padding: '0 8px' } }}
                    onClick={() => handleRemoveCase(caseIdx)}
                  >
                    {t('workflow.properties.ifelse.removeCase', 'Remove')}
                  </Button>
                )}
              </Group>
            </Group>

            {/* 条件行编辑器 */}
            <Stack gap="sm" style={{ position: 'relative' }}>
              {/* 如果有多条件，渲染左侧连接线 */}
              {hasMultipleConds && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '20px',
                    bottom: '20px',
                    width: '2px',
                    background: 'var(--flock-accent)',
                    opacity: 0.4,
                    borderRadius: '2px',
                  }}
                />
              )}

              {(!c.conditions || c.conditions.length === 0) ? (
                <Text size="xs" c="dimmed" ta="center" py="xs" style={{ border: '1px dashed var(--flock-border-dim)', borderRadius: 8 }}>
                  {t('workflow.properties.ifelse.noConditions', 'No conditions added yet')}
                </Text>
              ) : (
                c.conditions.map((cond, condIdx) => {
                  const showValueField = cond.operator !== 'empty' && cond.operator !== 'not_empty';

                  return (
                    <Box
                      key={cond.id}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'var(--flock-bg-base)',
                        border: '1px solid var(--flock-border-subtle)',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                      }}
                    >
                      {/* 变量选择（左侧） */}
                      <Group gap="xs" mb="xs" wrap="nowrap" align="center">
                        <Box style={{ flex: 1 }}>
                          <VariableTextInput
                            currentNodeId={node.id}
                            value={cond.variable || ''}
                            placeholder={t('workflow.properties.ifelse.varPlaceholder', 'Choose variable')}
                            onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'variable', v)}
                          />
                        </Box>
                        
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => handleRemoveCondition(caseIdx, condIdx)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>

                      {/* 运算符 & 值字段 */}
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          data={operatorOptions}
                          value={cond.operator || 'equals'}
                          onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'operator', v)}
                          styles={{
                            input: { background: 'var(--flock-bg-surface)' }
                          }}
                        />

                        {showValueField && (
                          <VariableTextInput
                            currentNodeId={node.id}
                            value={cond.value || ''}
                            placeholder={t('workflow.properties.ifelse.valuePlaceholder', 'Enter value')}
                            onChange={(v) => handleUpdateCondition(caseIdx, condIdx, 'value', v)}
                          />
                        )}
                      </Stack>
                    </Box>
                  );
                })
              )}
            </Stack>

            {/* 分支底部添加条件按钮 */}
            <Group justify="flex-start" mt="sm">
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconPlus size={12} />}
                onClick={() => handleAddCondition(caseIdx)}
              >
                {t('workflow.properties.ifelse.addCondition', 'Add Condition')}
              </Button>
            </Group>
          </Box>
        );
      })}

      <Divider />

      {/* 添加 ELIF */}
      <Button
        size="sm"
        variant="outline"
        color="blue"
        leftSection={<IconPlus size={14} />}
        fullWidth
        styles={{
          root: {
            borderStyle: 'dashed',
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
