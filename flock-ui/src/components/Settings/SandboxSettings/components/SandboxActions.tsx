import {
  Group,
  Button,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SandboxActionsProps {
  provider: 'e2b' | 'daytona' | 'local';
  isAvailable: boolean;
  apiUrl: string;
  apiKey: string;
  e2bApiKey: string;
  e2bApiUrl: string;
  testing: boolean;
  disabling: boolean;
  onTestConnection: () => void;
  onDisable: () => void;
}

export function SandboxActions({
  provider,
  isAvailable,
  apiUrl,
  apiKey,
  e2bApiKey,
  e2bApiUrl,
  testing,
  disabling,
  onTestConnection,
  onDisable,
}: SandboxActionsProps) {
  const { t } = useTranslation();

  const isTestDisabled = () => {
    if (provider === 'e2b') return !e2bApiKey.trim() || !e2bApiUrl.trim();
    if (provider === 'daytona') return !apiUrl.trim() || !apiKey.trim();
    return false; // local is never disabled
  };

  return (
    <Group justify="flex-end" gap="md" style={{ width: '100%' }}>
      {/* Test / re-test button */}
      <Button
        variant="outline"
        color="blue"
        leftSection={<IconPlugConnected size={15} />}
        onClick={onTestConnection}
        loading={testing}
        disabled={isTestDisabled()}
      >
        {t('settings.sandbox.testBtn')}
      </Button>

      {/* Disable button — only when active */}
      {isAvailable && (
        <Button
          variant="light"
          color="orange"
          leftSection={<IconPlugConnectedX size={15} />}
          onClick={onDisable}
          loading={disabling}
        >
          {t('settings.sandbox.disableBtn')}
        </Button>
      )}
    </Group>
  );
}
