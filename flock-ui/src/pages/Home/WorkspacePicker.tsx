import { useState } from 'react';
import { Popover, UnstyledButton, Text, Stack } from '@mantine/core';
import { IconFolder, IconChevronDown, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';

export function WorkspacePicker({
  onSelect,
}: {
  onSelect: (wsId: string, wsPath: string, wsName: string) => void;
}) {
  const { t } = useTranslation();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const [opened, setOpened] = useState(false);
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);

  return (
    <Popover opened={opened} onClose={() => setOpened(false)} position="top-start" withinPortal shadow="lg" withArrow>
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'var(--flock-bg-surface)',
            border: '1px solid var(--flock-border-dim)',
            color: activeWs ? 'var(--flock-text-primary)' : 'var(--flock-text-dim)',
            fontSize: 13,
            transition: 'all 0.15s',
          }}
        >
          <IconFolder size={14} style={{ flexShrink: 0 }} />
          <Text size="xs" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeWs ? activeWs.name : t('home.setWorkspace')}
          </Text>
          <IconChevronDown size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--flock-bg-raised)', border: '1px solid var(--flock-border-dim)', padding: 8, minWidth: 200 }}>
        <Text size="xs" c="dimmed" mb={6} px={4} fw={500}>{t('home.selectWorkspace')}</Text>
        {workspaces.length === 0 ? (
          <Text size="xs" c="dimmed" px={4} py={4}>{t('home.noWorkspace')}</Text>
        ) : (
          <Stack gap={2}>
            {workspaces.map(ws => (
              <UnstyledButton
                key={ws.id}
                onClick={() => { onSelect(ws.id, ws.path, ws.name); setOpened(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: ws.id === activeWorkspaceId ? 'var(--flock-accent-soft)' : 'transparent',
                  fontSize: 13,
                  color: 'var(--flock-text-primary)',
                }}
              >
                <IconFolder size={13} color={ws.id === activeWorkspaceId ? 'var(--flock-accent)' : 'var(--flock-text-secondary)'} />
                <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</Text>
                {ws.id === activeWorkspaceId && <IconCheck size={12} color="var(--flock-accent)" />}
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
