import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';
import { type BaseNodeData } from '../types';
import { handleStyle } from '../styles';

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
IfElseNode.displayName = 'IfElseNode';
