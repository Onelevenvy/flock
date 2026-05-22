import { Card, Group, ThemeIcon, Text, Stack, Grid, SegmentedControl, Divider } from '@mantine/core';
import { IconMoon, IconSun, IconLanguage } from '@tabler/icons-react';

interface UiSettingsCardProps {
  t: any;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
}

export function UiSettingsCard({ t, theme, setTheme, language, setLanguage }: UiSettingsCardProps) {
  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
      }}
      padding="xl"
    >
      <Group gap="xs" mb="xl">
        <ThemeIcon variant="light" color="blue" radius="md">
          {theme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
        </ThemeIcon>
        <Text fw={700} size="md">
          {t('systemSettings.uiSettings')}
        </Text>
      </Group>

      <Stack gap="lg">
        {/* 色彩主题 */}
        <Grid align="center">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Text size="sm" fw={600} mb={4}>
              {t('systemSettings.themeMode')}
            </Text>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Group justify="flex-end">
              <SegmentedControl
                value={theme}
                onChange={(val) => setTheme(val as 'light' | 'dark')}
                data={[
                  {
                    value: 'light',
                    label: (
                      <Group gap={6} wrap="nowrap">
                        <IconSun size={16} />
                        <Text size="sm">{t('systemSettings.lightMode')}</Text>
                      </Group>
                    ),
                  },
                  {
                    value: 'dark',
                    label: (
                      <Group gap={6} wrap="nowrap">
                        <IconMoon size={16} />
                        <Text size="sm">{t('systemSettings.darkMode')}</Text>
                      </Group>
                    ),
                  },
                ]}
                styles={{
                  root: {
                    background: 'var(--flock-bg-surface)',
                    border: '1px solid var(--flock-border-subtle)',
                    padding: 4,
                  },
                  control: {
                    minWidth: 120,
                  },
                }}
              />
            </Group>
          </Grid.Col>
        </Grid>

        <Divider color="var(--flock-border-subtle)" />

        {/* 语言设置 */}
        <Grid align="center">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Group gap={6} wrap="nowrap">
              <IconLanguage size={16} color="var(--flock-text-dim)" />
              <Text size="sm" fw={600}>
                {t('systemSettings.langSettings')}
              </Text>
            </Group>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Group justify="flex-end">
              <SegmentedControl
                value={language}
                onChange={(val) => setLanguage(val as 'zh' | 'en')}
                data={[
                  { value: 'zh', label: '简体中文' },
                  { value: 'en', label: 'English' },
                ]}
                styles={{
                  root: {
                    background: 'var(--flock-bg-surface)',
                    border: '1px solid var(--flock-border-subtle)',
                    padding: 4,
                  },
                  control: {
                    minWidth: 120,
                  },
                }}
              />
            </Group>
          </Grid.Col>
        </Grid>
      </Stack>
    </Card>
  );
}
