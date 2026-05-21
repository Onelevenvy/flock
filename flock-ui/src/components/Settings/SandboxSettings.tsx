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
} from '@mantine/core';
import {
  IconServer,
  IconKey,
  IconCheck,
  IconAlertCircle,
  IconPlayerPlay,
  IconShieldLock,
  IconHelpCircle,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

interface SandboxConfig {
  enabled: boolean;
  api_url: string | null;
  api_key: string | null;
}

export default function SandboxSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://app.daytona.io/api');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
        message: '请先填写 API 地址与 API 密钥后再进行连接测试。',
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

          <Divider color="var(--flock-border-subtle)" mt="md" />

          <Group justify="flex-end" gap="md">
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
        </Stack>
      </Card>
    </Stack>
  );
}
