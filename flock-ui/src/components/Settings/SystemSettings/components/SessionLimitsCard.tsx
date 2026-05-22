import { Card, Group, ThemeIcon, Text, Badge, Stack, Grid, NumberInput, Tooltip, Switch, Divider, Button } from '@mantine/core';
import { IconServer, IconHelpCircle, IconSettings } from '@tabler/icons-react';

interface SessionLimitsCardProps {
  t: any;
  maxRunning: number;
  setMaxRunning: (val: number) => void;
  maxCached: number;
  setMaxCached: (val: number) => void;
  enableTitleSummary: boolean;
  setEnableTitleSummary: (val: boolean) => void;
  saving: boolean;
  onSave: () => void;
}

export function SessionLimitsCard({
  t,
  maxRunning,
  setMaxRunning,
  maxCached,
  setMaxCached,
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
        <Grid align="flex-start">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <NumberInput
              label={
                <Group gap={6} wrap="nowrap" style={{ marginBottom: 4 }}>
                  <Text size="sm" fw={500}>{t('systemSettings.maxRunning')}</Text>
                  <Tooltip
                    label={t('systemSettings.maxRunningTooltip')}
                    multiline
                    w={260}
                    withArrow
                    position="top"
                  >
                    <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              }
              min={1}
              max={20}
              value={maxRunning}
              onChange={(val) => setMaxRunning(typeof val === 'number' ? val : Number(val))}
              styles={{
                input: { background: 'var(--flock-bg-surface)' },
              }}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <NumberInput
              label={
                <Group gap={6} wrap="nowrap" style={{ marginBottom: 4 }}>
                  <Text size="sm" fw={500}>{t('systemSettings.maxCached')}</Text>
                  <Tooltip
                    label={t('systemSettings.maxCachedTooltip')}
                    multiline
                    w={260}
                    withArrow
                    position="top"
                  >
                    <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              }
              min={2}
              max={100}
              value={maxCached}
              onChange={(val) => setMaxCached(typeof val === 'number' ? val : Number(val))}
              styles={{
                input: { background: 'var(--flock-bg-surface)' },
              }}
            />
          </Grid.Col>
        </Grid>

        <Divider color="var(--flock-border-subtle)" />

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
