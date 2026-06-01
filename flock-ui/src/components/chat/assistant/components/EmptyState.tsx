import { Box, Stack, Text, Button } from '@mantine/core';
import { IconSparkles, IconMessage, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useWorkspacesQuery, useCreateConversationMutation } from '@/hooks/useWorkspaces';
import { useAgentStore } from '@/store/agentStore';

export function EmptyState() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { mutateAsync: createConversation } = useCreateConversationMutation();
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const { t } = useTranslation();

  const handleNewConv = async () => {
    if (!activeWorkspaceId) return;
    try {
      await createConversation({ workspaceId: activeWorkspaceId, title: '' });
      clearMessages();
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {!activeWorkspaceId ? (
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'var(--flock-accent-soft)',
              border: '1px solid var(--flock-border-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSparkles size={32} color="rgba(21, 90, 239, 0.7)" />
          </Box>
          <Stack align="center" gap={6}>
            <Text fw={600} size="lg" c="var(--flock-text-bright)">
              {t('chat.welcomeTitle')}
            </Text>
            <Text size="sm" c="dimmed" style={{ textAlign: 'center', maxWidth: 320 }}>
              {t('chat.welcomeDesc')}
            </Text>
          </Stack>
        </Stack>
      ) : (
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--flock-accent-soft)',
              border: '1px solid var(--flock-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMessage size={28} color="rgba(21, 90, 239, 0.6)" />
          </Box>
          <Stack align="center" gap={6}>
            <Text fw={500} size="md" c="var(--flock-text-primary)">
              {activeWs?.name}
            </Text>
            <Text size="sm" c="dimmed" style={{ textAlign: 'center', maxWidth: 280 }}>
              {t('chat.startNewConv')}
            </Text>
          </Stack>
          <Button
            variant="light"
            color="blue"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={handleNewConv}
          >
            {t('chat.newConv')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
