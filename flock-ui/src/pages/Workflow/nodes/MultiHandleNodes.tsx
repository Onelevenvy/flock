import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';

export const ClassifierNode = memo(({ id, data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['classifier'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  const categories = (data.categories as { category_id: string; category_name: string }[]) ?? [];

  let classIdx = 0;

  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
      style={{ overflow: 'visible' }}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
        }}
      >
        <Box
          className="flock-node-icon-container"
          style={{
            background: `${cfg.colorHex}15`,
          }}
        >
          <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px' }}>
        {categories.map((cat) => {
          const isOthers = cat.category_id === 'others_category';
          const displayIndex = isOthers ? 0 : ++classIdx;
          return (
            <Box key={cat.category_id} style={{ position: 'relative', marginBottom: 6 }}>
              <Box
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
                  border: '1px solid var(--flock-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  marginRight: 6,
                  overflow: 'hidden',
                }}
              >
                <Text size="xs" fw={700} style={{ fontSize: 10, color: 'var(--flock-text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isOthers ? 'OTHERS' : `CLASS ${displayIndex}`}
                </Text>
                {!isOthers && cat.category_name && (
                  <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.category_name}
                  </Text>
                )}
              </Box>
              <div 
                className="flock-handle-container"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: -40,
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 20,
                  zIndex: 10,
                }}
              >
                <Handle
                  type="source"
                  position={Position.Right}
                  id={cat.category_id}
                  style={{
                    background: 'var(--flock-bg-surface)',
                    border: `2px solid var(--flock-accent)`,
                    width: 8,
                    height: 8,
                    top: '50%',
                    left: 0,
                    transform: 'translateY(-50%)',
                  }}
                />
                <div className="flock-handle-plus">
                  <ActionIcon
                    size="16px"
                    radius="xl"
                    variant="filled"
                    style={{
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      background: 'var(--flock-accent, #155aef)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (data.onHandlePlusClick) {
                        data.onHandlePlusClick(id, cat.category_id, e.clientX, e.clientY);
                      }
                    }}
                  >
                    <IconPlus size={10} stroke={3} />
                  </ActionIcon>
                </div>
              </div>
            </Box>
          );
        })}
      </Box>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: 'var(--flock-bg-surface)',
          border: `2px solid var(--flock-accent)`,
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
});

export const IfElseNode = memo(({ id, data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['ifelse'];
  const Icon = cfg.icon;
  const cases = (data.cases as { case_id: string }[]) ?? [];

  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
      style={{ overflow: 'visible' }}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
        }}
      >
        <Box
          className="flock-node-icon-container"
          style={{
            background: `${cfg.colorHex}15`,
          }}
        >
          <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || cfg.display}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px' }}>
        {cases.map((c, idx) => {
          const isElse = c.case_id === 'false_else';
          return (
            <Box key={c.case_id} style={{ position: 'relative', marginBottom: 6 }}>
              <Box
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
                  border: '1px solid var(--flock-border-subtle)',
                  marginRight: 6,
                  overflow: 'hidden',
                }}
              >
                <Text size="xs" fw={700} style={{ fontSize: 10, color: 'var(--flock-text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isElse ? 'ELSE' : `IF ${idx + 1}`}
                </Text>
              </Box>
              <div 
                className="flock-handle-container"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: -40,
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 20,
                  zIndex: 10,
                }}
              >
                <Handle
                  type="source"
                  position={Position.Right}
                  id={c.case_id}
                  style={{
                    background: 'var(--flock-bg-surface)',
                    border: `2px solid var(--flock-accent)`,
                    width: 8,
                    height: 8,
                    top: '50%',
                    left: 0,
                    transform: 'translateY(-50%)',
                  }}
                />
                <div className="flock-handle-plus">
                  <ActionIcon
                    size="16px"
                    radius="xl"
                    variant="filled"
                    style={{
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      background: 'var(--flock-accent, #155aef)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (data.onHandlePlusClick) {
                        data.onHandlePlusClick(id, c.case_id, e.clientX, e.clientY);
                      }
                    }}
                  >
                    <IconPlus size={10} stroke={3} />
                  </ActionIcon>
                </div>
              </div>
            </Box>
          );
        })}
      </Box>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: 'var(--flock-bg-surface)',
          border: `2px solid var(--flock-accent)`,
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
});

export const HumanNode = memo(({ id, data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['human'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  const actions = (data.user_actions as { key: string; label: string }[]) ?? [
    { key: 'action_1', label: 'Approve' },
    { key: 'action_2', label: 'Reject' },
  ];

  // We append TIMEOUT action
  const allActions = [
    ...actions,
    { key: 'TIMEOUT', label: t('workflow.properties.human.timeoutAction', 'TIMEOUT') }
  ];

  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
      style={{ overflow: 'visible' }}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
        }}
      >
        <Box
          className="flock-node-icon-container"
          style={{
            background: `${cfg.colorHex}15`,
          }}
        >
          <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px' }}>
        {allActions.map((act) => {
          const isTimeout = act.key === 'TIMEOUT';
          return (
            <Box key={act.key} style={{ position: 'relative', marginBottom: 6 }}>
              <Box
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
                  border: '1px solid var(--flock-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  marginRight: 6,
                  overflow: 'hidden',
                }}
              >
                <Text size="xs" fw={700} style={{ fontSize: 10, color: isTimeout ? 'var(--mantine-color-red-6)' : 'var(--flock-text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {act.key.toUpperCase()}
                </Text>
                {act.label && (
                  <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {act.label}
                  </Text>
                )}
              </Box>
              <div 
                className="flock-handle-container"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: -40,
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 20,
                  zIndex: 10,
                }}
              >
                <Handle
                  type="source"
                  position={Position.Right}
                  id={act.key}
                  style={{
                    background: 'var(--flock-bg-surface)',
                    border: `2px solid var(--flock-accent)`,
                    width: 8,
                    height: 8,
                    top: '50%',
                    left: 0,
                    transform: 'translateY(-50%)',
                  }}
                />
                <div className="flock-handle-plus">
                  <ActionIcon
                    size="16px"
                    radius="xl"
                    variant="filled"
                    style={{
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      background: 'var(--flock-accent, #155aef)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (data.onHandlePlusClick) {
                        data.onHandlePlusClick(id, act.key, e.clientX, e.clientY);
                      }
                    }}
                  >
                    <IconPlus size={10} stroke={3} />
                  </ActionIcon>
                </div>
              </div>
            </Box>
          );
        })}
      </Box>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: 'var(--flock-bg-surface)',
          border: `2px solid var(--flock-accent)`,
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
});

