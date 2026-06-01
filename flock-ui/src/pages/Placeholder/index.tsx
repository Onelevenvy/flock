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
        background: 'var(--flock-bg-surface)',
        borderRadius: '16px',
        border: '1px solid var(--flock-border-subtle)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        minWidth: 0,
        padding: 40,
      }}
    >
      <Box
        style={{
          padding: '48px 64px',
          borderRadius: 24,
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-subtle)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--flock-accent)';
          e.currentTarget.style.boxShadow = '0 14px 36px rgba(21, 90, 239, 0.14)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--flock-border-subtle)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.05)';
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
              color: 'var(--flock-accent)',
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
    </Box>
  );
}
