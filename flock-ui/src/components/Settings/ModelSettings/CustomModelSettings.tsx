import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Text,
  Switch,
  Loader,
  Box,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { ProviderIcon } from '@/components/Common/Icons';
import { ModelItem } from './types';

interface ModelProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  icon?: string | null;
}

interface Props {
  provider: ModelProvider;
  model?: ModelItem;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomModelSettings({ provider, model, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [modelName, setModelName] = useState(model ? model.model_name : '');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [supportsVision, setSupportsVision] = useState(model ? model.capabilities.includes('vision') : false);
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(!!model);

  useEffect(() => {
    if (model) {
      invoke<{ base_url: string; api_key: string }>('get_custom_model_details', {
        providerId: provider.id,
        modelName: model.model_name,
      })
        .then((details) => {
          if (details) {
            setBaseUrl(details.base_url);
            setApiKey(details.api_key);
          }
        })
        .catch((err) => {
          console.error('Failed to load custom model details:', err);
        })
        .finally(() => {
          setLoadingDetails(false);
        });
    }
  }, [model, provider.id]);

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
        originalModelName: model ? model.model_name : null,
      });

      // If it reaches here, the test succeeded, so we can save it
      await invoke('upsert_custom_model', {
        providerId: provider.id,
        modelName: modelName.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        capabilities: supportsVision ? ['vision'] : [],
        originalModelName: model ? model.model_name : null,
      });

      // Show success message
      notifications.show({
        title: t('settings.provider.saveSuccess', 'Success'),
        message: model ? 'Custom model updated successfully.' : 'Custom model added successfully.',
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
          <ProviderIcon name={provider.icon || provider.id} size={20} />
          <Text fw={600} size="md">
            {model ? 'Edit Custom Model' : 'Add Custom Model'}
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
        {loadingDetails ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Loader size="sm" color="blue" />
          </Box>
        ) : (
          <>
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
            />

            <Switch
              label={t('settings.model.supportsVision', 'Supports Vision')}
              checked={supportsVision}
              onChange={(e) => setSupportsVision(e.currentTarget.checked)}
              color="blue"
              styles={{
                label: {
                  color: 'var(--flock-text-primary)',
                  fontWeight: 500,
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
                disabled={!modelName || !baseUrl || !apiKey}
              >
                {t('common.confirm')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
