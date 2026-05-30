import { useCallback } from 'react';
import { Box, Group, Text, Button, ThemeIcon, Badge } from '@mantine/core';
import {
  IconUserHeart,
  IconPlayerPlay,
  IconX,
  IconExternalLink,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '../../../../store/agentStore';
import { useUiStore } from '../../../../store/uiStore';
import { HumanTakeoverInfo } from '../../../../types/protocol';

interface HumanTakeoverBannerProps {
  takeover: HumanTakeoverInfo;
}

export function HumanTakeoverBanner({ takeover }: HumanTakeoverBannerProps) {
  const { t } = useTranslation();
  const clearHumanTakeover = useAgentStore((s) => s.clearHumanTakeover);
  const setPreviewFile = useUiStore((s) => s.setPreviewFile);

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

  const handleOpenVnc = useCallback(() => {
    if (takeover.remote_url) {
      setPreviewFile({
        path: takeover.remote_url,
        content: '',
        extension: 'vnc',
      });
    }
  }, [takeover.remote_url, setPreviewFile]);

  return (
    <Box
      style={{
        margin: '8px 16px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(21, 90, 239, 0.06) 0%, rgba(21, 90, 239, 0.02) 100%)',
        border: '1.5px solid var(--flock-accent)',
        overflow: 'hidden',
        animation: 'fadeIn 0.25s ease-out',
        boxShadow: '0 2px 12px rgba(21, 90, 239, 0.12)',
      }}
    >
      {/* 顶部标题栏 */}
      <Box
        style={{
          padding: '10px 14px 8px',
          background: 'rgba(21, 90, 239, 0.08)',
          borderBottom: '1px solid rgba(21, 90, 239, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ThemeIcon size="sm" color="blue" variant="light" radius="sm">
          <IconUserHeart size={14} />
        </ThemeIcon>
        <Text size="sm" fw={700} c="blue.5">
          {t('chat.takeover.title')}
        </Text>
        <Badge size="xs" color="blue" variant="dot" style={{ marginLeft: 4 }}>
          {t('chat.takeover.badge')}
        </Badge>
        <Box
          style={{
            marginLeft: 'auto',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#155aef',
            boxShadow: '0 0 0 2px rgba(21, 90, 239, 0.3)',
            animation: 'pulse 1.5s infinite',
          }}
        />
      </Box>

      {/* 消息提示 */}
      <Box style={{ padding: '10px 14px 6px' }}>
        <Text size="sm" c="var(--flock-text-base)" style={{ lineHeight: 1.6 }}>
          {takeover.message}
        </Text>
      </Box>

      {/* 操作按钮区 */}
      <Box
        style={{
          padding: '10px 14px 12px',
          borderTop: '1px solid rgba(21, 90, 239, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Text size="xs" c="dimmed" style={{ marginBottom: 2 }}>
          {t('chat.takeover.hint')}
        </Text>

        <Group gap={8} wrap="wrap">
          <Button
            size="xs"
            color="blue"
            variant="filled"
            leftSection={<IconPlayerPlay size={13} />}
            onClick={handleContinue}
            styles={{
              root: {
                boxShadow: '0 2px 8px rgba(21, 90, 239, 0.25)',
                transition: 'all 0.2s ease',
              },
            }}
          >
            {t('chat.takeover.btnContinue')}
          </Button>

          {takeover.remote_url && (
            <Button
              size="xs"
              color="gray"
              variant="outline"
              leftSection={<IconExternalLink size={13} />}
              onClick={handleOpenVnc}
            >
              {t('chat.takeover.btnOpenVnc')}
            </Button>
          )}

          <Button
            size="xs"
            color="gray"
            variant="subtle"
            leftSection={<IconX size={13} />}
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
