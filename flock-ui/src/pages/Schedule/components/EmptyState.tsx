import { Box, ThemeIcon, Text, Button } from '@mantine/core';
import { IconCalendarTime, IconPlus } from '@tabler/icons-react';

interface EmptyStateProps {
  t: any;
  onNew: () => void;
}

export function EmptyState({ t, onNew }: EmptyStateProps) {
  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: 440,
        margin: '48px auto 0',
        padding: '48px 32px',
        borderRadius: 14,
        border: '1px dashed var(--flock-border-dim)',
        background: 'var(--flock-bg-surface)',
      }}
    >
      <ThemeIcon variant="light" color="gray" size={56} radius="xl" mb="md">
        <IconCalendarTime size={28} />
      </ThemeIcon>
      <Text size="sm" fw={600} mb={6} style={{ color: 'var(--flock-text-bright)' }}>
        {t('schedule.empty')}
      </Text>
      <Text size="xs" c="dimmed" mb="lg" style={{ maxWidth: 280 }}>
        {t('schedule.emptyDesc')}
      </Text>
      <Button
        size="xs"
        leftSection={<IconPlus size={13} />}
        onClick={onNew}
        style={{ background: 'var(--flock-accent)' }}
      >
        {t('schedule.newBtn')}
      </Button>
    </Box>
  );
}
