import { useState } from 'react';
import { Box, Avatar, Paper, Text, Stack, ActionIcon, Collapse } from '@mantine/core';
import { IconUser, IconCheck, IconChevronDown, IconChevronRight, IconMessageCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { WorkflowStepItem } from './WorkflowStepItem';
import { HumanReviewCard } from './HumanReviewCard';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';

interface ExecutionRoundItemProps {
  round: {
    index: number;
    userText?: string;
    steps: any[];
  };
  status: string;
  isDark: boolean;
  trackedResume: (choice: string, feedback?: string, actionLabel?: string) => void;
}

export function ExecutionRoundItem({
  round,
  status,
  isDark,
  trackedResume,
}: ExecutionRoundItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const roundAllDone = round.steps.length > 0 && round.steps.every(s => s.status === 'done' || s.status === 'error');
  const roundProminentSteps = round.steps.filter(s => s.nodeType === 'answer' || s.isInterrupt);

  return (
    <Stack gap={8}>
      {/* 用户输入气泡 */}
      {round.userText && (
        <Box
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Avatar
            size={28}
            radius="xl"
            style={{
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              flexShrink: 0,
            }}
          >
            <IconUser size={14} color="var(--flock-text-dim)" />
          </Avatar>
          <Paper
            p="xs"
            radius="lg"
            style={{
              maxWidth: '80%',
              background: 'var(--flock-accent-soft)',
              border: '1px solid var(--flock-border-base)',
              borderRadius: '18px 4px 18px 18px',
            }}
          >
            <Text size="sm" style={{ color: 'var(--flock-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {round.userText}
            </Text>
          </Paper>
        </Box>
      )}

      {/* 工作流折叠组 */}
      {round.steps.length > 0 && (
        <Box
          style={{
            borderRadius: 10,
            border: '1px solid var(--flock-border-subtle)',
            overflow: 'hidden',
            background: 'var(--flock-bg-surface)',
          }}
        >
          {/* 组标题行 */}
          <Box
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              borderBottom: isExpanded ? '1px solid var(--flock-border-subtle)' : 'none',
            }}
          >
            {/* 完成状态图标 */}
            {roundAllDone ? (
              <Box
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconCheck size={9} color="#fff" stroke={3} />
              </Box>
            ) : (
              <Box
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: `2px solid ${status === 'running' ? '#3b82f6' : '#6b7280'}`,
                  flexShrink: 0,
                  animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
            )}

            <Text size="xs" fw={600} style={{ flex: 1, color: 'var(--flock-text-bright)' }}>
              {t('workflow.execution.workflowGroup', '工作流')}
            </Text>

            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
              {round.steps.length} {t('workflow.execution.steps', '步')}
            </Text>

            <ActionIcon size="xs" variant="transparent" color="gray">
              {isExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            </ActionIcon>
          </Box>

          {/* 步骤列表（折叠内容） */}
          <Collapse in={isExpanded}>
            <Stack gap={3} p="xs">
              {round.steps.map((step) => (
                <WorkflowStepItem
                  key={step.id}
                  step={step}
                  isDark={isDark}
                />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      {/* answer / human 步骤在折叠组外显示 */}
      {roundProminentSteps.map((step) => {
        if (step.isInterrupt) {
          return (
            <HumanReviewCard
              key={`prominent-${step.id}`}
              interruptData={step.interruptData ?? {}}
              onResume={trackedResume}
              isDark={isDark}
              isResolved={step.interruptResolved}
              resolvedActionLabel={step.resolvedActionLabel}
              resolvedFeedback={step.resolvedFeedback}
              displayName={step.displayName}
            />
          );
        }

        const answerCfg = nodeConfig['answer'];
        return (
          <Box
            key={`prominent-${step.id}`}
            style={{
              borderRadius: 10,
              border: '1px solid var(--flock-border-subtle)',
              overflow: 'hidden',
              background: 'var(--flock-bg-surface)',
            }}
          >
            <Box
              style={{
                padding: '7px 12px',
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderBottom: '1px solid var(--flock-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Box
                style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: answerCfg.colorHex,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconMessageCircle size={11} color="#fff" />
              </Box>
              <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12 }}>
                {step.displayName}
              </Text>
              {step.status === 'running' && (
                <Box style={{ animation: 'spin 1s linear infinite', display: 'flex' }}>
                  <IconCheck size={13} style={{ color: '#3b82f6' }} />
                </Box>
              )}
            </Box>
            <Box style={{ padding: '10px 14px' }}>
              {step.outputText ? (
                <Box className="markdown-body">
                  <ReactMarkdown>{step.outputText}</ReactMarkdown>
                </Box>
              ) : (
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', fontSize: 11 }}>
                  {t('workflow.execution.generating', '生成中...')}
                </Text>
              )}
            </Box>
          </Box>
        );
      })}

      {/* 如果被中止，在最外侧以最简约的纯文字展现，确保不受折叠影响，去掉任何红色背景和虚线 */}
      {round.steps.some(s => s.outputText?.includes('🚫') || s.outputText?.includes('aborted') || s.outputText?.includes('中止')) && (
        <Box px="xs" py={4}>
          <Text size="xs" fw={500} style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🚫</span>
            <span>{t('chat.aborted', 'Dialogue aborted by user').replace(/^[\n\s*🚫]+/g, '').replace(/[\s*]+$/g, '')}</span>
          </Text>
        </Box>
      )}
    </Stack>
  );
}
