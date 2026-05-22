import { useState, useEffect } from 'react';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { ImageView } from '../ImageView';

interface VncViewProps {
  formattedVncUrl: string;
  screenshotAbsPath: string;
  activeWorkspaceId: string;
  refreshTrigger: number;
}

export function VncView({
  formattedVncUrl,
  screenshotAbsPath,
  activeWorkspaceId,
  refreshTrigger,
}: VncViewProps) {
  const [activeTab, setActiveTab] = useState<'screenshot' | 'vnc'>('screenshot');

  // When VNC URL is set, switch to VNC tab
  useEffect(() => {
    if (formattedVncUrl) {
      setActiveTab('vnc');
    }
  }, [formattedVncUrl]);

  return (
    <Box style={{ width: '100%', height: '100%', padding: '16px', background: 'var(--flock-bg-deepest)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Tabs 头部 */}
      <Box style={{ display: 'flex', borderBottom: '1px solid var(--flock-border-dim)', paddingBottom: '8px', gap: '16px' }}>
        <Box
          onClick={() => setActiveTab('screenshot')}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: activeTab === 'screenshot' ? 'var(--flock-accent)' : 'transparent',
            color: activeTab === 'screenshot' ? '#fff' : 'var(--flock-text-dimmed)',
          }}
        >
          📸 实时大图 (图像传屏)
        </Box>
        <Box
          onClick={() => setActiveTab('vnc')}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: activeTab === 'vnc' ? 'var(--flock-accent)' : 'transparent',
            color: activeTab === 'vnc' ? '#fff' : 'var(--flock-text-dimmed)',
          }}
        >
          🌐 网页控制台 (noVNC)
        </Box>
      </Box>

      {/* 📸 实时截图 (图像传屏) */}
      {activeTab === 'screenshot' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '400px' }}>
          <ImageView
            absPath={screenshotAbsPath}
            workspaceId={activeWorkspaceId}
            relativePath=".flock/sandbox/screenshot.png"
            fileName="FLOCK COMPUTER"
            refreshKey={refreshTrigger}
          />
          <Text size="xs" c="dimmed" style={{ textAlign: 'center', maxWidth: '80%', lineHeight: '1.6' }}>
            💡 **提示**：图像传屏模式免受 HTTPS 证书及 HSTS 拦截影响，为您 100% 稳定高保真展现当前沙盒桌面状态。您可以让 Agent 执行操作以流式刷新画面。
          </Text>
        </Box>
      )}

      {/* 🌐 网页控制台 (noVNC) */}
      {activeTab === 'vnc' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {/* 工具栏：链接 + 刷新 */}
          <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text
              size="xs"
              c="dimmed"
              style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {formattedVncUrl}
            </Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              title="在浏览器中打开"
              onClick={() => window.open(formattedVncUrl, '_blank')}
            >
              <IconExternalLink size={13} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="blue"
              title="重载远程控制台（VNC 服务启动后点此刷新）"
              onClick={() => {
                const iframe = document.getElementById('flock-vnc-iframe') as HTMLIFrameElement | null;
                if (iframe) {
                  iframe.src = formattedVncUrl;
                }
              }}
            >
              <IconRefresh size={13} />
            </ActionIcon>
          </Box>

          <iframe
            id="flock-vnc-iframe"
            key={formattedVncUrl}
            src={formattedVncUrl}
            style={{
              width: '100%',
              height: 'calc(100vh - 320px)',
              border: '1px solid var(--flock-border-dim)',
              background: 'var(--flock-bg-deep)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
            allow="fullscreen; clipboard-read; clipboard-write; autoplay"
          />

          <Box style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(59,130,246,0.3)',
            background: 'rgba(59,130,246,0.05)',
            fontSize: '11px',
            color: 'var(--flock-text-dimmed)',
            lineHeight: '1.6'
          }}>
            💡 首次打开会看到 Daytona 预览警告，点击 <strong>I Understand, Continue</strong> 即可进入。若点击后仍空白，说明 VNC 服务正在后台启动（约 5-10 秒），点击上方 <strong>刷新按钮 🔄</strong> 重载即可。
          </Box>
        </Box>
      )}
    </Box>
  );
}
