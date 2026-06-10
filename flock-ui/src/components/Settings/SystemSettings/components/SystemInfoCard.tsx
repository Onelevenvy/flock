import { Card, Group, ThemeIcon, Text, Stack, Divider } from '@mantine/core';
import { IconInfoCircle, IconFolder, IconDatabase, IconDeviceDesktop } from '@tabler/icons-react';

interface SystemInfoCardProps {
  t: any;
  workdir: string;
  dbPath: string;
}

export function SystemInfoCard({ t, workdir, dbPath }: SystemInfoCardProps) {
  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
      }}
      padding="xl"
    >
      <Group gap="xs" mb="xl">
        <ThemeIcon variant="light" color="teal" radius="md">
          <IconInfoCircle size={18} />
        </ThemeIcon>
        <Text fw={700} size="md">
          {t('systemSettings.systemInfo')}
        </Text>
      </Group>

      <Stack gap="md">
        {/* 工作区路径 */}
        <Group align="flex-start" wrap="nowrap">
          <IconFolder size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('systemSettings.workspaceDir')}
            </Text>
            <Text size="sm" fw={500} style={{ wordBreak: 'break-all', fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {workdir === '__not_bound__' ? t('systemSettings.notBound') : (workdir || t('common.loading'))}
            </Text>
          </div>
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        {/* 数据库路径 */}
        <Group align="flex-start" wrap="nowrap">
          <IconDatabase size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('systemSettings.databasePath')}
            </Text>
            <Text size="sm" fw={500} style={{ wordBreak: 'break-all', fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {dbPath || t('common.loading')}
            </Text>
          </div>
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        {/* 操作系统和版本 */}
        <Group align="flex-start" wrap="nowrap">
          <IconDeviceDesktop size={18} color="var(--flock-text-dim)" style={{ marginTop: 2 }} />
          <div>
            <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('systemSettings.sysVersionInfo')}
            </Text>
            <Group gap="sm" mt={2}>
              <Text size="sm" fw={500}>
                {t('systemSettings.os')}: <span style={{ fontWeight: 600 }}>Windows</span>
              </Text>
              <Text size="xs" c="dimmed">|</Text>
              <Text size="sm" fw={500}>
                {t('systemSettings.clientVersion')}: <span style={{ fontWeight: 600 }}>v0.3.0</span>
              </Text>
            </Group>
          </div>
        </Group>
      </Stack>
    </Card>
  );
}
