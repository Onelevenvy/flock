import { Box, Group, Tooltip, ActionIcon, UnstyledButton, Text } from '@mantine/core';
import { IconSettings, IconBrandGithub, IconStar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from '@/store/uiStore';
import { useGithubStars } from '@/hooks/useGithubStars';
import { ThemeToggle } from '@/components/Common/ThemeToggle';

export function BottomBar() {
  const { t } = useTranslation();
  const { setSettingsOpen } = useUiStore();
  const { stars } = useGithubStars();

  return (
    <Box style={{ padding: '12px 16px', borderTop: '1px solid var(--flock-border-dim)' }}>
      <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          {/* 设置按钮 */}
          <Tooltip label={t('common.settings')} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <IconSettings size={16} />
            </ActionIcon>
          </Tooltip>
          
          {/* 主题切换按钮 */}
          <ThemeToggle />
        </Group>

        {/* GitHub 图标 + Star 数量 */}
        <UnstyledButton
          onClick={() => {
            invoke('open_external_url', { url: 'https://github.com/Onelevenvy/flock' })
              .catch(console.error);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            borderRadius: 8,
            transition: 'background 0.2s',
            background: 'var(--flock-bg-surface)',
            border: '1px solid var(--flock-border-dim)',
          }}
          className="hover-bg-raised"
        >
          <IconBrandGithub size={16} style={{ color: 'var(--flock-text-bright)' }} />
          <Group gap={3} wrap="nowrap">
            <IconStar size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)', lineHeight: 1 }}>
              {stars !== null ? (stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars) : '--'}
            </Text>
          </Group>
        </UnstyledButton>
      </Group>
    </Box>
  );
}
