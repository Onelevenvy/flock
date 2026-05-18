import { Box, Text, Button } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';

interface FallbackViewProps {
  fileName: string;
  ext: string;
  filePath: string;
  activeWorkspaceId: string;
}

export function FallbackView({ fileName, ext, filePath, activeWorkspaceId }: FallbackViewProps) {
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
          background: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)', // Neutral Gray
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          marginBottom: 20,
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        FILE
      </Box>

      <Text size="lg" fw={700} style={{ color: 'var(--flock-text-bright)', marginBottom: 8 }}>
        {fileName}
      </Text>

      <Text size="sm" c="dimmed" style={{ maxWidth: 360, marginBottom: 24, lineHeight: 1.5 }}>
        这是一个 {ext.toUpperCase() || '未知'} 格式的文件，暂不支持在应用内直接预览。
      </Text>

      <Button
        size="md"
        variant="outline"
        color="gray"
        leftSection={<IconExternalLink size={16} />}
        style={{
          borderRadius: 12,
        }}
        onClick={handleOpen}
      >
        使用外部应用打开
      </Button>
    </Box>
  );
}
