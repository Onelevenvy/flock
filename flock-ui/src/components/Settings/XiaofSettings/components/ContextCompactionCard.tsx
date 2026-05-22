import { Card, Group, ThemeIcon, Text, Badge, Stack, Switch, Divider, NumberInput, SegmentedControl } from '@mantine/core';
import { IconCpu } from '@tabler/icons-react';

interface CompactConfig {
  context_window: number;
  output_reserve?: number;
  autocompact_buffer?: number;
  emergency_buffer?: number;
  max_failures?: number;
  micro_keep_recent?: number;
  micro_gap_seconds?: number;
  compactable_tools?: string[];
  enabled: boolean;
  cache_diagnostics?: boolean;
  compaction: 'safe' | 'full' | 'off' | string;
  toon: boolean;
}

interface ContextCompactionCardProps {
  t: any;
  compactConfig: CompactConfig | null;
  setCompactConfig: React.Dispatch<React.SetStateAction<CompactConfig | null>>;
}

export function ContextCompactionCard({ t, compactConfig, setCompactConfig }: ContextCompactionCardProps) {
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
          <IconCpu size={22} color="var(--flock-accent)" />
          <Text fw={700} size="md">
            {t('settings.xiaof.contextCompaction')}
          </Text>
        </Group>
        <Badge color="blue" variant="light">
          {t('settings.xiaof.performanceOptimization')}
        </Badge>
      </Group>

      <Stack gap="lg">
        <Switch
          label={t('settings.xiaof.autoCompactLabel')}
          checked={compactConfig?.enabled || false}
          onChange={(e) =>
            setCompactConfig(
              compactConfig ? { ...compactConfig, enabled: e.currentTarget.checked } : null
            )
          }
          styles={{
            label: { cursor: 'pointer' },
          }}
        />

        {compactConfig?.enabled && (
          <>
            <Divider color="var(--flock-border-subtle)" />

            <Group grow>
              <NumberInput
                label={t('settings.xiaof.contextWindowLabel')}
                min={1000}
                max={1000000}
                step={10000}
                value={compactConfig?.context_window || 200000}
                onChange={(val) =>
                  setCompactConfig(
                    compactConfig
                      ? { ...compactConfig, context_window: typeof val === 'number' ? val : Number(val) }
                      : null
                  )
                }
                styles={{
                  input: { background: 'var(--flock-bg-surface)' },
                }}
              />

              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  {t('settings.xiaof.compactionModeLabel')}
                </Text>
                <SegmentedControl
                  data={[
                    { label: t('settings.xiaof.compactionModeSafe'), value: 'safe' },
                    { label: t('settings.xiaof.compactionModeFull'), value: 'full' },
                  ]}
                  value={compactConfig?.compaction === 'full' ? 'full' : 'safe'}
                  onChange={(val) =>
                    setCompactConfig(
                      compactConfig ? { ...compactConfig, compaction: val } : null
                    )
                  }
                  styles={{
                    root: { background: 'var(--flock-bg-surface)' },
                  }}
                />
              </Stack>
            </Group>

            {compactConfig?.compaction === 'full' && (
              <>
                <Divider color="var(--flock-border-subtle)" />

                <Switch
                  label={t('settings.xiaof.toonLabel')}
                  checked={compactConfig?.toon || false}
                  onChange={(e) =>
                    setCompactConfig(
                      compactConfig ? { ...compactConfig, toon: e.currentTarget.checked } : null
                    )
                  }
                  styles={{
                    label: { cursor: 'pointer' },
                  }}
                />
              </>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
