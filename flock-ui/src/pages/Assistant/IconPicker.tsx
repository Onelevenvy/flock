import { useState } from 'react';
import { Box, Text, Avatar, Popover } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export const ICON_OPTIONS = [
  '🤖', '💻', '✍️', '📊', '🔍', '🎨', '📚', '🧠', '⚡', '🌐',
  '🔧', '🎯', '📝', '🚀', '💡', '🎓', '🔬', '📱', '🌍', '🎭',
  '🦊', '🐉', '🦁', '🎵', '🏆', '💎', '🌟', '🔮', '🎮', '🛸',
];

export function IconPicker({
  value,
  onChange,
  disabled = false,
  size = 38,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  size?: number;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withArrow
      shadow="lg"
      withinPortal
      disabled={disabled}
    >
      <Popover.Target>
        <Avatar
          size={size}
          radius="md"
          onClick={() => {
            if (!disabled) {
              setOpened(o => !o);
            }
          }}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            background: 'var(--flock-bg-base)',
            fontSize: size > 30 ? 20 : 16,
            flexShrink: 0,
            border: '1px solid var(--flock-border-base)',
            transition: 'all 0.2s ease',
            boxShadow: opened ? '0 0 0 2px var(--flock-accent)' : undefined,
          }}
        >
          {value}
        </Avatar>
      </Popover.Target>
      <Popover.Dropdown
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          padding: 12,
          maxWidth: 280,
        }}
      >
        <Text size="xs" c="dimmed" mb={8} fw={500}>{t('assistant.form.selectIcon')}</Text>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
          }}
        >
          {ICON_OPTIONS.map(emoji => (
            <Box
              key={emoji}
              onClick={() => { onChange(emoji); setOpened(false); }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                cursor: 'pointer',
                border: value === emoji
                  ? '2px solid var(--flock-accent)'
                  : '2px solid transparent',
                background: value === emoji ? 'var(--flock-accent-soft)' : 'var(--flock-bg-surface)',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {emoji}
              {value === emoji && (
                <Box
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: 'var(--flock-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={8} color="white" />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
