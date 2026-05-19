import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Card,
  Group,
  SegmentedControl,
  ThemeIcon,
  Divider,
  Grid,
  NumberInput,
  Button,
  Badge,
  Tooltip,
  Switch,
} from '@mantine/core';
import {
  IconSun,
  IconMoon,
  IconDatabase,
  IconFolder,
  IconDeviceDesktop,
  IconInfoCircle,
  IconServer,
  IconSettings,
  IconCheck,
  IconHelpCircle,
  IconLanguage,
} from '@tabler/icons-react';
import { useUiStore } from '../../store/uiStore';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

export default function SystemSettings() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useUiStore();
  const [dbPath, setDbPath] = useState<string>('');
  const [workdir, setWorkdir] = useState<string>('');

  // 并发与缓存限制配置
  const [maxRunning, setMaxRunning] = useState<number>(4);
  const [maxCached, setMaxCached] = useState<number>(10);
  const [enableTitleSummary, setEnableTitleSummary] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      const [path, dir, dbMaxRunning, dbMaxCached, dbEnableTitleSummary] = await Promise.all([
        invoke<string>('get_db_path'),
        invoke<string | null>('get_workdir'),
        invoke<number | null>('get_app_config', { key: 'max_running_sessions' }),
        invoke<number | null>('get_app_config', { key: 'max_cached_sessions' }),
        invoke<boolean | null>('get_app_config', { key: 'enable_title_summary' }),
      ]);
      setDbPath(path);
      setWorkdir(dir || '__not_bound__');
      if (dbMaxRunning !== null) setMaxRunning(dbMaxRunning);
      if (dbMaxCached !== null) setMaxCached(dbMaxCached);
      if (dbEnableTitleSummary !== null) setEnableTitleSummary(dbEnableTitleSummary);
    } catch (e) {
      console.error('Failed to load system info:', e);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        invoke('set_app_config', { key: 'max_running_sessions', value: maxRunning }),
        invoke('set_app_config', { key: 'max_cached_sessions', value: maxCached }),
        invoke('set_app_config', { key: 'enable_title_summary', value: enableTitleSummary }),
      ]);
      notifications.show({
        title: t('common.success'),
        message: t('systemSettings.saveConfigSuccess'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
      notifications.show({
        title: t('common.failed'),
        message: t('systemSettings.saveConfigFailed'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="xl">
      {/* 外观设置 */}
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

      {/* 会话并发与缓存限制 */}
      <Card
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 16,
        }}
        padding="xl"
      >
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="cyan" radius="md">
              <IconServer size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              {t('systemSettings.sessionLimits')}
            </Text>
          </Group>
          <Badge color="cyan" variant="light">
            {t('systemSettings.resourceConfig')}
          </Badge>
        </Group>

        <Stack gap="lg">
          <Grid align="flex-start">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <NumberInput
                label={
                  <Group gap={6} wrap="nowrap" style={{ marginBottom: 4 }}>
                    <Text size="sm" fw={500}>{t('systemSettings.maxRunning')}</Text>
                    <Tooltip
                      label={t('systemSettings.maxRunningTooltip')}
                      multiline
                      w={260}
                      withArrow
                      position="top"
                    >
                      <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                    </Tooltip>
                  </Group>
                }
                min={1}
                max={20}
                value={maxRunning}
                onChange={(val) => setMaxRunning(typeof val === 'number' ? val : Number(val))}
                styles={{
                  input: { background: 'var(--flock-bg-surface)' },
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <NumberInput
                label={
                  <Group gap={6} wrap="nowrap" style={{ marginBottom: 4 }}>
                    <Text size="sm" fw={500}>{t('systemSettings.maxCached')}</Text>
                    <Tooltip
                      label={t('systemSettings.maxCachedTooltip')}
                      multiline
                      w={260}
                      withArrow
                      position="top"
                    >
                      <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                    </Tooltip>
                  </Group>
                }
                min={2}
                max={100}
                value={maxCached}
                onChange={(val) => setMaxCached(typeof val === 'number' ? val : Number(val))}
                styles={{
                  input: { background: 'var(--flock-bg-surface)' },
                }}
              />
            </Grid.Col>
          </Grid>

          <Divider color="var(--flock-border-subtle)" />

          {/* 自动总结标题 */}
          <Group justify="space-between" align="center">
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={500}>{t('systemSettings.enableTitleSummary')}</Text>
              <Tooltip
                label={t('systemSettings.enableTitleSummaryTooltip')}
                multiline
                w={280}
                withArrow
                position="top"
              >
                <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
              </Tooltip>
            </Group>
            <Switch
              checked={enableTitleSummary}
              onChange={(e) => setEnableTitleSummary(e.currentTarget.checked)}
              styles={{
                track: { cursor: 'pointer' },
              }}
            />
          </Group>

          <Divider color="var(--flock-border-subtle)" />

          <Group justify="flex-end">
            <Button
              variant="filled"
              color="blue"
              leftSection={<IconSettings size={16} />}
              onClick={handleSaveSettings}
              loading={saving}
              styles={{
                root: {
                  boxShadow: '0 4px 12px rgba(21, 90, 239, 0.25)',
                },
              }}
            >
              {t('systemSettings.saveConfig')}
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* 系统环境信息 */}
      <Card
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 16,
        }}
        padding="xl"
      >
        <Group gap="xs" mb="xl">
          <ThemeIcon variant="light" color="teal" radius="md">
            <IconInfoCircle size={18} />
          </ThemeIcon>
          <Text fw={700} size="md">
            {t('systemSettings.systemInfo')}
          </Text>
        </Group>

        <Stack gap="md">
          {/* 工作区路径 */}
          <Group align="flex-start" wrap="nowrap">
            <IconFolder size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('systemSettings.workspaceDir')}
              </Text>
              <Text size="sm" fw={500} style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {workdir === '__not_bound__' ? t('systemSettings.notBound') : (workdir || t('common.loading'))}
              </Text>
            </div>
          </Group>

          <Divider color="var(--flock-border-subtle)" />

          {/* 数据库路径 */}
          <Group align="flex-start" wrap="nowrap">
            <IconDatabase size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('systemSettings.databasePath')}
              </Text>
              <Text size="sm" fw={500} style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {dbPath || t('common.loading')}
              </Text>
            </div>
          </Group>

          <Divider color="var(--flock-border-subtle)" />

          {/* 操作系统和版本 */}
          <Group align="flex-start" wrap="nowrap">
            <IconDeviceDesktop size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
            <div>
              <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('systemSettings.sysVersionInfo')}
              </Text>
              <Group gap="sm" mt={2}>
                <Text size="sm" fw={500}>
                  {t('systemSettings.os')}: <span style={{ fontWeight: 600 }}>Windows</span>
                </Text>
                <Text size="xs" c="dimmed">|</Text>
                <Text size="sm" fw={500}>
                  {t('systemSettings.clientVersion')}: <span style={{ fontWeight: 600 }}>v0.1.0</span>
                </Text>
              </Group>
            </div>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
