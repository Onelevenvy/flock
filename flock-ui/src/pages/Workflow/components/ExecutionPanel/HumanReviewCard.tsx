import { useState } from 'react';
import {
  Box,
  Text,
  Badge,
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
import { nodeConfig } from '../../nodeConfig';

interface HumanReviewCardProps {
  interruptData: InterruptData;
  onResume: (choice: string, feedback?: string) => void;
  isDark: boolean;
  isResolved: boolean;
  /** 已处理时触发的动作 label */
  resolvedActionLabel?: string;
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
          {displayName ?? t('workflow.nodes.human.label', '人工审查')}
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

          {/* 已处理时：只显示已触发提示 */}
          {isResolved ? (
            <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
              {resolvedActionLabel
                ? `${t('workflow.execution.triggeredAction', '已触发操作')}: ${resolvedActionLabel}`
                : t('workflow.execution.resolved', '已处理')}
            </Text>
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
