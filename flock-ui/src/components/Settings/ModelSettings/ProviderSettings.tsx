import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Text,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ProviderIcon } from '@/components/Common/Icons';
import { parseMultiLang } from '@/utils/i18n';

interface ModelProvider {
  id: string;
  provider_name: any;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  test_model: string | null;
  icon: string | null;
  description: any;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  provider: ModelProvider;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProviderSettings({ provider, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState(provider.api_key || '');
  const [baseUrl, setBaseUrl] = useState(provider.base_url || '');
  const [testModel, setTestModel] = useState(provider.test_model || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('upsert_provider', {
        provider: {
          ...provider,
          api_key: apiKey || null,
          base_url: baseUrl || null,
          test_model: testModel || null,
          is_available: !!apiKey,
        },
      });

      if (apiKey) {
        // 保存成功后自动触发连通性测试并激活模型
        notifications.show({
          id: 'activating-provider',
          title: t('settings.provider.activatingTitle'),
          message: t('settings.provider.activatingMsg', { name: parseMultiLang(provider.provider_name) }),
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });

        try {
          const res = await invoke<string>('activate_provider', { providerId: provider.id });
          notifications.update({
            id: 'activating-provider',
            title: t('settings.provider.activateSuccess'),
            message: res,
            color: 'teal',
            icon: <IconCheck size={18} />,
            loading: false,
            autoClose: 3000,
          });
        } catch (e) {
          notifications.update({
            id: 'activating-provider',
            title: t('settings.provider.activateFailed'),
            message: String(e),
            color: 'red',
            icon: <IconX size={18} />,
            loading: false,
            autoClose: 5000,
          });
        }
      } else {
        notifications.show({
          title: t('settings.provider.saveSuccess'),
          message: t('settings.provider.saveSuccessMsg'),
          color: 'blue',
        });
      }

      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to save provider:', e);
      notifications.show({
        title: t('common.failed'),
        message: t('settings.provider.saveFailedMsg'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Group gap="xs">
          <ProviderIcon name={provider.icon || provider.id} size={20} />
          <Text fw={600} size="md">
            {t('settings.provider.settingsTitle', { name: parseMultiLang(provider.provider_name) })}
          </Text>
        </Group>
      }
      size="sm"
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
        },
      }}
    >
      <Stack gap="md" pt="xs">
        <PasswordInput
          label="API Key"
          placeholder=""
          value={apiKey}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
            },
          }}
          visibilityToggleIcon={({ reveal }) =>
            reveal ? <Text size="xs">{t('common.hide')}</Text> : <Text size="xs">{t('common.show')}</Text>
          }
        />

        <TextInput
          label="Base URL"
          placeholder="https://api.example.com/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
            },
          }}
        />

        <TextInput
          label={t('settings.provider.testModel')}
          placeholder={t('settings.provider.testModelPlaceholder')}
          value={testModel}
          onChange={(e) => setTestModel(e.currentTarget.value)}
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
            },
          }}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="filled"
            color="blue"
            onClick={handleSave}
            loading={saving}
          >
            {t('common.confirm')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
