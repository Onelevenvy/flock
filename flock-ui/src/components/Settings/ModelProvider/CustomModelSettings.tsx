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
import { useTranslation } from 'react-i18next';
import { ProviderIcon } from '../../Icons';

interface ModelProvider {
  id: string;
  provider_name: string;
  provider_type: string;
}

interface Props {
  provider: ModelProvider;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomModelSettings({ provider, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!modelName.trim()) {
      notifications.show({
        title: t('common.error', 'Error'),
        message: 'Model Name is required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      // Test the connection before saving
      await invoke('test_custom_model_connection', {
        providerId: provider.id,
        modelName: modelName.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
      });

      // If it reaches here, the test succeeded, so we can save it
      await invoke('upsert_custom_model', {
        providerId: provider.id,
        modelName: modelName.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
      });

      // Show success message
      notifications.show({
        title: t('settings.provider.saveSuccess', 'Success'),
        message: 'Custom model added successfully.',
        color: 'teal',
      });

      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to save custom model:', e);
      notifications.show({
        title: t('common.failed', 'Failed'),
        message: String(e),
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
          <ProviderIcon name={provider.id} size={20} />
          <Text fw={600} size="md">
            Add Custom Model
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
        <TextInput
          label="Model Name"
          placeholder="e.g. gpt-4o, my-custom-model"
          value={modelName}
          onChange={(e) => setModelName(e.currentTarget.value)}
          required
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          styles={{
            input: { 
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
            },
          }}
        />

        <TextInput
          label="Base URL"
          placeholder="e.g. https://api.openai.com/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          required
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          styles={{
            input: { 
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
            },
          }}
        />

        <PasswordInput
          label="API Key"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          required
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
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

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="filled"
            color="indigo"
            onClick={handleSave}
            loading={saving}
            disabled={!modelName || !baseUrl || !apiKey}
          >
            {t('common.confirm')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
