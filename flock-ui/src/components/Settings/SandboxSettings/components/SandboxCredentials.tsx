import {
  Stack,
  Text,
  Group,
  TextInput,
  PasswordInput,
  Tooltip,
  Select,
} from '@mantine/core';
import {
  IconServer,
  IconKey,
  IconHelpCircle,
  IconCpu,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SandboxCredentialsProps {
  provider: 'e2b' | 'daytona' | 'local';
  onProviderChange: (val: 'e2b' | 'daytona' | 'local') => void;
  apiUrl: string;
  apiKey: string;
  e2bApiKey: string;
  e2bApiUrl: string;
  onApiUrlChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
  onE2bApiKeyChange: (val: string) => void;
  onE2bApiUrlChange: (val: string) => void;
}

export function SandboxCredentials({
  provider,
  onProviderChange,
  apiUrl,
  apiKey,
  e2bApiKey,
  e2bApiUrl,
  onApiUrlChange,
  onApiKeyChange,
  onE2bApiKeyChange,
  onE2bApiUrlChange,
}: SandboxCredentialsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Select
        label={
          <Group gap={6} style={{ marginBottom: 4 }}>
            <IconCpu size={14} color="var(--flock-text-dim)" />
            <Text size="sm" fw={500}>{t('settings.sandbox.provider', 'Sandbox Provider')}</Text>
          </Group>
        }
        data={[
          { value: 'e2b', label: 'E2B (Recommended)' },
          { value: 'daytona', label: 'Daytona' },
          { value: 'local', label: 'Local (Placeholder)' },
        ]}
        value={provider}
        onChange={(val) => onProviderChange(val as any)}
        styles={{ input: { background: 'var(--flock-bg-surface)' } }}
      />

      {provider === 'e2b' && (
        <>
          <TextInput
            label={
              <Group gap={6} style={{ marginBottom: 4 }}>
                <IconServer size={14} color="var(--flock-text-dim)" />
                <Text size="sm" fw={500}>{t('settings.sandbox.apiUrl')}</Text>
              </Group>
            }
            placeholder="https://api.e2b.app"
            value={e2bApiUrl}
            onChange={(e) => onE2bApiUrlChange(e.currentTarget.value)}
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
          />

          <PasswordInput
            label={
              <Group gap={6} style={{ marginBottom: 4 }}>
                <IconKey size={14} color="var(--flock-text-dim)" />
                <Text size="sm" fw={500}>E2B API Key</Text>
              </Group>
            }
            placeholder="e2b_..."
            value={e2bApiKey}
            onChange={(e) => onE2bApiKeyChange(e.currentTarget.value)}
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
          />
        </>
      )}

      {provider === 'daytona' && (
        <>
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
        </>
      )}

      {provider === 'local' && (
        <Text size="sm" color="dimmed">
          Local process isolation is currently under planning. Selected tools will execute directly on host machine with basic constraints.
        </Text>
      )}
    </Stack>
  );
}
