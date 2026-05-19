import { Box, Text, Button } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

interface FallbackViewProps {
  fileName: string;
  ext: string;
  filePath: string;
  activeWorkspaceId: string;
}

export function FallbackView({ fileName, ext, filePath, activeWorkspaceId }: FallbackViewProps) {
  const { t } = useTranslation();

  const handleOpen = async () => {
    try {
      await invoke('open_workspace_file_in_system', {
        workspaceId: activeWorkspaceId,
        relativePath: filePath,
      });
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  };

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <Box
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'var(--flock-accent-soft)',
          border: '1.5px dashed var(--flock-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px var(--flock-accent-soft)',
          marginBottom: 20,
          color: 'var(--flock-accent)',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        {ext.substring(0, 4).toUpperCase() || 'FILE'}
      </Box>

      <Text size="lg" fw={700} style={{ color: 'var(--flock-text-bright)', marginBottom: 8 }}>
        {fileName}
      </Text>

      <Text size="sm" c="dimmed" style={{ maxWidth: 360, marginBottom: 24, lineHeight: 1.5 }}>
        {t('workspace.fallbackDesc', { ext: ext.toUpperCase() || t('workspace.unknown') })}
      </Text>

      <Button
        size="md"
        color="blue"
        leftSection={<IconExternalLink size={16} />}
        style={{
          background: 'linear-gradient(135deg, #155aef 0%, #36bffa 100%)',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(21, 90, 239, 0.2)',
        }}
        onClick={handleOpen}
      >
        {t('workspace.openExternal')}
      </Button>
    </Box>
  );
}
