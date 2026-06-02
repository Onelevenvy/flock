import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';
import { type BaseNodeData } from '../types';

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
EndNode.displayName = 'EndNode';
