import { ActionIcon, Tooltip } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useUiStore } from '../../store/uiStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useUiStore();
  const isDark = theme === 'dark';

  return (
    <Tooltip label={isDark ? '切换浅色模式' : '切换深色模式'} withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}
