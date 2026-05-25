import { useState } from 'react';
import { Box, Group, Text, ActionIcon, Collapse } from '@mantine/core';
import { IconBrain, IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ThinkingBlockProps {
  text: string;
  defaultCollapsed: boolean;
}

export function ThinkingBlock({ text, defaultCollapsed }: ThinkingBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { t } = useTranslation();
  
  return (
    <Box
      style={{
        background: 'var(--flock-bg-surface)',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 6,
        border: '1px solid var(--flock-border-dim)',
      }}
    >
      <Group
        gap={6}
        style={{ cursor: 'pointer' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <IconBrain size={13} color="var(--flock-text-secondary)" />
        <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)' }}>
          {t('chat.thinkingProcess')}
        </Text>
        <ActionIcon size="xs" variant="transparent" color="gray">
          {collapsed ? <IconChevronRight size={11} /> : <IconChevronDown size={11} />}
        </ActionIcon>
      </Group>
      <Collapse in={!collapsed}>
        <Text
          size="xs"
          mt={6}
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--mantine-font-family-monospace)',
            lineHeight: 1.65,
            color: 'var(--flock-text-secondary)',
            wordBreak: 'break-all',
          }}
        >
          {text}
        </Text>
      </Collapse>
    </Box>
  );
}
