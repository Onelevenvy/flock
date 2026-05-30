import { useState } from 'react';
import { Box, Text, Collapse, ActionIcon, Group } from '@mantine/core';
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
import { nodeConfig } from '../../../../pages/Workflow/nodeConfig';
import { useTranslation } from 'react-i18next';

interface WorkflowStepItemProps {
  step: WorkflowStep;
  isDark: boolean;
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
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconCheck size={9} color="#fff" stroke={3} />
      </Box>
    );
  }
  if (status === 'error') {
    return (
      <Box
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconX size={9} color="#fff" stroke={3} />
      </Box>
    );
  }
  if (status === 'running') {
    return (
      <Box style={{ flexShrink: 0, animation: 'spin 1s linear infinite', display: 'flex' }}>
        <IconLoader2 size={15} style={{ color: '#3b82f6' }} />
      </Box>
    );
  }
  // waiting
  return (
    <Box
      style={{
        width: 15,
        height: 15,
        borderRadius: '50%',
        background: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconClock size={9} color="#fff" />
    </Box>
  );
}

export function WorkflowStepItem({ step, isDark }: WorkflowStepItemProps) {
  const { t } = useTranslation();
  // 默认折叠
  const [expanded, setExpanded] = useState(false);
  // thinking 单独折叠（默认折叠）
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  const cfg = nodeConfig[step.nodeType as keyof typeof nodeConfig];
  const colorHex = cfg?.colorHex ?? '#6b7280';
  const NodeIcon = NODE_ICON_MAP[step.nodeType] ?? IconBrain;

  const hasOutput = step.outputText.trim().length > 0;
  const hasThinking = step.thinkingText.trim().length > 0;
  const hasContent = hasOutput || hasThinking;

  return (
    <Box
      style={{
        borderRadius: 7,
        border: '1px solid var(--flock-border-subtle)',
        overflow: 'hidden',
        background: 'var(--flock-bg-surface)',
      }}
    >
      {/* 步骤头部行 */}
      <Box
        onClick={() => hasContent && setExpanded((v) => !v)}
        style={{
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          cursor: hasContent ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* 展开/折叠 chevron */}
        <ActionIcon
          size="xs"
          variant="transparent"
          color="gray"
          style={{ flexShrink: 0, opacity: hasContent ? 1 : 0.2 }}
        >
          {expanded ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />}
        </ActionIcon>

        {/* 节点图标 */}
        <Box
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: colorHex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NodeIcon size={10} color="#fff" />
        </Box>

        {/* 节点名称 */}
        <Text
          size="xs"
          fw={500}
          style={{
            flex: 1,
            color: 'var(--flock-text-bright)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
          }}
        >
          {step.displayName}
        </Text>

        {/* 右侧：耗时 + 状态图标 */}
        <Group gap={5} wrap="nowrap">
          {step.tokens !== undefined && (
            <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
              {step.tokens} tokens ·
            </Text>
          )}
          {step.durationMs !== undefined && (
            <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
              {step.durationMs < 1000
                ? `${step.durationMs.toFixed(0)} ms`
                : `${(step.durationMs / 1000).toFixed(3)} s`}
            </Text>
          )}
          <StatusIcon status={step.status} />
        </Group>
      </Box>

      {/* 展开内容 */}
      <Collapse in={expanded && hasContent}>
        <Box
          style={{
            borderTop: '1px solid var(--flock-border-subtle)',
            padding: '8px 12px 10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* thinking 可独立折叠 */}
          {hasThinking && (
            <Box>
              <Box
                onClick={() => setThinkingExpanded((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginBottom: thinkingExpanded ? 4 : 0,
                }}
              >
                <ActionIcon size="xs" variant="transparent" color="gray">
                  {thinkingExpanded ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
                </ActionIcon>
                <Text size="xs" c="dimmed" fw={500} style={{ fontSize: 10 }}>
                  {t('workflow.execution.thinking', '思考过程')}
                </Text>
              </Box>
              <Collapse in={thinkingExpanded}>
                <Box
                  style={{
                    padding: '5px 8px',
                    borderRadius: 5,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    borderLeft: '2px solid var(--flock-border-dim)',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  <Text size="xs" c="dimmed" style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {step.thinkingText}
                  </Text>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* 输出内容 */}
          {hasOutput && (
            <Box
              className="workflow-step-markdown"
              style={{ maxHeight: 260, overflowY: 'auto' }}
            >
              <ReactMarkdown>{step.outputText}</ReactMarkdown>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
