import { useState, useEffect } from 'react';
import { Box, Loader, Text } from '@mantine/core';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useAgentStore } from '../../../../store/agentStore';

interface ImageViewProps {
  absPath?: string;
  workspaceId?: string;
  relativePath?: string;
  fileName: string;
  refreshKey?: number;
}

export function ImageView({ absPath, workspaceId, relativePath, fileName, refreshKey }: ImageViewProps) {
  const [base64, setBase64] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const messages = useAgentStore((state) => state.messages);
  const isToolRunning = messages.some(m => 
    m.chunks.some(c => 
      c.kind === 'tool_request' && 
      (c.status === 'running' || c.status === 'pending') && 
      (c.tool?.name?.toLowerCase().includes('browser') || c.tool?.name?.toLowerCase().includes('computer'))
    )
  );

  useEffect(() => {
    if (!workspaceId || !relativePath) {
      setLoading(false);
      return;
    }

    // 只有当 base64 数据尚未加载出来（第一次加载）时，才显示 loading 骨架屏，避免流式轮询时页面闪烁
    if (!base64) {
      setLoading(true);
    }
    
    invoke<string>('read_workspace_file_as_base64', {
      workspaceId,
      relativePath,
    })
      .then((data) => {
        setBase64(data);
        setError('');
      })
      .catch((err) => {
        console.error('Failed to read image as base64:', err);
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId, relativePath, refreshKey]);

  if (isToolRunning && (loading || error || !base64)) {
    return (
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '16px',
          background: 'var(--flock-bg-deepest)',
          backgroundImage: 'radial-gradient(var(--flock-border-dim, #374151) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      >
        <Loader size="md" color="var(--flock-accent)" type="bars" />
        <Text size="sm" fw={500} c="var(--flock-accent)" style={{ animation: 'pulse 2s infinite' }}>
          正在建立安全连接，即将呈现远程画面...
        </Text>
        <Text size="xs" c="dimmed">
          正在申请并部署 Daytona 沙盒环境
        </Text>
        <style>{`
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
        `}</style>
      </Box>
    );
  }

  if (loading && workspaceId && relativePath) {
    return (
      <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader size="sm" />
      </Box>
    );
  }

  if (error && workspaceId && relativePath) {
    return (
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '8px' }}>
        <Text size="sm" c="red">加载图片失败</Text>
        <Text size="xs" c="dimmed">{error}</Text>
      </Box>
    );
  }

  // 正常渲染。如果是 Base64 形式，直接渲染；否则 fallback 到 convertFileSrc
  const src = base64 ? `data:image/png;base64,${base64}` : (absPath ? convertFileSrc(absPath) : '');

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--flock-bg-deepest)',
        backgroundImage: 'radial-gradient(var(--flock-border-dim, #374151) 1px, transparent 0)',
        backgroundSize: '16px 16px',
        minHeight: '400px',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '450px',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            background: 'var(--flock-bg-base)',
            border: '1px solid var(--flock-border-subtle)',
          }}
        />
      ) : (
        <Text size="sm" c="dimmed">暂无可用图片路径</Text>
      )}
    </Box>
  );
}
