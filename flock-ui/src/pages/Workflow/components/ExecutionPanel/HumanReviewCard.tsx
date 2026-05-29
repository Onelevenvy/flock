import { useState } from 'react';
import {
  Box,
  Text,
  Badge,
  Button,
  Textarea,
  Group,
} from '@mantine/core';
import {
  IconUser,
  IconCheck,
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
  const [pendingAction, setPendingAction] = useState<HumanAction | null>(null);
  const [feedback, setFeedback] = useState('');

  const actions = interruptData.actions ?? [
    { key: 'action_1', label: 'Approve', enable_feedback: false },
    { key: 'action_2', label: 'Reject', enable_feedback: true },
  ];

  const actionColors = ['blue', 'violet', 'teal', 'grape', 'pink', 'orange'];

  const handleActionClick = (act: HumanAction) => {
    if (isResolved) return;
    if (act.enable_feedback) {
      // 先展开 feedback 输入框
      setPendingAction(act);
      setFeedback('');
    } else {
      onResume(act.key);
    }
  };

  const handleConfirmWithFeedback = () => {
    if (!pendingAction) return;
    onResume(pendingAction.key, feedback.trim() || undefined);
    setPendingAction(null);
    setFeedback('');
  };

  const handleCancelFeedback = () => {
    setPendingAction(null);
    setFeedback('');
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

      {/* 操作按钮 */}
      {!isResolved && !pendingAction && (
        <Box style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actions.map((act, idx) => (
            <Button
              key={act.key}
              size="xs"
              variant={idx === 0 ? 'filled' : 'default'}
              color={idx === 0 ? actionColors[0] : undefined}
              onClick={() => handleActionClick(act)}
              style={{ justifyContent: 'flex-start', fontWeight: 600 }}
              leftSection={act.enable_feedback ? <IconUser size={11} /> : undefined}
            >
              {act.label || act.key}
            </Button>
          ))}
        </Box>
      )}

      {/* Feedback 输入区（点击某个 enable_feedback 的 action 后展示） */}
      {!isResolved && pendingAction && (
        <Box style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text size="xs" c="dimmed">
            {pendingAction.label} — {t('workflow.execution.feedbackOptional', 'Add optional comment:')}
          </Text>
          <Textarea
            placeholder={t('workflow.execution.feedbackPlaceholder', 'Add optional comment...')}
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            size="xs"
            minRows={2}
            autoFocus
            styles={{
              input: {
                fontSize: '12px',
                backgroundColor: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleConfirmWithFeedback();
              }
              if (e.key === 'Escape') {
                handleCancelFeedback();
              }
            }}
          />
          <Group gap="xs">
            <Button
              size="xs"
              color="blue"
              leftSection={<IconCheck size={11} />}
              onClick={handleConfirmWithFeedback}
              style={{ flex: 1 }}
            >
              {t('workflow.execution.confirmAction', 'Confirm')} — {pendingAction.label}
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={handleCancelFeedback}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </Group>
        </Box>
      )}
    </Box>
  );
}
