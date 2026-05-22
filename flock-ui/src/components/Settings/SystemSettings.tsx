import { useState, useEffect } from 'react';
import { Stack } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useUiStore } from '../../store/uiStore';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { UiSettingsCard } from './SystemSettings/UiSettingsCard';
import { SessionLimitsCard } from './SystemSettings/SessionLimitsCard';
import { SystemInfoCard } from './SystemSettings/SystemInfoCard';

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
      <UiSettingsCard
        t={t}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
      />

      <SessionLimitsCard
        t={t}
        maxRunning={maxRunning}
        setMaxRunning={setMaxRunning}
        maxCached={maxCached}
        setMaxCached={setMaxCached}
        enableTitleSummary={enableTitleSummary}
        setEnableTitleSummary={setEnableTitleSummary}
        saving={saving}
        onSave={handleSaveSettings}
      />

      <SystemInfoCard
        t={t}
        workdir={workdir}
        dbPath={dbPath}
      />
    </Stack>
  );
}
