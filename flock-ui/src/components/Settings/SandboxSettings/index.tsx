import {
  Stack,
  Text,
  Card,
  Group,
  ThemeIcon,
  Badge,
  Alert,
  Divider,
  Tabs,
} from '@mantine/core';
import {
  IconShieldLock,
  IconInfoCircle,
  IconPlugConnected,
  IconPlugConnectedX,
  IconSettings,
  IconCpu,
  IconCamera,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { SandboxCredentials } from './components/SandboxCredentials';
import { SandboxActions } from './components/SandboxActions';
import { SandboxListSection } from './components/SandboxListSection';
import { SnapshotListSection } from './components/SnapshotListSection';
import { useSandboxSettings } from './hooks/useSandboxSettings';

export default function SandboxSettings() {
  const { t } = useTranslation();

  const {
    apiUrl, setApiUrl,
    apiKey, setApiKey,
    snapshot,
    testing,
    disabling,
    creatingSnapshot,
    isAvailable,
    activeTab, setActiveTab,
    handleTestConnection,
    handleDisable,
    handleCreateSnapshot,
    handleSetDefaultSnapshot,
  } = useSandboxSettings();

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

          {isAvailable ? (
            <Badge color="teal" variant="light" leftSection={<IconPlugConnected size={12} />}>
              {t('settings.sandbox.statusActive')}
            </Badge>
          ) : (
            <Badge color="gray" variant="light" leftSection={<IconPlugConnectedX size={12} />}>
              {t('settings.sandbox.statusInactive')}
            </Badge>
          )}
        </Group>

        <Divider color="var(--flock-border-subtle)" mb="lg" />

        {!isAvailable && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            radius="md"
            mb="lg"
          >
            {t('settings.sandbox.retestHint')}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'config')} variant="pills" radius="md">
          <Tabs.List style={{ marginBottom: 20 }}>
            <Tabs.Tab value="config" leftSection={<IconSettings size={14} />}>
              {t('settings.sandbox.tabConfig')}
            </Tabs.Tab>
            <Tabs.Tab
              value="instances"
              leftSection={<IconCpu size={14} />}
              disabled={!isAvailable}
            >
              {t('settings.sandbox.tabInstances')}
            </Tabs.Tab>
            <Tabs.Tab
              value="snapshots"
              leftSection={<IconCamera size={14} />}
              disabled={!isAvailable}
            >
              {t('settings.sandbox.tabSnapshots')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="config">
            <Stack gap="lg">
              <SandboxCredentials
                apiUrl={apiUrl}
                apiKey={apiKey}
                onApiUrlChange={setApiUrl}
                onApiKeyChange={setApiKey}
              />
              <Divider color="var(--flock-border-subtle)" mt="md" />
              <SandboxActions
                isAvailable={isAvailable}
                apiUrl={apiUrl}
                apiKey={apiKey}
                testing={testing}
                disabling={disabling}
                onTestConnection={handleTestConnection}
                onDisable={handleDisable}
              />
            </Stack>
          </Tabs.Panel>

          {isAvailable && (
            <Tabs.Panel value="instances">
              <SandboxListSection />
            </Tabs.Panel>
          )}

          {isAvailable && (
            <Tabs.Panel value="snapshots">
              <SnapshotListSection
                currentDefaultSnapshot={snapshot}
                onSetDefaultSnapshot={handleSetDefaultSnapshot}
                onCreateSnapshot={handleCreateSnapshot}
                creatingSnapshot={creatingSnapshot}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      </Card>
    </Stack>
  );
}
