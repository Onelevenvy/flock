import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig } from '../nodeConfig';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';

export const StartNode = memo(({ id, data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['start'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  const variables = (data.variables as any[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true }
  ];
  const customVariables = variables.filter(v => v.name !== 'query');

  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      {/* Node Header */}
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: customVariables.length > 0 ? '1px solid var(--flock-border-subtle)' : 'none',
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
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', fontSize: 12, flex: 1 }}>
          {data.label || t('workflow.nodes.start.label', 'Start')}
        </Text>
      </Box>

      {/* Variables List */}
      {customVariables.length > 0 && (
        <Box style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {customVariables.map((v) => (
            <Box
              key={v.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: 6,
                background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
                fontSize: 10,
              }}
            >
              <Text size="xs" fw={500} style={{ color: 'var(--flock-text-bright)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {v.name}
              </Text>
              <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {v.required && (
                  <Text size="10px" c="red" fw={500}>
                    {t('workflow.properties.start.required', 'Required')}
                  </Text>
                )}
                <Text size="10px" c="dimmed">
                  ({v.type})
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <div 
        className="flock-handle-container"
        style={{
          position: 'absolute',
          top: '50%',
          right: -28,
          transform: 'translateY(-50%)',
          width: 32,
          height: 20,
          zIndex: 10,
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="right"
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
                data.onHandlePlusClick(id, 'right', e.clientX, e.clientY);
              }
            }}
          >
            <IconPlus size={10} stroke={3} />
          </ActionIcon>
        </div>
      </div>
    </Box>
  );
});

export const EndNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['end'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
      <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', fontSize: 12, flex: 1 }}>
        {data.label || t('workflow.nodes.end.label', 'End')}
      </Text>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: 'var(--flock-bg-surface)', border: `2px solid var(--flock-accent)`, width: 8, height: 8 }}
      />
    </Box>
  );
});
