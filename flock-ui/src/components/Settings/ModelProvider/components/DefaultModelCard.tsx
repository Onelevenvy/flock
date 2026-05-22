import { Card, Group, ThemeIcon, Box, Tooltip, Text } from '@mantine/core';
import { IconCube, IconHelpCircle } from '@tabler/icons-react';
import { ModelSelect } from '../../Common/ModelSelect';

interface DefaultModelCardProps {
  t: (key: string, defaultValue?: string) => string;
  onlineModels: Array<{ value: string; label: string; providerName: string }>;
  value: string;
  onChange: (value: string | null) => void;
}

export function DefaultModelCard({ t, onlineModels, value, onChange }: DefaultModelCardProps) {
  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
      }}
      padding="md"
    >
      <Group justify="space-between" align="center">
        <Group gap="sm" style={{ flex: 1 }}>
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            <IconCube size={18} />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={700} size="sm">
                {t('settings.model.defaultModelTitle')}
              </Text>
              <Tooltip
                label={t('settings.model.defaultModelTooltip')}
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
          placeholder={
            onlineModels.length === 0
              ? t('settings.model.noModelsEnabledPlaceholder')
              : t('settings.model.defaultModelPlaceholder')
          }
          data={onlineModels}
          value={value}
          onChange={onChange}
          disabled={onlineModels.length === 0}
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
