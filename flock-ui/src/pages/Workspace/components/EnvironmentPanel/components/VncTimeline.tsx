import { Box, Text, ActionIcon, Slider, Group, Tooltip } from '@mantine/core';
import {
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ScreenshotInfo } from '../utils/vncUtils';

interface VncTimelineProps {
  screenshots: ScreenshotInfo[];
  isPlaybackMode: boolean;
  isOfflineMode: boolean;
  playbackIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onGoLive: () => void;
  onChangeIndex: (index: number) => void;
}

export function VncTimeline({
  screenshots,
  isPlaybackMode,
  isOfflineMode,
  playbackIndex,
  onPrev,
  onNext,
  onGoLive,
  onChangeIndex,
}: VncTimelineProps) {
  const { t } = useTranslation();

  if (screenshots.length === 0) return null;

  return (
    <Box
      style={{
        marginTop: '8px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'var(--flock-bg-deep)',
        border: '1px solid var(--flock-border-dim)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap={8}>
          <Tooltip label={t('chat.vnc.prevStep')} withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onPrev}
              disabled={screenshots.length <= 1}
            >
              <IconPlayerSkipBack size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('chat.vnc.nextStep')} withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onNext}
              disabled={screenshots.length <= 1}
            >
              <IconPlayerSkipForward size={14} />
            </ActionIcon>
          </Tooltip>

          {isPlaybackMode && !isOfflineMode && (
            <Tooltip label={t('chat.vnc.backToLive')} withArrow>
              <ActionIcon variant="light" color="teal" size="sm" onClick={onGoLive}>
                <IconDeviceDesktop size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <Text size="xs" fw={500} c={isPlaybackMode ? 'orange' : 'teal'}>
          {isPlaybackMode
            ? t('chat.vnc.playbackStatus', { current: playbackIndex + 1, total: screenshots.length })
            : isOfflineMode
              ? t('chat.vnc.offlineReplayTotal', { total: screenshots.length, defaultValue: `Replay total ${screenshots.length} steps` })
              : t('chat.vnc.liveStatusWithTotal', { total: screenshots.length })}
        </Text>
      </Group>

      <Box style={{ padding: '0 8px' }}>
        <Slider
          min={0}
          max={screenshots.length - (isOfflineMode ? 1 : 0)}
          value={
            playbackIndex === -1
              ? isOfflineMode
                ? screenshots.length - 1
                : screenshots.length
              : playbackIndex
          }
          onChange={(val) => {
            if (!isOfflineMode && val === screenshots.length) {
              onChangeIndex(-1);
            } else {
              onChangeIndex(val);
            }
          }}
          label={(val) => {
            if (!isOfflineMode && val === screenshots.length)
              return t('chat.vnc.liveLabel');
            const actionDesc = screenshots[val]?.action
              ? ` (${screenshots[val].action})`
              : '';
            return t('chat.vnc.stepLabel', { index: val + 1 }) + actionDesc;
          }}
          step={1}
          color={isPlaybackMode ? 'orange' : 'teal'}
          styles={{
            track: { background: 'var(--flock-border-dim)', height: '6px' },
            bar: { height: '6px' },
            thumb: {
              border: isPlaybackMode
                ? '2px solid var(--mantine-color-orange-5)'
                : '2px solid var(--mantine-color-teal-5)',
              width: '16px',
              height: '16px',
            },
          }}
        />
      </Box>
    </Box>
  );
}
