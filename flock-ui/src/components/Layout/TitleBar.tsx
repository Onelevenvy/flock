import { Box, ActionIcon, Group } from '@mantine/core';
import { IconMinus, IconSquare, IconX, IconCopy } from '@tabler/icons-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

export function TitleBar() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
  const [isMacHovered, setIsMacHovered] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    // Detect operating system from userAgent
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) {
      setPlatform('macos');
    } else if (userAgent.includes('linux')) {
      setPlatform('linux');
    } else {
      setPlatform('windows');
    }

    return () => {
      unlisten.then(fn => fn());
    };
  }, [appWindow]);

  // MacOS Traffic Light Style Controls
  const renderMacControls = () => (
    <Group
      data-tauri-drag-region="false"
      gap={8}
      style={{
        paddingLeft: 14,
        paddingRight: 10,
        height: '100%',
        alignItems: 'center',
      }}
      onMouseEnter={() => setIsMacHovered(true)}
      onMouseLeave={() => setIsMacHovered(false)}
    >
      {/* Close button */}
      <Box
        onClick={() => appWindow.close()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#ff5f56',
          border: '0.5px solid #e0443e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#4c0002',
            opacity: isMacHovered ? 0.8 : 0,
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
            lineHeight: 1,
            transform: 'scale(0.8) translateY(-0.5px)',
          }}
        >
          ✕
        </span>
      </Box>

      {/* Minimize button */}
      <Box
        onClick={() => appWindow.minimize()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#ffbd2e',
          border: '0.5px solid #dfa224',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#5c3e00',
            opacity: isMacHovered ? 0.8 : 0,
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
            lineHeight: 1,
            transform: 'scale(1.2) translateY(-2px)',
          }}
        >
          -
        </span>
      </Box>

      {/* Maximize button */}
      <Box
        onClick={() => appWindow.toggleMaximize()}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#27c93f',
          border: '0.5px solid #1a9c2b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: '#024d07',
            opacity: isMacHovered ? 0.8 : 0,
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
            lineHeight: 1,
            transform: 'scale(0.8)',
          }}
        >
          ➕
        </span>
      </Box>
    </Group>
  );

  // Windows Style Controls
  const renderWindowsControls = () => (
    <Group
      data-tauri-drag-region="false"
      gap={0}
      style={{
        marginLeft: 'auto',
        height: '100%',
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        radius={0}
        style={{
          width: 46,
          height: '100%',
        }}
        styles={{
          root: {
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--mantine-color-white)',
            },
          },
        }}
        onClick={() => appWindow.minimize()}
      >
        <IconMinus size={16} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        radius={0}
        style={{
          width: 46,
          height: '100%',
        }}
        styles={{
          root: {
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--mantine-color-white)',
            },
          },
        }}
        onClick={() => appWindow.toggleMaximize()}
      >
        {isMaximized ? <IconCopy size={14} /> : <IconSquare size={14} />}
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        radius={0}
        style={{
          width: 46,
          height: '100%',
        }}
        styles={{
          root: {
            '&:hover': {
              background: '#e81123',
              color: 'white',
            },
          },
        }}
        onClick={() => appWindow.close()}
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );

  // Linux (Ubuntu Yaru / GNOME Style) Controls
  const renderLinuxControls = () => (
    <Group
      data-tauri-drag-region="false"
      gap={6}
      style={{
        marginLeft: 'auto',
        paddingRight: 10,
        height: '100%',
        alignItems: 'center',
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        radius="xl"
        size="md"
        styles={{
          root: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
            },
          },
        }}
        onClick={() => appWindow.minimize()}
      >
        <IconMinus size={14} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        radius="xl"
        size="md"
        styles={{
          root: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
            },
          },
        }}
        onClick={() => appWindow.toggleMaximize()}
      >
        {isMaximized ? <IconCopy size={12} /> : <IconSquare size={12} />}
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        radius="xl"
        size="md"
        styles={{
          root: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            '&:hover': {
              backgroundColor: '#E95420', // Yaru Orange
              color: 'white',
              borderColor: '#E95420',
            },
          },
        }}
        onClick={() => appWindow.close()}
      >
        <IconX size={14} />
      </ActionIcon>
    </Group>
  );

  return (
    <Box
      data-tauri-drag-region
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        background: 'transparent',
        flexShrink: 0,
        position: 'relative',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {platform === 'macos' && renderMacControls()}
      {platform === 'windows' && renderWindowsControls()}
      {platform === 'linux' && renderLinuxControls()}
    </Box>
  );
}
