import { useCallback } from 'react';
import { Box, Group, Text, Button, ThemeIcon, Badge } from '@mantine/core';
import {
  IconUserHeart,
  IconPlayerPlay,
  IconX,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@/store/agentStore';
import { HumanTakeoverInfo } from '@/types/protocol';

interface HumanTakeoverBannerProps {
  takeover: HumanTakeoverInfo;
}

export function HumanTakeoverBanner({ takeover }: HumanTakeoverBannerProps) {
  const { t } = useTranslation();
  const clearHumanTakeover = useAgentStore((s) => s.clearHumanTakeover);

  const handleContinue = useCallback(async () => {
    clearHumanTakeover();
    try {
      await invoke('resume_tool', {
        callId: takeover.call_id,
        decision: 'human_done',
      });
    } catch (e) {
      console.error('[HumanTakeover] Failed to resume agent:', e);
    }
  }, [takeover.call_id, clearHumanTakeover]);

  const handleCancel = useCallback(async () => {
    clearHumanTakeover();
    try {
      await invoke('deny_tool', {
        callId: takeover.call_id,
        reason: t('chat.takeover.cancelledReason'),
      });
    } catch (e) {
      console.error('[HumanTakeover] Failed to cancel takeover:', e);
    }
  }, [takeover.call_id, clearHumanTakeover, t]);

  return (
    <Box
      style={{
        margin: '12px 16px',
        borderRadius: 12,
        background: 'var(--flock-bg-raised)',
        border: '1px solid rgba(21, 90, 239, 0.2)',
        overflow: 'hidden',
        animation: 'fadeIn 0.25s ease-out',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(21, 90, 239, 0.05)',
      }}
    >
      {/* 顶部标题栏 */}
      <Box
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(21, 90, 239, 0.06) 0%, rgba(21, 90, 239, 0.01) 100%)',
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <ThemeIcon size="md" color="blue" variant="light" radius="md" style={{ background: 'rgba(21, 90, 239, 0.1)' }}>
          <IconUserHeart size={16} />
        </ThemeIcon>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Group gap={8} align="center">
            <Text size="sm" fw={600} c="var(--flock-text-base)">
              {t('chat.takeover.title')}
            </Text>
            <Badge size="xs" color="blue" variant="light" style={{ fontWeight: 600 }}>
              {t('chat.takeover.badge')}
            </Badge>
          </Group>
        </Box>
        <Box
          style={{
            marginLeft: 'auto',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--flock-accent)',
            boxShadow: '0 0 0 2px rgba(21, 90, 239, 0.25)',
            animation: 'pulse 2s infinite ease-in-out',
          }}
        />
      </Box>

      {/* 消息提示 */}
      <Box style={{ padding: '16px' }}>
        <Text size="sm" c="var(--flock-text-base)" style={{ lineHeight: 1.6 }}>
          {takeover.message}
        </Text>
      </Box>

      {/* 操作按钮区 */}
      <Box
        style={{
          padding: '12px 16px',
          background: 'var(--flock-bg-surface)',
          borderTop: '1px solid var(--flock-border-dim)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Text size="xs" c="dimmed" style={{ lineHeight: 1.4 }}>
          {t('chat.takeover.hint')}
        </Text>

        <Group gap={8}>
          <Button
            size="xs"
            color="blue"
            variant="filled"
            leftSection={<IconPlayerPlay size={13} />}
            onClick={handleContinue}
            styles={{
              root: {
                background: 'var(--flock-accent)',
                boxShadow: '0 2px 6px rgba(21, 90, 239, 0.2)',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              },
            }}
          >
            {t('chat.takeover.btnContinue')}
          </Button>

          <Button
            size="xs"
            color="gray"
            variant="subtle"
            leftSection={<IconX size={14} />}
            onClick={handleCancel}
          >
            {t('chat.takeover.btnCancel')}
          </Button>
        </Group>
      </Box>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </Box>
  );
}
