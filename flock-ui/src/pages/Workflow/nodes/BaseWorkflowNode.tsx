import { useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useWorkflowStore } from '@/store/workflowStore';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';
import { getNodeSummary } from './helpers';
import { getAvailableVariables } from '@/pages/Workflow/components/PropertiesPanel/helper';

export interface BaseWorkflowNodeProps extends NodeProps<BaseNodeData> {
  type: NodeType;
  customIcon?: React.ReactNode;
  customSummary?: React.ReactNode;
  renderContent?: (variables: any[]) => React.ReactNode;
}

export function BaseWorkflowNode({
  id,
  type,
  data,
  selected,
  customIcon,
  customSummary,
  renderContent,
}: BaseWorkflowNodeProps) {
  const { t } = useTranslation();

  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const summary = getNodeSummary(type, data, t);

  const wNodes = useWorkflowStore((s) => s.nodes);
  const wEdges = useWorkflowStore((s) => s.edges);
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);

  const variables = useMemo(
    () => getAvailableVariables(id, wNodes, wEdges, environmentVariables),
    [id, wNodes, wEdges, environmentVariables]
  );

  const hasContent = !!renderContent;

  return (
    <Box className={`flock-workflow-node ${selected ? 'selected' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      {/* Node Header */}
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: (summary || hasContent || customSummary) ? '1px solid var(--flock-border-subtle)' : 'none',
        }}
      >
        <Box
          className="flock-node-icon-container"
          style={{
            background: `${cfg.colorHex}15`,
          }}
        >
          {customIcon ? (
            customIcon
          ) : (
            <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
          )}
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>

      {/* Node Content / Summary */}
      {renderContent ? (
        renderContent(variables)
      ) : customSummary ? (
        <Box style={{ padding: '8px 12px', minHeight: 38, display: 'flex', alignItems: 'center' }}>
          {customSummary}
        </Box>
      ) : summary ? (
        <Box style={{ padding: '8px 12px', minHeight: 38, display: 'flex', alignItems: 'center' }}>
          <Text size="xs" c="dimmed" lineClamp={2} style={{ fontSize: 10 }}>
            {summary}
          </Text>
        </Box>
      ) : null}

      {/* Handles */}
      {cfg.allowedConnections.targets.includes('left') && (
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
      )}
      {cfg.allowedConnections.sources.includes('right') && (
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
      )}
    </Box>
  );
}
