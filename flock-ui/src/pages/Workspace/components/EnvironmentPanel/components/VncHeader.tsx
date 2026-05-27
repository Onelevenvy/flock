import { Box, Text, ActionIcon, Group, Badge, Tooltip } from '@mantine/core';
import { IconRefresh, IconExternalLink, IconDeviceDesktop } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface VncHeaderProps {
  isOfflineMode: boolean;
  isPlaybackMode: boolean;
  formattedVncUrl: string;
  playbackIndex: number;
  screenshotCount: number;
}

export function VncHeader({
  isOfflineMode,
  isPlaybackMode,
  formattedVncUrl,
  playbackIndex,
  screenshotCount,
}: VncHeaderProps) {
  const { t } = useTranslation();

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--flock-border-dim)',
        paddingBottom: '8px',
      }}
    >
      <Group gap={8}>
        <IconDeviceDesktop size={14} color="var(--flock-accent)" />
        <Text
          size="xs"
          fw={700}
          style={{ color: 'var(--flock-text-bright)', letterSpacing: '0.5px' }}
        >
          {isOfflineMode
            ? t('chat.vnc.screenshotPlaybackTitle', { defaultValue: 'DESKTOP PLAYBACK' })
            : t('chat.vnc.liveDesktopTitle', { defaultValue: 'LIVE DESKTOP' })}
        </Text>
      </Group>

      <Group gap="xs">
        {!isPlaybackMode && !isOfflineMode && (
          <Group gap={6} mr={6}>
            <Tooltip label={t('chat.vnc.openInBrowser')} withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => window.open(formattedVncUrl, '_blank')}
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('chat.vnc.reloadConsole')} withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                onClick={() => {
                  const iframe = document.getElementById('flock-vnc-iframe') as HTMLIFrameElement | null;
                  if (iframe) {
                    iframe.src = formattedVncUrl;
                  }
                }}
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {isPlaybackMode ? (
          <Badge variant="light" color="orange" size="sm" style={{ height: 24, fontSize: '11px' }}>
            {t('chat.vnc.playbackMode', { current: playbackIndex + 1, total: screenshotCount })}
          </Badge>
        ) : isOfflineMode ? (
          <Badge variant="light" color="gray" size="sm" style={{ height: 24, fontSize: '11px' }}>
            {t('chat.vnc.offlineReplay', { defaultValue: 'Offline History' })}
          </Badge>
        ) : (
          <Badge
            variant="light"
            color="teal"
            size="sm"
            style={{ height: 24, fontSize: '11px' }}
            leftSection={
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#2ecc71',
                  display: 'inline-block',
                  animation: 'pulse-live 1.5s infinite',
                }}
              />
            }
          >
            {t('chat.vnc.liveStatus')}
          </Badge>
        )}
        <style>{`
          @keyframes pulse-live {
            0% { transform: scale(0.9); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.6; }
          }
        `}</style>
      </Group>
    </Box>
  );
}
