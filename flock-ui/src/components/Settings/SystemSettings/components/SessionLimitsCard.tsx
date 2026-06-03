import { Card, Group, ThemeIcon, Text, Badge, Stack, Tooltip, Switch, Divider, Button } from '@mantine/core';
import { IconServer, IconHelpCircle, IconSettings } from '@tabler/icons-react';

interface SessionLimitsCardProps {
  t: any;
  enableTitleSummary: boolean;
  setEnableTitleSummary: (val: boolean) => void;
  saving: boolean;
  onSave: () => void;
}

export function SessionLimitsCard({
  t,
  enableTitleSummary,
  setEnableTitleSummary,
  saving,
  onSave,
}: SessionLimitsCardProps) {
  return (
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
          <ThemeIcon variant="light" color="cyan" radius="md">
            <IconServer size={18} />
          </ThemeIcon>
          <Text fw={700} size="md">
            {t('systemSettings.sessionLimits')}
          </Text>
        </Group>
        <Badge color="cyan" variant="light">
          {t('systemSettings.resourceConfig')}
        </Badge>
      </Group>

      <Stack gap="lg">

        {/* 自动总结标题 */}
        <Group justify="space-between" align="center">
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={500}>{t('systemSettings.enableTitleSummary')}</Text>
            <Tooltip
              label={t('systemSettings.enableTitleSummaryTooltip')}
              multiline
              w={280}
              withArrow
              position="top"
            >
              <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
            </Tooltip>
          </Group>
          <Switch
            checked={enableTitleSummary}
            onChange={(e) => setEnableTitleSummary(e.currentTarget.checked)}
            styles={{
              track: { cursor: 'pointer' },
            }}
          />
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        <Group justify="flex-end">
          <Button
            variant="filled"
            color="blue"
            leftSection={<IconSettings size={16} />}
            onClick={onSave}
            loading={saving}
            styles={{
              root: {
                boxShadow: '0 4px 12px rgba(21, 90, 239, 0.25)',
              },
            }}
          >
            {t('systemSettings.saveConfig')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
