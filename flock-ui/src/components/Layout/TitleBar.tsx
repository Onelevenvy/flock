import { Box, ActionIcon, Group } from '@mantine/core';
import { IconMinus, IconSquare, IconX, IconCopy } from '@tabler/icons-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

export function TitleBar() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

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
      }}
    >
      <Group
        data-tauri-drag-region="false"
        gap={4}
        style={{
          marginLeft: 'auto',
          paddingRight: 8,
        }}
      >
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => appWindow.minimize()}
        >
          <IconMinus size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => appWindow.toggleMaximize()}
        >
          {isMaximized ? <IconCopy size={14} /> : <IconSquare size={14} />}
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          styles={{ root: { '&:hover': { background: '#e81123', color: 'white' } } }}
          onClick={() => appWindow.close()}
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </Box>
  );
}
