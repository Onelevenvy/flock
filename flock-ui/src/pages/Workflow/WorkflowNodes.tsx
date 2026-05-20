import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, Badge } from '@mantine/core';
import { nodeConfig, type NodeType } from './nodeConfig';

interface BaseNodeData {
  label: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getNodeSummary(type: NodeType, data: Record<string, unknown>): string {
  switch (type) {
    case 'llm':
    case 'agent':
      return data.model ? String(data.model) : '未选择模型';
    case 'classifier':
      return `${(data.categories as unknown[])?.length ?? 0} 个分类`;
    case 'answer':
      return data.answer ? String(data.answer).slice(0, 40) : '无输出模板';
    case 'code':
      return `${data.language ?? 'python'}`;
    case 'plugin':
      return data.tool ? `工具: ${(data.tool as { name: string }).name}` : '未选择工具';
    case 'human':
      return data.title ? String(data.title).slice(0, 30) : '等待人工确认';
    case 'parameterExtractor':
      return `${(data.parameters as unknown[])?.length ?? 0} 个参数`;
    default:
      return '';
  }
}

// ── Generic base node ─────────────────────────────────────────────────────

function BaseWorkflowNode({ type, data, selected }: NodeProps<BaseNodeData> & { type: NodeType }) {
  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const summary = getNodeSummary(type, data);

  return (
    <Box
      style={{
        minWidth: 160,
        borderRadius: 10,
        border: selected ? `2px solid ${cfg.colorHex}` : '1.5px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: selected ? `0 0 0 3px ${cfg.colorHex}28` : '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Header */}
      <Box
        style={{
          background: cfg.colorHex,
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon size={13} stroke={2} style={{ color: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
        <Text size="xs" fw={600} style={{ color: '#fff', flex: 1, fontSize: 11, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || cfg.display}
        </Text>
      </Box>

      {/* Body */}
      {summary && (
        <Box style={{ padding: '5px 10px' }}>
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
            background: cfg.colorHex,
            border: '2px solid var(--flock-bg-surface)',
            width: 10,
            height: 10,
          }}
        />
      )}
      {cfg.allowedConnections.sources.includes('right') && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{
            background: cfg.colorHex,
            border: '2px solid var(--flock-bg-surface)',
            width: 10,
            height: 10,
          }}
        />
      )}
    </Box>
  );
}

// ── Start / End — pill shape ──────────────────────────────────────────────

export const StartNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['start'];
  const Icon = cfg.icon;
  return (
    <Box
      style={{
        padding: '7px 18px',
        borderRadius: 24,
        background: cfg.colorHex,
        border: selected ? '2.5px solid rgba(255,255,255,0.7)' : '2px solid transparent',
        boxShadow: selected ? `0 0 0 3px ${cfg.colorHex}55` : '0 3px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        minWidth: 90,
        justifyContent: 'center',
      }}
    >
      <Icon size={14} stroke={2.5} style={{ color: '#fff' }} />
      <Text size="xs" fw={700} style={{ color: '#fff', fontSize: 11 }}>
        {data.label || 'Start'}
      </Text>
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#fff', border: `2px solid ${cfg.colorHex}`, width: 10, height: 10 }}
      />
    </Box>
  );
});

export const EndNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['end'];
  const Icon = cfg.icon;
  return (
    <Box
      style={{
        padding: '7px 18px',
        borderRadius: 24,
        background: cfg.colorHex,
        border: selected ? '2.5px solid rgba(255,255,255,0.7)' : '2px solid transparent',
        boxShadow: selected ? `0 0 0 3px ${cfg.colorHex}55` : '0 3px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        minWidth: 90,
        justifyContent: 'center',
      }}
    >
      <Icon size={14} stroke={2.5} style={{ color: '#fff' }} />
      <Text size="xs" fw={700} style={{ color: '#fff', fontSize: 11 }}>
        {data.label || 'End'}
      </Text>
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#fff', border: `2px solid ${cfg.colorHex}`, width: 10, height: 10 }}
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
  const categories = (data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <Box
      style={{
        minWidth: 160,
        borderRadius: 10,
        border: selected ? `2px solid ${cfg.colorHex}` : '1.5px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: selected ? `0 0 0 3px ${cfg.colorHex}28` : '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'visible',
        cursor: 'pointer',
      }}
    >
      <Box
        style={{
          background: cfg.colorHex,
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <Icon size={13} stroke={2} style={{ color: 'rgba(255,255,255,0.9)' }} />
        <Text size="xs" fw={600} style={{ color: '#fff', fontSize: 11 }} lineClamp={1}>
          {data.label || cfg.display}
        </Text>
      </Box>
      <Box style={{ padding: '6px 10px 5px' }}>
        {categories.map((cat) => (
          <Box key={cat.category_id} style={{ position: 'relative', marginBottom: 3, paddingRight: 10 }}>
            <Badge size="xs" color={cat.category_id === 'others_category' ? 'gray' : 'pink'} variant="light" style={{ fontSize: 9 }}>
              {cat.category_name || cat.category_id}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={cat.category_id}
              style={{ background: cfg.colorHex, border: '2px solid var(--flock-bg-surface)', width: 9, height: 9, right: -5, top: '50%', transform: 'translateY(-50%)' }}
            />
          </Box>
        ))}
      </Box>
      <Handle type="target" position={Position.Left} id="left" style={{ background: cfg.colorHex, border: '2px solid var(--flock-bg-surface)', width: 10, height: 10 }} />
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
        minWidth: 160,
        borderRadius: 10,
        border: selected ? `2px solid ${cfg.colorHex}` : '1.5px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: selected ? `0 0 0 3px ${cfg.colorHex}28` : '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'visible',
        cursor: 'pointer',
      }}
    >
      <Box
        style={{
          background: cfg.colorHex,
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <Icon size={13} stroke={2} style={{ color: 'rgba(255,255,255,0.9)' }} />
        <Text size="xs" fw={600} style={{ color: '#fff', fontSize: 11 }} lineClamp={1}>
          {data.label || cfg.display}
        </Text>
      </Box>
      <Box style={{ padding: '6px 10px 5px' }}>
        {cases.map((c, idx) => (
          <Box key={c.case_id} style={{ position: 'relative', marginBottom: 3, paddingRight: 10 }}>
            <Badge size="xs" color={c.case_id === 'false_else' ? 'gray' : 'violet'} variant="light" style={{ fontSize: 9 }}>
              {c.case_id === 'false_else' ? 'ELSE' : `IF ${idx + 1}`}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={c.case_id}
              style={{ background: cfg.colorHex, border: '2px solid var(--flock-bg-surface)', width: 9, height: 9, right: -5, top: '50%', transform: 'translateY(-50%)' }}
            />
          </Box>
        ))}
      </Box>
      <Handle type="target" position={Position.Left} id="left" style={{ background: cfg.colorHex, border: '2px solid var(--flock-bg-surface)', width: 10, height: 10 }} />
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
