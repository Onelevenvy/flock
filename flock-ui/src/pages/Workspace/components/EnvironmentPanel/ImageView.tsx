import { useState, useEffect } from 'react';
import { Box, Loader, Text } from '@mantine/core';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useAgentStore } from '../../../../store/agentStore';
import { useTranslation } from 'react-i18next';

interface ImageViewProps {
  absPath?: string;
  workspaceId?: string;
  relativePath?: string;
  fileName: string;
  refreshKey?: number;
  fullWidth?: boolean;
}

export function ImageView({ absPath, workspaceId, relativePath, fileName, refreshKey, fullWidth }: ImageViewProps) {
  const { t } = useTranslation();
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
        // 只有在既无历史图片数据、也无后台工具运行时，才抛出可见加载错误，避免工具运行期间的临时文件缺失导致红字或卡死
        if (!base64 && !isToolRunning) {
          setError(String(err));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId, relativePath, refreshKey, isToolRunning]);

  if (isToolRunning && !base64 && (loading || error)) {
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
          {t('chat.vnc.establishingConnection')}
        </Text>
        <Text size="xs" c="dimmed">
          {t('chat.vnc.deployingDaytona')}
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
    const errLower = error.toLowerCase();
    const isNotFound = errLower.includes('notfound') || errLower.includes('文件不存在') || errLower.includes('no such file or directory') || errLower.includes('entity not found');
    if (isNotFound) {
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
            padding: '24px',
            background: 'var(--flock-bg-deepest)',
            backgroundImage: 'radial-gradient(var(--flock-border-dim, #374151) 1px, transparent 0)',
            backgroundSize: '16px 16px',
            borderRadius: '12px',
            border: '1px dashed var(--flock-border-dim)',
          }}
        >
          {/* 高级科技感雷达/桌面扫描图标 */}
          <Box style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px dashed var(--flock-accent, #3b82f6)',
                opacity: 0.3,
                animation: 'spin-dashed 20s linear infinite',
              }}
            />
            <span
              style={{
                position: 'absolute',
                width: '80%',
                height: '80%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}
            />
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--flock-accent, #3b82f6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.5))' }}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </Box>

          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-base)' }}>
              {t('chat.vnc.waitingForAction')}
            </Text>
            <Text size="xs" c="dimmed" style={{ maxWidth: '340px', lineHeight: 1.5 }}>
              {t('chat.vnc.noActionTip')}
            </Text>
          </Box>

          <style>{`
            @keyframes spin-dashed {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse-glow {
              0% { transform: scale(0.95); opacity: 0.4; }
              50% { transform: scale(1.1); opacity: 0.8; }
              100% { transform: scale(0.95); opacity: 0.4; }
            }
          `}</style>
        </Box>
      );
    }

    return (
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '8px' }}>
        <Text size="sm" c="red">{t('chat.vnc.failedToLoadImage')}</Text>
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
        padding: fullWidth ? '0px' : '24px',
        background: fullWidth ? 'transparent' : 'var(--flock-bg-deepest)',
        backgroundImage: fullWidth ? 'none' : 'radial-gradient(var(--flock-border-dim, #374151) 1px, transparent 0)',
        backgroundSize: '16px 16px',
        minHeight: fullWidth ? '100%' : '400px',
        width: '100%',
        height: '100%',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={fileName}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: fullWidth ? '0px' : '8px',
            boxShadow: fullWidth ? 'none' : '0 8px 30px rgba(0,0,0,0.2)',
            background: 'transparent',
            border: 'none',
          }}
        />
      ) : (
        <Text size="sm" c="dimmed">{t('chat.vnc.noImageAvailable')}</Text>
      )}
    </Box>
  );
}
