import { useState } from 'react';
import {
  Box,
  Text,
  Button,
  TextInput,
  Group,
  Collapse,
  ActionIcon,
} from '@mantine/core';
import {
  IconUser,
  IconChevronDown,
  IconChevronRight,
  IconSparkles,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { HumanAction, InterruptData } from './types';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';

interface HumanReviewCardProps {
  interruptData: InterruptData;
  onResume: (choice: string, feedback?: string) => void;
  isDark: boolean;
  isResolved: boolean;
  /** 已处理时触发的动作 label */
  resolvedActionLabel?: string;
  /** 已处理时用户填写的 feedback */
  resolvedFeedback?: string;
  /** 节点显示名 */
  displayName?: string;
}

/** Dify 风格的人工介入步骤卡片 */
export function HumanReviewCard({
  interruptData,
  onResume,
  isDark,
  isResolved,
  resolvedActionLabel,
  resolvedFeedback,
  displayName,
}: HumanReviewCardProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState('');
  const [expanded, setExpanded] = useState(!isResolved);

  const actions = interruptData.actions ?? [
    { key: 'action_1', label: t('workflow.execution.approve', 'Approve'), enable_feedback: false },
    { key: 'action_2', label: t('workflow.execution.deny', 'Reject'), enable_feedback: true },
  ];

  const humanCfg = nodeConfig['human'];

  const handleActionClick = (act: HumanAction) => {
    if (isResolved) return;
    onResume(act.key, act.enable_feedback ? feedback.trim() || undefined : undefined);
  };

  const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const cardBorder = isResolved
    ? 'var(--flock-border-subtle)'
    : `1px solid ${isDark ? 'rgba(234,179,8,0.35)' : 'rgba(234,179,8,0.5)'}`;

  return (
    <Box
      style={{
        borderRadius: 10,
        border: cardBorder,
        overflow: 'hidden',
        opacity: isResolved ? 0.8 : 1,
        background: 'var(--flock-bg-surface)',
      }}
    >
      {/* ---- 标题行（可点击展开/折叠） ---- */}
      <Box
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: '8px 12px',
          background: headerBg,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* 节点图标 */}
        <Box
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: humanCfg.colorHex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconUser size={12} color="#fff" />
        </Box>

        <Text size="xs" fw={600} style={{ flex: 1, color: 'var(--flock-text-bright)' }}>
          {displayName ?? t('workflow.nodes.human.label', 'HITL')}
        </Text>

        {isResolved ? (
          <Group gap={6} wrap="nowrap">
            {resolvedActionLabel && (
              <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconSparkles size={11} />
                {t('workflow.execution.triggered', '已触发')} {resolvedActionLabel}
              </Text>
            )}
            <ActionIcon size="xs" variant="transparent" color="gray">
              {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            </ActionIcon>
          </Group>
        ) : (
          <ActionIcon size="xs" variant="transparent" color="gray">
            {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
          </ActionIcon>
        )}
      </Box>

      {/* ---- 展开内容 ---- */}
      <Collapse in={expanded}>
        <Box style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 审查提示 */}
          {interruptData.title && (
            <Text size="xs" c="dimmed" style={{ paddingBottom: 4 }}>
              {interruptData.title}
            </Text>
          )}

          {/* 已处理时：显示用户选择的 action + feedback */}
          {isResolved ? (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {resolvedActionLabel ? (
                <Box style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Box
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {/* check icon via CSS */}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Box>
                  <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)', fontSize: 12 }}>
                    {resolvedActionLabel}
                  </Text>
                </Box>
              ) : (
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  {t('workflow.execution.resolved', '已处理')}
                </Text>
              )}
              {resolvedFeedback && (
                <Text size="xs" c="dimmed" style={{ fontSize: 11, paddingLeft: 20 }}>
                  {resolvedFeedback}
                </Text>
              )}
            </Box>
          ) : (
            /* 未处理时：渲染操作按钮 */
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {actions.map((act, idx) => {
                const isFirst = idx === 0;
                const btnColor = isFirst ? 'blue' : undefined;
                const btnVariant: 'filled' | 'default' = isFirst ? 'filled' : 'default';

                if (act.enable_feedback) {
                  return (
                    <Group key={act.key} gap="xs" style={{ width: '100%' }} wrap="nowrap">
                      <Button
                        size="xs"
                        variant={btnVariant}
                        color={btnColor}
                        onClick={() => handleActionClick(act)}
                        style={{ fontWeight: 600, flexShrink: 0 }}
                      >
                        {act.label || act.key}
                      </Button>
                      <TextInput
                        placeholder={t('workflow.execution.feedbackPlaceholder', 'Add optional comment...')}
                        value={feedback}
                        onChange={(e) => setFeedback(e.currentTarget.value)}
                        size="xs"
                        styles={{
                          input: {
                            fontSize: '11px',
                            backgroundColor: 'var(--flock-bg-deepest)',
                            border: '1px solid var(--flock-border-dim)',
                            height: '30px',
                          },
                        }}
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleActionClick(act);
                          }
                        }}
                      />
                    </Group>
                  );
                }

                return (
                  <Button
                    key={act.key}
                    size="xs"
                    variant={btnVariant}
                    color={btnColor}
                    onClick={() => handleActionClick(act)}
                    style={{ justifyContent: 'flex-start', fontWeight: 600 }}
                  >
                    {act.label || act.key}
                  </Button>
                );
              })}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
