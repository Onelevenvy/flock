import {
  Group,
  Button,
} from '@mantine/core';
import {
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconPlugConnected,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

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
  const [cleaningUp, setCleaningUp] = useState(false);

  const handleCleanup = async () => {
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
  };

  return (
    <Group justify="space-between" gap="md">
      {/* Cleanup — only available when connected */}
      {isAvailable && (
        <Button
          variant="outline"
          color="red"
          leftSection={<IconTrash size={15} />}
          onClick={handleCleanup}
          loading={cleaningUp}
        >
          {t('settings.sandbox.cleanupBtn')}
        </Button>
      )}

      <Group gap="md" ml="auto">
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
    </Group>
  );
}
