import { useState } from 'react';
import { Box, Text, Avatar, Popover } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

export const ICON_OPTIONS = [
  '🤖', '💻', '✍️', '📊', '🔍', '🎨', '📚', '🧠', '⚡', '🌐',
  '🔧', '🎯', '📝', '🚀', '💡', '🎓', '🔬', '📱', '🌍', '🎭',
  '🦊', '🐉', '🦁', '🎵', '🏆', '💎', '🌟', '🔮', '🎮', '🛸',
];

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onClose={() => setOpened(false)}
      position="bottom-start"
      withArrow
      shadow="lg"
      withinPortal
    >
      <Popover.Target>
        <Avatar
          size={38}
          radius="md"
          onClick={() => setOpened(o => !o)}
          style={{
            cursor: 'pointer',
            background: 'var(--flock-bg-base)',
            fontSize: 20,
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
        <Text size="xs" c="dimmed" mb={8} fw={500}>选择头像</Text>
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
