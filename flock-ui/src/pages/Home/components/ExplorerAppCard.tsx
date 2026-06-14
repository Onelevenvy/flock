import { Avatar, Badge, Box, Button, Group, Text, UnstyledButton } from '@mantine/core';
import { IconMessageCircle, IconPlayerPlay, IconRoute, IconSparkles } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ExplorerAppCardProps {
  type: 'assistant' | 'workflow';
  name: string;
  description?: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ExplorerAppCard({
  type,
  name,
  description,
  icon,
  disabled,
  onClick,
}: ExplorerAppCardProps) {
  const { t } = useTranslation();
  const TypeIcon = type === 'assistant' ? IconSparkles : IconRoute;
  const ActionIcon = type === 'assistant' ? IconMessageCircle : IconPlayerPlay;

  return (
    <UnstyledButton
      className="hover-card-lift"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 18,
        borderRadius: 18,
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-subtle)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Avatar
          size={46}
          radius={14}
          style={{
            background: type === 'assistant' ? 'var(--flock-accent-soft)' : 'rgba(20, 184, 166, 0.12)',
            color: type === 'assistant' ? 'var(--flock-accent)' : 'var(--mantine-color-teal-6)',
            fontSize: 22,
          }}
        >
          {icon}
        </Avatar>
        <Badge
          size="sm"
          variant="light"
          color={type === 'assistant' ? 'blue' : 'teal'}
          leftSection={<TypeIcon size={12} />}
          styles={{ root: { textTransform: 'none' } }}
        >
          {type === 'assistant' ? t('home.explorer.assistant') : t('home.explorer.workflow')}
        </Badge>
      </Group>

      <Box style={{ flex: 1, minHeight: 84 }}>
        <Text size="sm" fw={700} mb={6} style={{ color: 'var(--flock-text-bright)' }}>
          {name}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={3} style={{ lineHeight: 1.55 }}>
          {description || t('home.explorer.noDescription')}
        </Text>
      </Box>

      <Button
        fullWidth
        size="xs"
        radius="md"
        variant={type === 'assistant' ? 'light' : 'filled'}
        color={type === 'assistant' ? 'blue' : 'blue'}
        leftSection={<ActionIcon size={14} />}
        disabled={disabled}
      >
        {type === 'assistant' ? t('home.explorer.startChat') : t('home.explorer.runWorkflow')}
      </Button>
    </UnstyledButton>
  );
}
