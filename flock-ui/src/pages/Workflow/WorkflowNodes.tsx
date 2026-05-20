import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from './nodeConfig';

interface BaseNodeData {
  label: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getNodeSummary(
  type: NodeType,
  data: Record<string, unknown>,
  t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => string
): string {
  switch (type) {
    case 'llm':
    case 'agent':
      return data.model ? String(data.model) : t('workflow.nodes.noModel', 'No Model');
    case 'classifier':
      return t('workflow.nodes.classifierCount', '{{count}} Categories', { count: (data.categories as unknown[])?.length ?? 0 });
    case 'answer':
      return data.answer ? String(data.answer).slice(0, 40) : t('workflow.nodes.noOutputTemplate', 'No Output Template');
    case 'code':
      return `${data.language ?? 'python'}`;
    case 'plugin':
      return data.tool ? t('workflow.nodes.toolLabel', 'Tool: {{name}}', { name: (data.tool as { name: string }).name }) : t('workflow.nodes.noTool', 'No Tool');
    case 'human':
      return data.title ? String(data.title).slice(0, 30) : t('workflow.nodes.waitingHuman', 'Waiting review');
    case 'parameterExtractor':
      return t('workflow.nodes.parameterCount', '{{count}} Parameters', { count: (data.parameters as unknown[])?.length ?? 0 });
    default:
      return '';
  }
}

// ── Generic base node ─────────────────────────────────────────────────────

function BaseWorkflowNode({ type, data, selected }: NodeProps<BaseNodeData> & { type: NodeType }) {
  const { t } = useTranslation();
  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const summary = getNodeSummary(type, data, t);

  return (
    <Box
      style={{
        minWidth: 170,
        borderRadius: 12,
        border: selected 
          ? `1.5px solid var(--flock-accent)` 
          : `1px solid ${cfg.colorHex}50`, // 专属颜色的淡化边框
        background: 'var(--flock-bg-surface)',
        boxShadow: selected 
          ? `0 0 0 3px var(--flock-accent)20` 
          : '0 4px 12px rgba(0,0,0,0.03)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header */}
      <Box
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        {/* 圆角正方形包裹的 Icon 徽标 */}
        <Box
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: `${cfg.colorHex}16`, // 透明柔和背景
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={13} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 11, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>

      {/* Body */}
      {summary && (
        <Box style={{ padding: '8px 12px', background: 'var(--flock-bg-surface)' }}>
          <Text size="xs" c="dimmed" lineClamp={2} style={{ fontSize: 10 }}>
            {summary}
          </Text>
        </Box>
      )}

      {/* Handles */}
      {cfg.allowedConnections.targets.includes('left') && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{
            background: 'var(--flock-bg-surface)',
            border: `2px solid ${cfg.colorHex}`,
            width: 8,
            height: 8,
          }}
        />
      )}
      {cfg.allowedConnections.sources.includes('right') && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{
            background: 'var(--flock-bg-surface)',
            border: `2px solid ${cfg.colorHex}`,
            width: 8,
            height: 8,
          }}
        />
      )}
    </Box>
  );
}

// ── Start / End ────────────────────────────────────────────────────────────

export const StartNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['start'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  return (
    <Box
      style={{
        padding: '8px 12px',
        borderRadius: 12,
        background: 'var(--flock-bg-surface)',
        border: selected 
          ? `1.5px solid var(--flock-accent)` 
          : `1px solid ${cfg.colorHex}70`,
        boxShadow: selected 
          ? `0 0 0 3px var(--flock-accent)20` 
          : '0 4px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        minWidth: 170,
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: `${cfg.colorHex}16`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={12} stroke={2.5} style={{ color: cfg.colorHex }} />
      </Box>
      <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', fontSize: 11, flex: 1 }}>
        {data.label || t('workflow.nodes.start.label', 'Start')}
      </Text>
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: 'var(--flock-bg-surface)', border: `2px solid ${cfg.colorHex}`, width: 8, height: 8 }}
      />
    </Box>
  );
});

export const EndNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['end'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  return (
    <Box
      style={{
        padding: '8px 12px',
        borderRadius: 12,
        background: 'var(--flock-bg-surface)',
        border: selected 
          ? `1.5px solid var(--flock-accent)` 
          : `1px solid ${cfg.colorHex}70`,
        boxShadow: selected 
          ? `0 0 0 3px var(--flock-accent)20` 
          : '0 4px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        minWidth: 170,
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: `${cfg.colorHex}16`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={12} stroke={2.5} style={{ color: cfg.colorHex }} />
      </Box>
      <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', fontSize: 11, flex: 1 }}>
        {data.label || t('workflow.nodes.end.label', 'End')}
      </Text>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: 'var(--flock-bg-surface)', border: `2px solid ${cfg.colorHex}`, width: 8, height: 8 }}
      />
    </Box>
  );
});

// ── Standard nodes ────────────────────────────────────────────────────────

export const LLMNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="llm" />);
export const AgentNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="agent" />);
export const AnswerNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="answer" />);
export const CodeNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="code" />);
export const HumanNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="human" />);
export const ParameterExtractorNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="parameterExtractor" />);
export const PluginNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="plugin" />);

// ── Multi-handle nodes (Classifier / IfElse) ────────────────────────────────

export const ClassifierNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['classifier'];
  const Icon = cfg.icon;
  const { t } = useTranslation();
  const categories = (data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <Box
      style={{
        minWidth: 170,
        borderRadius: 12,
        border: selected 
          ? `1.5px solid var(--flock-accent)` 
          : `1px solid ${cfg.colorHex}50`,
        background: 'var(--flock-bg-surface)',
        boxShadow: selected 
          ? `0 0 0 3px var(--flock-accent)20` 
          : '0 4px 12px rgba(0,0,0,0.03)',
        overflow: 'visible',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        <Box
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: `${cfg.colorHex}16`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={13} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 11, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px', background: 'var(--flock-bg-surface)' }}>
        {categories.map((cat) => (
          <Box key={cat.category_id} style={{ position: 'relative', marginBottom: 5, paddingRight: 10 }}>
            <Badge size="xs" color={cat.category_id === 'others_category' ? 'gray' : 'pink'} variant="light" style={{ fontSize: 9 }}>
              {cat.category_id === 'others_category' ? t('workflow.nodes.classifier.others', 'Others') : (cat.category_name || cat.category_id)}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={cat.category_id}
              style={{
                background: 'var(--flock-bg-surface)',
                border: `2px solid ${cfg.colorHex}`,
                width: 8,
                height: 8,
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          </Box>
        ))}
      </Box>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: 'var(--flock-bg-surface)',
          border: `2px solid ${cfg.colorHex}`,
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
});

export const IfElseNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['ifelse'];
  const Icon = cfg.icon;
  const cases = (data.cases as { case_id: string }[]) ?? [];

  return (
    <Box
      style={{
        minWidth: 170,
        borderRadius: 12,
        border: selected 
          ? `1.5px solid var(--flock-accent)` 
          : `1px solid ${cfg.colorHex}50`,
        background: 'var(--flock-bg-surface)',
        boxShadow: selected 
          ? `0 0 0 3px var(--flock-accent)20` 
          : '0 4px 12px rgba(0,0,0,0.03)',
        overflow: 'visible',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        <Box
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: `${cfg.colorHex}16`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={13} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 11, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || cfg.display}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px', background: 'var(--flock-bg-surface)' }}>
        {cases.map((c, idx) => (
          <Box key={c.case_id} style={{ position: 'relative', marginBottom: 5, paddingRight: 10 }}>
            <Badge size="xs" color={c.case_id === 'false_else' ? 'gray' : 'violet'} variant="light" style={{ fontSize: 9 }}>
              {c.case_id === 'false_else' ? 'ELSE' : `IF ${idx + 1}`}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={c.case_id}
              style={{
                background: 'var(--flock-bg-surface)',
                border: `2px solid ${cfg.colorHex}`,
                width: 8,
                height: 8,
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          </Box>
        ))}
      </Box>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: 'var(--flock-bg-surface)',
          border: `2px solid ${cfg.colorHex}`,
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
});

// ── Node types map for ReactFlow ────────────────────────────────────────────

export const workflowNodeTypes = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  agent: AgentNode,
  classifier: ClassifierNode,
  ifelse: IfElseNode,
  answer: AnswerNode,
  code: CodeNode,
  human: HumanNode,
  parameterExtractor: ParameterExtractorNode,
  plugin: PluginNode,
};
