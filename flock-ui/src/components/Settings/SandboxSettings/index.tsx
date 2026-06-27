import {
  Stack,
  Text,
  Card,
  Group,
  ThemeIcon,
  Badge,
  Alert,
  Divider,
  SegmentedControl,
  Box,
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
    provider, setProvider,
    apiUrl, setApiUrl,
    apiKey, setApiKey,
    e2bApiKey, setE2bApiKey,
    snapshot,
    testing,
    disabling,
    creatingSnapshot,
    isAvailable,
    activeTab, setActiveTab,
    snapshotsList,
    buildingE2b,
    e2bBuildLogs,
    handleTestConnection,
    handleDisable,
    handleCreateSnapshot,
    handleSetDefaultSnapshot,
    handleBuildE2bTemplate,
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

        {(() => {
          const tabs = [
            { value: 'config', label: t('settings.sandbox.tabConfig') }
          ];
          if (provider === 'daytona') {
            tabs.push({ value: 'instances', label: t('settings.sandbox.tabInstances'), disabled: !isAvailable });
          }
          if (provider === 'daytona' || provider === 'e2b') {
            tabs.push({ value: 'snapshots', label: t('settings.sandbox.tabSnapshots'), disabled: !isAvailable });
          }
          if (tabs.length <= 1) return null;

          return (
            <SegmentedControl
              value={activeTab}
              onChange={(val) => setActiveTab(val as any)}
              data={tabs}
              size="xs"
              mb="lg"
              styles={{
                root: {
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  padding: 2,
                  borderRadius: 8,
                },
                control: {
                  minWidth: 100,
                }
              }}
            />
          );
        })()}

        {activeTab === 'config' && (
          <Stack gap="lg" mt="md">
            <SandboxCredentials
              provider={provider}
              onProviderChange={setProvider}
              apiUrl={apiUrl}
              apiKey={apiKey}
              e2bApiKey={e2bApiKey}
              onApiUrlChange={setApiUrl}
              onApiKeyChange={setApiKey}
              onE2bApiKeyChange={setE2bApiKey}
            />
            <Divider color="var(--flock-border-subtle)" mt="md" />
            <SandboxActions
              provider={provider}
              isAvailable={isAvailable}
              apiUrl={apiUrl}
              apiKey={apiKey}
              e2bApiKey={e2bApiKey}
              testing={testing}
              disabling={disabling}
              onTestConnection={handleTestConnection}
              onDisable={handleDisable}
            />
          </Stack>
        )}

        {provider === 'daytona' && activeTab === 'instances' && isAvailable && (
          <Box mt="md">
            <SandboxListSection />
          </Box>
        )}

        {(provider === 'daytona' || provider === 'e2b') && activeTab === 'snapshots' && isAvailable && (
          <Box mt="md">
            {activeTab === 'snapshots' && (
              <SnapshotListSection
                provider={provider}
                currentDefaultSnapshot={snapshot}
                onSetDefaultSnapshot={handleSetDefaultSnapshot}
                onCreateSnapshot={handleCreateSnapshot}
                creatingSnapshot={creatingSnapshot}
                buildingE2b={buildingE2b}
                e2bBuildLogs={e2bBuildLogs}
                onBuildE2bTemplate={handleBuildE2bTemplate}
              />
            )}
          </Box>
        )}
      </Card>
    </Stack>
  );
}
