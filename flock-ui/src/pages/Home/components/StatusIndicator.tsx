import { Text, Group } from '@mantine/core';

interface StatusIndicatorProps {
  t: (key: string, defaultValue?: string | { [key: string]: any }) => string;
  status: string;
  selectedAssistant: { name: string };
  activeWs: { name: string } | undefined;
  activeWorkspaceId: string | null;
  onRetry: () => void;
}

export function StatusIndicator({
  t,
  status,
  selectedAssistant,
  activeWs,
  activeWorkspaceId,
  onRetry,
}: StatusIndicatorProps) {
  return (
    <>
      {status === 'connecting' && (
        <Text size="xs" c="dimmed" mt={12} style={{ opacity: 0.6 }}>
          {t('home.connectingAgent', { name: selectedAssistant.name })}
        </Text>
      )}
      {status === 'error' && (
        <Group gap={6} mt={12}>
          <Text size="xs" color="red" style={{ opacity: 0.8 }}>
            Agent 连接失败
          </Text>
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '12px',
              color: 'var(--flock-accent)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
            onClick={onRetry}
          >
            点击重试
          </button>
        </Group>
      )}
      {status === 'ready' && activeWs && (
        <Text size="xs" c="dimmed" mt={10} style={{ opacity: 0.45, fontSize: 11 }}>
          {t('home.disclaimer', { name: selectedAssistant.name, workspace: activeWs.name })}
        </Text>
      )}
      {!activeWorkspaceId && (
        <Text size="xs" c="dimmed" mt={10} style={{ opacity: 0.5 }}>
          {t('home.startDialogHelp')}
        </Text>
      )}
    </>
  );
}
