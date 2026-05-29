import { useState } from 'react';
import { Box, Text, Badge, Collapse, ActionIcon, Group } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconX,
  IconLoader2,
  IconClock,
  IconUser,
  IconBrain,
  IconRobot,
  IconCode,
  IconMessageCircle,
  IconGitBranch,
  IconTags,
  IconPuzzle,
  IconCrosshair,
  IconPlayerPlay,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import { WorkflowStep } from './types';
import { nodeConfig } from '../../nodeConfig';
import { HumanReviewCard } from './HumanReviewCard';
import { useTranslation } from 'react-i18next';

interface WorkflowStepItemProps {
  step: WorkflowStep;
  isDark: boolean;
  onResume: (choice: string, feedback?: string) => void;
}

const NODE_ICON_MAP: Record<string, React.ElementType> = {
  start: IconPlayerPlay,
  llm: IconBrain,
  agent: IconRobot,
  code: IconCode,
  answer: IconMessageCircle,
  ifelse: IconGitBranch,
  classifier: IconTags,
  plugin: IconPuzzle,
  parameterExtractor: IconCrosshair,
  parameter_extractor: IconCrosshair,
  human: IconUser,
};

function StatusIcon({ status }: { status: WorkflowStep['status'] }) {
  if (status === 'done') {
    return (
      <Box
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconCheck size={10} color="#fff" stroke={3} />
      </Box>
    );
  }
  if (status === 'error') {
    return (
      <Box
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconX size={10} color="#fff" stroke={3} />
      </Box>
    );
  }
  if (status === 'running') {
    return (
      <Box style={{ flexShrink: 0, animation: 'spin 1s linear infinite', display: 'flex' }}>
        <IconLoader2 size={16} style={{ color: '#3b82f6' }} />
      </Box>
    );
  }
  // waiting
  return (
    <Box
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconClock size={10} color="#fff" />
    </Box>
  );
}

export function WorkflowStepItem({ step, isDark, onResume }: WorkflowStepItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(step.status === 'running' || step.isInterrupt);

  const cfg = nodeConfig[step.nodeType as keyof typeof nodeConfig];
  const colorHex = cfg?.colorHex ?? '#6b7280';
  const NodeIcon = NODE_ICON_MAP[step.nodeType] ?? IconBrain;

  const hasContent = step.outputText.trim().length > 0 || step.thinkingText.trim().length > 0;

  // 对于人工介入步骤，委托给 HumanReviewCard
  if (step.isInterrupt) {
    return (
      <HumanReviewCard
        interruptData={step.interruptData ?? {}}
        onResume={onResume}
        isDark={isDark}
        isResolved={step.interruptResolved}
        resolvedActionLabel={step.resolvedActionLabel}
        displayName={step.displayName}
      />
    );
  }

  return (
    <Box
      style={{
        borderRadius: 8,
        border: '1px solid var(--flock-border-subtle)',
        overflow: 'hidden',
        background: 'var(--flock-bg-surface)',
      }}
    >
      {/* 步骤头部行 */}
      <Box
        onClick={() => hasContent && setExpanded((v) => !v)}
        style={{
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: hasContent ? 'pointer' : 'default',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          userSelect: 'none',
        }}
      >
        {/* 展开/折叠 chevron */}
        {hasContent ? (
          <ActionIcon size="xs" variant="transparent" color="gray" style={{ flexShrink: 0 }}>
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        ) : (
          <Box style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* 节点图标 */}
        <Box
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: colorHex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NodeIcon size={11} color="#fff" />
        </Box>

        {/* 节点名称 */}
        <Text
          size="xs"
          fw={500}
          style={{ flex: 1, color: 'var(--flock-text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {step.displayName}
        </Text>

        {/* 右侧：耗时 + 状态图标 */}
        <Group gap={6} wrap="nowrap">
          {step.durationMs !== undefined && (
            <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
              {step.durationMs < 1000
                ? `${step.durationMs.toFixed(0)} ms`
                : `${(step.durationMs / 1000).toFixed(2)} s`}
            </Text>
          )}
          {step.tokens !== undefined && (
            <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
              {step.tokens} tokens
            </Text>
          )}
          <StatusIcon status={step.status} />
        </Group>
      </Box>

      {/* 展开内容 */}
      <Collapse in={expanded && hasContent}>
        <Box
          style={{
            padding: '8px 12px 10px 12px',
            borderTop: '1px solid var(--flock-border-subtle)',
            fontSize: 12,
            color: 'var(--flock-text-dim)',
            lineHeight: 1.6,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {step.thinkingText && (
            <Box
              style={{
                marginBottom: 6,
                padding: '6px 8px',
                borderRadius: 6,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                borderLeft: '2px solid var(--flock-border-dim)',
              }}
            >
              <Text size="xs" c="dimmed" fw={500} style={{ fontSize: 10, marginBottom: 2 }}>
                {t('workflow.execution.thinking', '思考过程')}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>
                {step.thinkingText}
              </Text>
            </Box>
          )}
          {step.outputText && (
            <Box className="workflow-step-markdown">
              <ReactMarkdown>{step.outputText}</ReactMarkdown>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
