import { useState, useEffect } from 'react';
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconX } from '@tabler/icons-react';
import { formatError } from '../../../utils/error';
import { getProviderName } from '../helpers';
import type { ToolProvider } from '../types';

export function useProviderCredentials(
  provider: ToolProvider,
  onCredentialsSaved: () => void,
) {
  const { t } = useTranslation();
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Parse as raw first to safely detect the sentinel field.
  const rawSchema: Record<string, unknown> = (() => {
    if (!provider.credentials_schema) return {};
    try {
      return JSON.parse(provider.credentials_schema) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  // Sandbox provider has a special sentinel schema — auth lives in Settings page.
  const isSandboxProvider = rawSchema['__type'] === 'sandbox_settings';

  const credSchema: Record<string, { type?: string; description?: string }> =
    isSandboxProvider
      ? {}
      : (rawSchema as Record<string, { type?: string; description?: string }>);

  const hasCredentials = !isSandboxProvider && Object.keys(rawSchema).length > 0;

  useEffect(() => {
    const existing: Record<string, string> = {};
    if (provider.credentials) {
      try {
        const parsed = JSON.parse(provider.credentials);
        for (const key of Object.keys(credSchema)) {
          if (parsed[key]?.value !== undefined) {
            existing[key] = parsed[key].value;
          }
        }
      } catch {
        /* ignore */
      }
    }
    for (const key of Object.keys(credSchema)) {
      if (!(key in existing)) {
        existing[key] = '';
      }
    }
    setCredValues(existing);
  }, [provider]);

  const handleSaveCredentials = async () => {
    const payload: Record<string, { value: string; description: string }> = {};
    for (const [key, val] of Object.entries(credValues)) {
      payload[key] = {
        value: val,
        description: credSchema[key]?.description || '',
      };
    }
    setSaving(true);
    try {
      await invoke('update_tool_provider_credentials', {
        providerId: provider.id,
        credentials: JSON.stringify(payload),
      });

      notifications.show({
        id: `testing-${provider.id}`,
        title: t('skills.tools.verifyingTitle'),
        message: t('skills.tools.verifyingMsg', { name: getProviderName(provider) }),
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      try {
        const msg = await invoke<string>('test_tool_provider', {
          providerId: provider.id,
        });
        notifications.update({
          id: `testing-${provider.id}`,
          title: t('skills.tools.authSuccess'),
          message: msg,
          color: 'teal',
          icon: React.createElement(IconCheck, { size: 18 }),
          loading: false,
          autoClose: 3000,
        });
      } catch (e: any) {
        notifications.update({
          id: `testing-${provider.id}`,
          title: t('skills.tools.authFailed'),
          message: formatError(e),
          color: 'red',
          icon: React.createElement(IconX, { size: 18 }),
          loading: false,
          autoClose: 5000,
        });
      }

      onCredentialsSaved();
    } catch (e) {
      console.error('Failed to save credentials:', e);
      notifications.show({
        title: t('common.failed'),
        message: formatError(e),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    credValues,
    setCredValues,
    saving,
    rawSchema,
    isSandboxProvider,
    credSchema,
    hasCredentials,
    handleSaveCredentials,
  };
}
