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
  isAvailable: boolean;
  apiUrl: string;
  apiKey: string;
  testing: boolean;
  disabling: boolean;
  onTestConnection: () => void;
  onDisable: () => void;
}

export function SandboxActions({
  isAvailable,
  apiUrl,
  apiKey,
  testing,
  disabling,
  onTestConnection,
  onDisable,
}: SandboxActionsProps) {
  const { t } = useTranslation();
  return (
    <Group justify="flex-end" gap="md" style={{ width: '100%' }}>
      {/* Test / re-test button */}
      <Button
        variant="outline"
        color="blue"
        leftSection={<IconPlugConnected size={15} />}
        onClick={onTestConnection}
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
          onClick={onDisable}
          loading={disabling}
        >
          {t('settings.sandbox.disableBtn')}
        </Button>
      )}
    </Group>
  );
}
