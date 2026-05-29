import { useState } from 'react';
import {
  Box,
  Text,
  Badge,
  Button,
  TextInput,
  Group,
} from '@mantine/core';
import {
  IconUser,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { HumanAction, InterruptData } from './types';

interface HumanReviewCardProps {
  interruptData: InterruptData;
  onResume: (choice: string, feedback?: string) => void;
  isDark: boolean;
  isResolved: boolean;
}

/** 内联 HITL 操作卡片（渲染在消息气泡下方） */
export function HumanReviewCard({
  interruptData,
  onResume,
  isDark,
  isResolved,
}: HumanReviewCardProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState('');

  const actions = interruptData.actions ?? [
    { key: 'action_1', label: 'Approve', enable_feedback: false },
    { key: 'action_2', label: 'Reject', enable_feedback: true },
  ];

  const actionColors = ['blue', 'violet', 'teal', 'grape', 'pink', 'orange'];

  const handleActionClick = (act: HumanAction) => {
    if (isResolved) return;
    onResume(act.key, act.enable_feedback ? feedback.trim() || undefined : undefined);
  };

  return (
    <Box
      style={{
        margin: '4px 0 8px 0',
        borderRadius: 10,
        background: isResolved
          ? 'var(--flock-bg-surface)'
          : 'var(--flock-bg-raised)',
        border: `1px solid ${isResolved ? 'var(--flock-border-subtle)' : 'var(--flock-border-dim)'}`,
        overflow: 'hidden',
        opacity: isResolved ? 0.7 : 1,
      }}
    >
      {/* 标题行 */}
      <Box
        style={{
          padding: '7px 12px',
          background: 'var(--flock-bg-surface)',
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconUser size={12} style={{ color: 'var(--flock-accent)', flexShrink: 0 }} />
        <Text size="xs" fw={600} c={isDark ? 'orange.3' : 'orange.8'} style={{ flex: 1 }}>
          {interruptData.title || t('workflow.execution.humanReview', 'Human Review Required')}
        </Text>
        {isResolved && (
          <Badge size="xs" color="teal" variant="light">
            {t('workflow.execution.resolved', 'Resolved')}
          </Badge>
        )}
      </Box>

      {/* 操作内容及输入区域 */}
      {!isResolved && (
        <Box style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actions.map((act, idx) => {
            const isFirst = idx === 0;
            const btnColor = isFirst ? actionColors[0] : undefined;
            const btnVariant = isFirst ? 'filled' : 'default';

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
                style={{ justifyContent: 'flex-start', fontWeight: 600, width: '100%' }}
              >
                {act.label || act.key}
              </Button>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
