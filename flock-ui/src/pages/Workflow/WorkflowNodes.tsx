import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, Badge } from '@mantine/core';
import { nodeConfig, type NodeType } from './nodeConfig';

interface BaseNodeData {
  label: string;
  [key: string]: unknown;
}

function BaseWorkflowNode({
  id,
  type,
  data,
  selected,
}: NodeProps<BaseNodeData> & { type: NodeType }) {
  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Box
      style={{
        minWidth: 180,
        borderRadius: 12,
        border: selected
          ? `2px solid ${cfg.colorHex}`
          : '2px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: selected
          ? `0 0 0 3px ${cfg.colorHex}33`
          : '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      {/* Header */}
      <Box
        style={{
          background: cfg.colorHex,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon size={14} stroke={2} />
        <Text size="xs" fw={600} c="white" style={{ flex: 1, lineHeight: 1 }}>
          {data.label || cfg.display}
        </Text>
      </Box>

      {/* Body */}
      <Box style={{ padding: '8px 12px', minHeight: 32 }}>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {getNodeSummary(type, data)}
        </Text>
      </Box>

      {/* Handles */}
      {cfg.allowedConnections.targets.includes('left') && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{
            background: cfg.colorHex,
            border: '2px solid white',
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
            border: '2px solid white',
            width: 10,
            height: 10,
          }}
        />
      )}
    </Box>
  );
}

function getNodeSummary(type: NodeType, data: Record<string, unknown>): string {
  switch (type) {
    case 'llm':
    case 'agent':
      return data.model ? `Model: ${data.model}` : 'No model selected';
    case 'classifier':
      return `${(data.categories as unknown[])?.length ?? 0} categories`;
    case 'answer':
      return data.answer ? String(data.answer).slice(0, 40) : 'No template';
    case 'code':
      return `Language: ${data.language ?? 'python'}`;
    case 'plugin':
      return data.tool ? `Tool: ${(data.tool as { name: string }).name}` : 'No tool selected';
    default:
      return '';
  }
}

// ── Exported per-type node components ──────────────────────────────────────

export const StartNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="start" />
));

export const EndNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="end" />
));

export const LLMNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="llm" />
));

export const AgentNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="agent" />
));

export const ClassifierNode = memo((props: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['classifier'];
  const Icon = cfg.icon;
  const categories = (props.data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <Box
      style={{
        minWidth: 180,
        borderRadius: 12,
        border: props.selected
          ? `2px solid ${cfg.colorHex}`
          : '2px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: props.selected
          ? `0 0 0 3px ${cfg.colorHex}33`
          : '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'visible',
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          background: cfg.colorHex,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: '10px 10px 0 0',
        }}
      >
        <Icon size={14} stroke={2} />
        <Text size="xs" fw={600} c="white">
          {props.data.label || cfg.display}
        </Text>
      </Box>
      <Box style={{ padding: '8px 12px' }}>
        {categories.map((cat) => (
          <Box key={cat.category_id} style={{ position: 'relative', marginBottom: 4 }}>
            <Badge size="xs" color="pink" variant="light">
              {cat.category_name || cat.category_id}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={cat.category_id}
              style={{
                background: cfg.colorHex,
                border: '2px solid white',
                width: 8,
                height: 8,
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
          background: cfg.colorHex,
          border: '2px solid white',
          width: 10,
          height: 10,
        }}
      />
    </Box>
  );
});

export const IfElseNode = memo((props: NodeProps<BaseNodeData>) => {
  const cfg = nodeConfig['ifelse'];
  const Icon = cfg.icon;
  const cases = (props.data.cases as { case_id: string }[]) ?? [];

  return (
    <Box
      style={{
        minWidth: 180,
        borderRadius: 12,
        border: props.selected ? `2px solid ${cfg.colorHex}` : '2px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        boxShadow: props.selected ? `0 0 0 3px ${cfg.colorHex}33` : '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'visible',
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        style={{
          background: cfg.colorHex,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: '10px 10px 0 0',
        }}
      >
        <Icon size={14} stroke={2} />
        <Text size="xs" fw={600} c="white">{props.data.label || cfg.display}</Text>
      </Box>
      <Box style={{ padding: '8px 12px' }}>
        {cases.map((c) => (
          <Box key={c.case_id} style={{ position: 'relative', marginBottom: 4 }}>
            <Badge size="xs" color="violet" variant="light">
              {c.case_id === 'false_else' ? 'ELSE' : `IF`}
            </Badge>
            <Handle
              type="source"
              position={Position.Right}
              id={c.case_id}
              style={{
                background: cfg.colorHex,
                border: '2px solid white',
                width: 8,
                height: 8,
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
        style={{ background: cfg.colorHex, border: '2px solid white', width: 10, height: 10 }}
      />
    </Box>
  );
});

export const AnswerNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="answer" />
));

export const CodeNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="code" />
));

export const HumanNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="human" />
));

export const ParameterExtractorNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="parameterExtractor" />
));

export const PluginNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="plugin" />
));

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
