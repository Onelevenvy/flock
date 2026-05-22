import { Card, Group, ThemeIcon, Box, Tooltip, Text } from '@mantine/core';
import { IconSparkles, IconHelpCircle } from '@tabler/icons-react';
import { ModelSelect } from '../../../Common/ModelSelect';

interface SummaryModelCardProps {
  t: any;
  summaryModels: Array<{ value: string; label: string; providerName: string }>;
  value: string;
  onChange: (value: string | null) => void;
  disabled: boolean;
}

export function SummaryModelCard({ t, summaryModels, value, onChange, disabled }: SummaryModelCardProps) {
  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
        marginTop: -12,
      }}
      padding="md"
    >
      <Group justify="space-between" align="center">
        <Group gap="sm" style={{ flex: 1 }}>
          <ThemeIcon variant="light" color="teal" size="md" radius="md">
            <IconSparkles size={18} />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={700} size="sm">
                {t('settings.model.summaryModelTitle')}
              </Text>
              <Tooltip
                label={t('settings.model.summaryModelTooltip')}
                multiline
                w={260}
                withArrow
                position="top"
              >
                <IconHelpCircle
                  size={14}
                  color="var(--flock-text-dim)"
                  style={{ cursor: 'help', display: 'inline-block', verticalAlign: 'middle' }}
                />
              </Tooltip>
            </Group>
          </Box>
        </Group>

        <ModelSelect
          placeholder={t('settings.model.followDefaultPlaceholder')}
          data={summaryModels}
          value={value}
          onChange={onChange}
          disabled={disabled}
          size="xs"
          w={260}
          searchable
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              color: 'var(--flock-text-primary)',
              height: 32,
            },
            dropdown: {
              background: 'var(--flock-bg-raised)',
              border: '1px solid var(--flock-border-dim)',
            },
            option: {
              color: 'var(--flock-text-primary)',
            },
          }}
        />
      </Group>
    </Card>
  );
}
