import { Box, Text, Stack } from '@mantine/core';
import { IconProps } from '@tabler/icons-react';

interface PlaceholderPageProps {
  title: string;
  icon: React.FC<IconProps>;
  description: string;
}

export function PlaceholderPage({ title, icon: Icon, description }: PlaceholderPageProps) {
  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--flock-bg-base)',
        borderRadius: '16px',
        border: '1px solid var(--flock-border-subtle)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        minWidth: 0,
        padding: 40,
      }}
    >
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'var(--flock-accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mantine-color-indigo-4)',
          }}
        >
          <Icon size={40} stroke={1.5} />
        </Box>
        <Stack align="center" gap={4}>
          <Text size="xl" fw={700} c="var(--flock-text-bright)">
            {title}
          </Text>
          <Text size="sm" c="dimmed" ta="center" style={{ maxWidth: 300 }}>
            {description}
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
