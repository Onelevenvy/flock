import { Box, Group, Text } from '@mantine/core';

export function FlockLogo() {
  return (
    <Group px="md" py="sm" gap="sm" mb="xs">
      <Box
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'var(--flock-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(21, 90, 239, 0.3)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L3 8l9 5 9-5-9-5z" fill="white" opacity="0.9" />
          <path d="M3 12l9 5 9-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M3 16l9 5 9-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6" />
        </svg>
      </Box>
      <Text fw={700} size="lg" style={{ letterSpacing: '0.5px' }}>Flock</Text>
    </Group>
  );
}
