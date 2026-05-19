import { Box, Text, Button } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';

interface OfficeViewProps {
  fileName: string;
  ext: string;
  filePath: string;
  activeWorkspaceId: string;
}

export function OfficeView({ fileName, ext, filePath, activeWorkspaceId }: OfficeViewProps) {
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
          background:
            ext.startsWith('xls')
              ? 'linear-gradient(135deg, #107c41 0%, #1f9a55 100%)' // Excel Green
              : ext.startsWith('ppt')
              ? 'linear-gradient(135deg, #c43e1c 0%, #d85230 100%)' // PPT Orange/Red
              : 'linear-gradient(135deg, #2b579a 0%, #3b6ea5 100%)', // Word Blue
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          marginBottom: 20,
          color: '#ffffff',
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        {ext.substring(0, 3).toUpperCase()}
      </Box>

      <Text size="lg" fw={700} style={{ color: 'var(--flock-text-bright)', marginBottom: 8 }}>
        {fileName}
      </Text>

      <Text size="sm" c="dimmed" style={{ maxWidth: 360, marginBottom: 24, lineHeight: 1.5 }}>
        这是一个 {ext.toUpperCase()} 办公文档。为了获得最完美、无损的排版效果，请使用系统默认软件直接打开编辑。
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
        在系统应用中打开
      </Button>

      <Text size="xs" c="dimmed" style={{ marginTop: 16, opacity: 0.6 }}>
        💡 提示：在本地 Office / WPS 中编辑并保存后，工作空间会自动实时同步。
      </Text>
    </Box>
  );
}
