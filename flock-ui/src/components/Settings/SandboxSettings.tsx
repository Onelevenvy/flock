import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Card,
  Group,
  ThemeIcon,
  Button,
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
  IconShieldLock,
  IconHelpCircle,
  IconCamera,
  IconInfoCircle,
  IconTrash,
  IconPlugConnected,
  IconPlugConnectedX,
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

interface ToolProvider {
  id: string;
  is_available: boolean;
}

export default function SandboxSettings() {
  const { t } = useTranslation();
  const [apiUrl, setApiUrl] = useState('https://app.daytona.io');
  const [apiKey, setApiKey] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const [testing, setTesting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  // Reflects the DB is_available state for the sandbox provider
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  /** Load sandbox config from app_config + sandbox provider availability from DB */
  const loadAll = async () => {
    try {
      const [config, providers] = await Promise.all([
        invoke<SandboxConfig | null>('get_app_config', { key: 'sandbox' }),
        invoke<ToolProvider[]>('list_tool_providers'),
      ]);
      if (config) {
        if (config.api_url) setApiUrl(config.api_url);
        if (config.api_key) setApiKey(config.api_key);
        if (config.snapshot) setSnapshot(config.snapshot);
      }
      const sandboxProvider = providers.find((p) => p.id === 'sandbox');
      setIsAvailable(sandboxProvider?.is_available ?? false);
    } catch (e) {
      console.error('Failed to load sandbox config:', e);
    }
  };

  /** Save config helper (does NOT toggle availability) */
  const saveConfig = async (overrides?: Partial<SandboxConfig>) => {
    await invoke('set_app_config', {
      key: 'sandbox',
      value: {
        enabled: isAvailable,
        api_url: apiUrl.trim(),
        api_key: apiKey.trim(),
        snapshot: snapshot.trim() || null,
        ...overrides,
      },
    });
  };

  /**
   * Test connectivity.
   * On success: auto-save config with enabled=true → Rust marks sandbox available.
   * On failure: Rust marks sandbox unavailable.
   */
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
      // Save config first so Rust side can read the credentials if needed
      await saveConfig({ enabled: true });

      await invoke<string>('test_sandbox_connection', {
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
      });

      // Rust already marked provider available; reflect that locally
      setIsAvailable(true);

      notifications.show({
        title: t('settings.sandbox.testOkAutoEnabled'),
        message: t('settings.sandbox.testOkMsg'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      setIsAvailable(false);
      // Also persist enabled=false on failure
      await saveConfig({ enabled: false }).catch(() => {});
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

  /** Disable the sandbox. User must re-test to re-enable. */
  const handleDisable = async () => {
    setDisabling(true);
    try {
      // set_app_config with enabled=false triggers Rust to mark provider unavailable
      await saveConfig({ enabled: false });
      setIsAvailable(false);
      notifications.show({
        title: t('settings.sandbox.disableSuccess'),
        message: t('settings.sandbox.disableSuccessMsg'),
        color: 'orange',
        icon: <IconPlugConnectedX size={18} />,
      });
    } catch (e) {
      notifications.show({
        title: t('settings.sandbox.saveFailed'),
        message: String(e),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setDisabling(false);
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

    try {
      await saveConfig();
    } catch (_) { /* ignore */ }

    try {
      await invoke<string>('create_playwright_snapshot', { snapshotName: snapName });
      setSnapshot(snapName);
      await saveConfig({ snapshot: snapName });
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
        {/* Header */}
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" radius="md">
              <IconShieldLock size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              {t('settings.sandbox.title')}
            </Text>
          </Group>

          {/* Status badge — shows current DB availability */}
          {isAvailable ? (
            <Badge
              color="teal"
              variant="light"
              leftSection={<IconPlugConnected size={12} />}
            >
              {t('settings.sandbox.statusActive')}
            </Badge>
          ) : (
            <Badge
              color="gray"
              variant="light"
              leftSection={<IconPlugConnectedX size={12} />}
            >
              {t('settings.sandbox.statusInactive')}
            </Badge>
          )}
        </Group>

        <Divider color="var(--flock-border-subtle)" mb="lg" />

        {/* Disabled hint */}
        {!isAvailable && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            radius="md"
            mb="lg"
          >
            {t('settings.sandbox.retestHint')}
          </Alert>
        )}

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
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
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
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
          />

          {/* Snapshot section — only useful once connected */}
          {isAvailable && (
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
                styles={{ input: { background: 'var(--flock-bg-surface)' } }}
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
                style={{ alignSelf: 'flex-start' }}
              >
                {creatingSnapshot
                  ? t('settings.sandbox.snapshotCreating')
                  : t('settings.sandbox.snapshotCreateBtn')}
              </Button>
            </Stack>
          )}

          <Divider color="var(--flock-border-subtle)" mt="md" />

          <Group justify="space-between" gap="md">
            {/* Cleanup — only available when connected */}
            {isAvailable && (
              <Button
                variant="outline"
                color="red"
                leftSection={<IconTrash size={15} />}
                onClick={async () => {
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
              >
                {t('settings.sandbox.cleanupBtn')}
              </Button>
            )}

            <Group gap="md" ml="auto">
              {/* Test / re-test button — always visible */}
              <Button
                variant="outline"
                color="blue"
                leftSection={<IconPlugConnected size={15} />}
                onClick={handleTestConnection}
                loading={testing}
                disabled={!apiUrl.trim() || !apiKey.trim()}
              >
                {t('settings.sandbox.testBtn')}
              </Button>

              {/* Disable button — only when active */}
              {isAvailable && (
                <Button
                  variant="light"
                  color="orange"
                  leftSection={<IconPlugConnectedX size={15} />}
                  onClick={handleDisable}
                  loading={disabling}
                >
                  {t('settings.sandbox.disableBtn')}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
