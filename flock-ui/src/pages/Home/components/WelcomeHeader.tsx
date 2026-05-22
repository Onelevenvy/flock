import { Text } from '@mantine/core';

interface WelcomeHeaderProps {
  t: any;
}

export function WelcomeHeader({ t }: WelcomeHeaderProps) {
  return (
    <Text
      fw={700}
      style={{
        fontSize: 28,
        color: 'var(--flock-text-bright)',
        marginBottom: 24,
        letterSpacing: '-0.5px',
      }}
    >
      {t('home.welcome')}
    </Text>
  );
}
