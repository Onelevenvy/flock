import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Card,
  Group,
  ThemeIcon,
  Button,
  Switch,
  TextInput,
  PasswordInput,
  Tooltip,
  Divider,
  Badge,
  Alert,
} from '@mantine/core';
import {
  IconServer,
  IconKey,
  IconCheck,
  IconAlertCircle,
  IconPlayerPlay,
  IconShieldLock,
  IconHelpCircle,
  IconCamera,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

interface SandboxConfig {
  enabled: boolean;
  api_url: string | null;
  api_key: string | null;
  snapshot: string | null;
}

export default function SandboxSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://app.daytona.io');
  const [apiKey, setApiKey] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    loadSandboxConfig();
  }, []);

  const loadSandboxConfig = async () => {
    try {
      const config = await invoke<SandboxConfig | null>('get_app_config', { key: 'sandbox' });
      if (config) {
        setEnabled(config.enabled);
        if (config.api_url) setApiUrl(config.api_url);
        if (config.api_key) setApiKey(config.api_key);
        if (config.snapshot) setSnapshot(config.snapshot);
      }
    } catch (e) {
      console.error('Failed to load sandbox config:', e);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await invoke('set_app_config', {
        key: 'sandbox',
        value: {
          enabled,
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          snapshot: snapshot.trim() || null,
        },
      });
      notifications.show({
        title: t('settings.sandbox.saveSuccess'),
        message: t('settings.sandbox.saveSuccessMsg'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('Failed to save sandbox config:', e);
      notifications.show({
        title: t('settings.sandbox.saveFailed'),
        message: t('settings.sandbox.saveFailedMsg'),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      notifications.show({
        title: t('common.failed'),
        message: t('settings.sandbox.testMissingFields'),
        color: 'yellow',
      });
      return;
    }

    setTesting(true);
    try {
      await invoke<string>('test_sandbox_connection', {
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
      });
      notifications.show({
        title: t('settings.sandbox.testOk'),
        message: t('settings.sandbox.testOkMsg'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('Daytona connection test failed:', e);
      notifications.show({
        title: t('settings.sandbox.testFailed'),
        message: t('settings.sandbox.testFailedMsg', { error: String(e) }),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setTesting(false);
    }
  };

  const defaultSnapshotName = 'flock-playwright';

  const handleCreateSnapshot = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      notifications.show({
        title: t('common.failed'),
        message: t('settings.sandbox.testMissingFields'),
        color: 'yellow',
      });
      return;
    }

    const snapName = snapshot.trim() || defaultSnapshotName;
    setCreatingSnapshot(true);

    // 先保存配置（确保 Rust 侧能读到 API 信息）
    try {
      await invoke('set_app_config', {
        key: 'sandbox',
        value: {
          enabled,
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          snapshot: snapshot.trim() || null,
        },
      });
    } catch (_) { /* ignore */ }

    try {
      await invoke<string>('create_playwright_snapshot', { snapshotName: snapName });
      // 自动填入 snapshot 名称
      setSnapshot(snapName);
      await invoke('set_app_config', {
        key: 'sandbox',
        value: {
          enabled,
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          snapshot: snapName,
        },
      });
      notifications.show({
        title: t('settings.sandbox.snapshotDone'),
        message: t('settings.sandbox.snapshotDoneMsg', { name: snapName }),
        color: 'teal',
        icon: <IconCheck size={18} />,
        autoClose: 8000,
      });
    } catch (e) {
      notifications.show({
        title: t('settings.sandbox.snapshotFailed'),
        message: String(e),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
        autoClose: 10000,
      });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  return (
    <Stack gap="xl">
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
            <ThemeIcon variant="light" color="blue" radius="md">
              <IconShieldLock size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              {t('settings.sandbox.title')}
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={500}>{t('settings.sandbox.enable')}</Text>
            <Tooltip
              label={t('settings.sandbox.enableTooltip')}
              multiline
              w={280}
              withArrow
              position="top"
            >
              <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
            </Tooltip>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
              styles={{
                track: { cursor: 'pointer' },
              }}
            />
          </Group>
        </Group>

        <Divider color="var(--flock-border-subtle)" mb="lg" />

        <Stack gap="lg">
          <TextInput
            label={
              <Group gap={6} style={{ marginBottom: 4 }}>
                <IconServer size={14} color="var(--flock-text-dim)" />
                <Text size="sm" fw={500}>{t('settings.sandbox.apiUrl')}</Text>
                <Tooltip
                  label={t('settings.sandbox.apiUrlTooltip')}
                  multiline
                  w={280}
                  withArrow
                  position="top"
                >
                  <IconHelpCircle size={13} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            }
            placeholder={t('settings.sandbox.apiUrlPlaceholder')}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.currentTarget.value)}
            disabled={!enabled}
            styles={{
              input: { background: 'var(--flock-bg-surface)' },
            }}
          />

          <PasswordInput
            label={
              <Group gap={6} style={{ marginBottom: 4 }}>
                <IconKey size={14} color="var(--flock-text-dim)" />
                <Text size="sm" fw={500}>{t('settings.sandbox.apiKey')}</Text>
              </Group>
            }
            placeholder={t('settings.sandbox.apiKeyPlaceholder')}
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            disabled={!enabled}
            styles={{
              input: { background: 'var(--flock-bg-surface)' },
            }}
          />

          {/* Snapshot 设置区 */}
          <Stack gap="xs">
            <TextInput
              label={
                <Group gap={6} style={{ marginBottom: 4 }}>
                  <IconCamera size={14} color="var(--flock-text-dim)" />
                  <Text size="sm" fw={500}>{t('settings.sandbox.snapshotName')}</Text>
                  <Tooltip
                    label={t('settings.sandbox.snapshotTooltip')}
                    multiline
                    w={300}
                    withArrow
                    position="top"
                  >
                    <IconHelpCircle size={13} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                  </Tooltip>
                  {snapshot.trim() && (
                    <Badge size="xs" color="teal" variant="dot">
                      {t('settings.sandbox.snapshotActive')}
                    </Badge>
                  )}
                </Group>
              }
              placeholder={defaultSnapshotName}
              value={snapshot}
              onChange={(e) => setSnapshot(e.currentTarget.value)}
              disabled={!enabled}
              styles={{
                input: { background: 'var(--flock-bg-surface)' },
              }}
            />

            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
              variant="light"
              radius="md"
              style={{ fontSize: 12 }}
            >
              {t('settings.sandbox.snapshotHint')}
            </Alert>

            <Button
              variant="outline"
              color="violet"
              size="sm"
              leftSection={<IconCamera size={15} />}
              onClick={handleCreateSnapshot}
              loading={creatingSnapshot}
              disabled={!enabled || !apiUrl.trim() || !apiKey.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              {creatingSnapshot
                ? t('settings.sandbox.snapshotCreating')
                : t('settings.sandbox.snapshotCreateBtn')}
            </Button>
          </Stack>

          <Divider color="var(--flock-border-subtle)" mt="md" />

          <Group justify="space-between" gap="md">
            <Button
              variant="outline"
              color="red"
              leftSection={<IconTrash size={15} />}
              onClick={async () => {
                if (!enabled) return;
                setCleaningUp(true);
                try {
                  const msg = await invoke<string>('cleanup_all_sandboxes');
                  notifications.show({
                    title: t('settings.sandbox.cleanupDone'),
                    message: msg,
                    color: 'teal',
                    icon: <IconCheck size={18} />,
                  });
                } catch (e) {
                  notifications.show({
                    title: t('settings.sandbox.cleanupFailed'),
                    message: String(e),
                    color: 'red',
                    icon: <IconAlertCircle size={18} />,
                  });
                } finally {
                  setCleaningUp(false);
                }
              }}
              loading={cleaningUp}
              disabled={!enabled}
            >
              {t('settings.sandbox.cleanupBtn')}
            </Button>

            <Group gap="md">
            <Button
              variant="outline"
              color="gray"
              onClick={handleTestConnection}
              loading={testing}
              disabled={!enabled}
            >
              {t('settings.sandbox.testBtn')}
            </Button>
            <Button
              variant="filled"
              color="blue"
              leftSection={<IconPlayerPlay size={16} />}
              onClick={handleSaveSettings}
              loading={saving}
              styles={{
                root: {
                  boxShadow: '0 4px 12px rgba(21, 90, 239, 0.25)',
                },
              }}
            >
              {t('common.save') || '保存'}
            </Button>
            </Group>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
