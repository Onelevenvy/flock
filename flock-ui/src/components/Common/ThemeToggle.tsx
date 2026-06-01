import { ActionIcon, Tooltip } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useUiStore();
  const isDark = theme === 'dark';

  return (
    <Tooltip label={isDark ? t('common.switchToLight') : t('common.switchToDark')} withArrow>
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
