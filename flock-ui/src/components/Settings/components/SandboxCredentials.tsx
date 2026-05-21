import {
  Stack,
  Text,
  Group,
  TextInput,
  PasswordInput,
  Tooltip,
} from '@mantine/core';
import {
  IconServer,
  IconKey,
  IconHelpCircle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SandboxCredentialsProps {
  apiUrl: string;
  apiKey: string;
  onApiUrlChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
}

export function SandboxCredentials({
  apiUrl,
  apiKey,
  onApiUrlChange,
  onApiKeyChange,
}: SandboxCredentialsProps) {
  const { t } = useTranslation();

  return (
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
        onChange={(e) => onApiUrlChange(e.currentTarget.value)}
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
        onChange={(e) => onApiKeyChange(e.currentTarget.value)}
        styles={{ input: { background: 'var(--flock-bg-surface)' } }}
      />
    </Stack>
  );
}
