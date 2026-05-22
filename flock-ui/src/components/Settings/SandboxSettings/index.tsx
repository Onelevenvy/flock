import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Card,
  Group,
  ThemeIcon,
  Badge,
  Alert,
  Divider,
  Tabs,
  Box,
} from '@mantine/core';
import {
  IconShieldLock,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle,
  IconPlugConnected,
  IconPlugConnectedX,
  IconSettings,
  IconCpu,
  IconCamera,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { SandboxCredentials } from './components/SandboxCredentials';
import { SandboxActions } from './components/SandboxActions';
import { SandboxListSection } from './components/SandboxListSection';
import { SnapshotListSection } from './components/SnapshotListSection';

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
  const [isAvailable, setIsAvailable] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('config');

  const defaultSnapshotName = 'flock-playwright';

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

  /** Save config helper */
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
      await saveConfig({ enabled: true });
      await invoke<string>('test_sandbox_connection', {
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
      });
      setIsAvailable(true);
      notifications.show({
        title: t('settings.sandbox.testOkAutoEnabled'),
        message: t('settings.sandbox.testOkMsg'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      setIsAvailable(false);
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

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await saveConfig({ enabled: false });
      setIsAvailable(false);
      setActiveTab('config');
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

  const handleCreateSnapshot = async (snapName: string) => {
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

  const handleSetDefaultSnapshot = async (name: string) => {
    setSnapshot(name);
    try {
      await saveConfig({ snapshot: name });
      notifications.show({
        title: t('common.success'),
        message: t('settings.sandbox.saveDefaultSuccess', { defaultValue: '默认快照模板已更新' }),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
      });
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

          {isAvailable ? (
            <Badge color="teal" variant="light" leftSection={<IconPlugConnected size={12} />}>
              {t('settings.sandbox.statusActive')}
            </Badge>
          ) : (
            <Badge color="gray" variant="light" leftSection={<IconPlugConnectedX size={12} />}>
              {t('settings.sandbox.statusInactive')}
            </Badge>
          )}
        </Group>

        <Divider color="var(--flock-border-subtle)" mb="lg" />

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

        <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'config')} variant="pills" radius="md">
          <Tabs.List style={{ marginBottom: 20 }}>
            <Tabs.Tab value="config" leftSection={<IconSettings size={14} />}>
              {t('settings.sandbox.tabConfig', { defaultValue: '参数配置' })}
            </Tabs.Tab>
            <Tabs.Tab
              value="instances"
              leftSection={<IconCpu size={14} />}
              disabled={!isAvailable}
            >
              {t('settings.sandbox.tabInstances', { defaultValue: '沙盒管理' })}
            </Tabs.Tab>
            <Tabs.Tab
              value="snapshots"
              leftSection={<IconCamera size={14} />}
              disabled={!isAvailable}
            >
              {t('settings.sandbox.tabSnapshots', { defaultValue: '快照模板' })}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="config">
            <Stack gap="lg">
              <SandboxCredentials
                apiUrl={apiUrl}
                apiKey={apiKey}
                onApiUrlChange={setApiUrl}
                onApiKeyChange={setApiKey}
              />
              <Divider color="var(--flock-border-subtle)" mt="md" />
              <SandboxActions
                isAvailable={isAvailable}
                apiUrl={apiUrl}
                apiKey={apiKey}
                testing={testing}
                disabling={disabling}
                onTestConnection={handleTestConnection}
                onDisable={handleDisable}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="instances">
            <SandboxListSection />
          </Tabs.Panel>

          <Tabs.Panel value="snapshots">
            <SnapshotListSection
              currentDefaultSnapshot={snapshot}
              onSetDefaultSnapshot={handleSetDefaultSnapshot}
              onCreateSnapshot={handleCreateSnapshot}
              creatingSnapshot={creatingSnapshot}
            />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Stack>
  );
}
