import { useState, useEffect } from 'react';
import { Box, Text, ActionIcon, Slider, Group, Badge, Tooltip } from '@mantine/core';
import {
  IconRefresh,
  IconExternalLink,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { ImageView } from '../ImageView';
import { useAgentStore } from '../../../../../store/agentStore';

interface VncViewProps {
  formattedVncUrl: string;
  screenshotAbsPath: string;
  activeWorkspaceId: string;
  refreshTrigger: number;
}

// 提取消息中的 file:/// 物理绝对路径
function extractScreenshots(messages: any[]): string[] {
  const list: string[] = [];
  const fileRegex = /file:\/\/\/([a-zA-Z]:[^\s'")\]\)]+)/gi;
  
  messages.forEach(msg => {
    if (!msg.chunks) return;
    msg.chunks.forEach((chunk: any) => {
      let textToScan = '';
      if (chunk.kind === 'text') {
        textToScan = chunk.text || '';
      } else if (chunk.kind === 'tool_request' && chunk.result) {
        textToScan = chunk.result || '';
      }
      
      if (textToScan) {
        let match;
        const scanText = textToScan.replace(/\\/g, '/');
        fileRegex.lastIndex = 0;
        while ((match = fileRegex.exec(scanText)) !== null) {
          const path = match[1];
          if (!list.includes(path)) {
            list.push(path);
          }
        }
      }
    });
  });
  return list;
}

export function VncView({
  formattedVncUrl,
  screenshotAbsPath,
  activeWorkspaceId,
  refreshTrigger,
}: VncViewProps) {
  const [activeTab, setActiveTab] = useState<'screenshot' | 'vnc'>('screenshot');
  const [playbackIndex, setPlaybackIndex] = useState<number>(-1);

  const messages = useAgentStore((s) => s.messages);
  const screenshots = extractScreenshots(messages);

  // When VNC URL is set, switch to VNC tab
  useEffect(() => {
    if (formattedVncUrl) {
      setActiveTab('vnc');
    }
  }, [formattedVncUrl]);

  // 重置回放索引当消息数量变化时
  useEffect(() => {
    setPlaybackIndex(-1);
  }, [messages.length]);

  const isPlaybackMode = playbackIndex >= 0 && playbackIndex < screenshots.length;

  const handlePrev = () => {
    if (screenshots.length === 0) return;
    if (playbackIndex === -1) {
      setPlaybackIndex(screenshots.length - 1);
    } else if (playbackIndex > 0) {
      setPlaybackIndex(playbackIndex - 1);
    }
  };

  const handleNext = () => {
    if (screenshots.length === 0) return;
    if (playbackIndex === screenshots.length - 1) {
      setPlaybackIndex(-1);
    } else if (playbackIndex !== -1) {
      setPlaybackIndex(playbackIndex + 1);
    }
  };

  const handleGoLive = () => {
    setPlaybackIndex(-1);
  };

  return (
    <Box style={{ width: '100%', height: '100%', padding: '16px', background: 'var(--flock-bg-deepest)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* 头部导航区域 */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--flock-border-dim)', paddingBottom: '8px' }}>
        <Box style={{ display: 'flex', gap: '16px' }}>
          <Box
            onClick={() => {
              if (isPlaybackMode) setPlaybackIndex(-1);
              setActiveTab('screenshot');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: (!isPlaybackMode && activeTab === 'screenshot') ? 'var(--flock-accent)' : 'transparent',
              color: (!isPlaybackMode && activeTab === 'screenshot') ? '#fff' : 'var(--flock-text-dimmed)',
            }}
          >
            📸 实时大图 (图像传屏)
          </Box>
          <Box
            onClick={() => {
              if (isPlaybackMode) setPlaybackIndex(-1);
              setActiveTab('vnc');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: (!isPlaybackMode && activeTab === 'vnc') ? 'var(--flock-accent)' : 'transparent',
              color: (!isPlaybackMode && activeTab === 'vnc') ? '#fff' : 'var(--flock-text-dimmed)',
            }}
          >
            🌐 网页控制台 (noVNC)
          </Box>
        </Box>

        {/* 状态徽章：Live 状态或是回放状态 */}
        <Group gap="xs">
          {isPlaybackMode ? (
            <Badge variant="light" color="orange" size="sm" style={{ height: 24, fontSize: '11px' }}>
              ⏸ 回放模式 ({playbackIndex + 1}/{screenshots.length})
            </Badge>
          ) : (
            <Badge
              variant="light"
              color="teal"
              size="sm"
              style={{ height: 24, fontSize: '11px' }}
              leftSection={
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#2ecc71',
                    display: 'inline-block',
                    animation: 'pulse-live 1.5s infinite',
                  }}
                />
              }
            >
              LIVE 实时
            </Badge>
          )}
          <style>{`
            @keyframes pulse-live {
              0% { transform: scale(0.9); opacity: 0.6; }
              50% { transform: scale(1.2); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0.6; }
            }
          `}</style>
        </Group>
      </Box>

      {/* 主画面展示区域 */}
      <Box style={{ flex: 1, position: 'relative', width: '100%' }}>
        {/* === 1. 回放模式展示 === */}
        {isPlaybackMode && (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '400px' }}>
            <ImageView
              absPath={screenshots[playbackIndex]}
              workspaceId={activeWorkspaceId}
              relativePath=""
              fileName={`Step Snapshot ${playbackIndex + 1}`}
            />
            <Text size="xs" c="var(--flock-accent)" style={{ textAlign: 'center', fontWeight: 600 }}>
              💡 提示：当前展示第 {playbackIndex + 1} 步历史快照，可通过下方时间轴拖动或点击箭头进行翻页。
            </Text>
          </Box>
        )}

        {/* === 2. 实时大图展示 === */}
        {!isPlaybackMode && activeTab === 'screenshot' && (
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

        {/* === 3. VNC 网页控制台展示 === */}
        {!isPlaybackMode && activeTab === 'vnc' && (
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
                height: 'calc(100vh - 380px)',
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

      {/* === 历史回放时间轴底栏 (Manus-AI 精美复刻) === */}
      {screenshots.length > 0 && (
        <Box
          style={{
            marginTop: '8px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--flock-bg-deep)',
            border: '1px solid var(--flock-border-dim)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap={8}>
              <Tooltip label="上一步" withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={handlePrev} disabled={screenshots.length <= 1}>
                  <IconPlayerSkipBack size={14} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="下一步" withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={handleNext} disabled={screenshots.length <= 1}>
                  <IconPlayerSkipForward size={14} />
                </ActionIcon>
              </Tooltip>

              {isPlaybackMode && (
                <Tooltip label="返回实时控制台" withArrow>
                  <ActionIcon variant="light" color="teal" size="sm" onClick={handleGoLive}>
                    <IconDeviceDesktop size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            <Text size="xs" fw={500} c={isPlaybackMode ? 'orange' : 'teal'}>
              {isPlaybackMode ? `正在回放历史：第 ${playbackIndex + 1} / ${screenshots.length} 帧` : `当前处于实时画面 (共 ${screenshots.length} 帧历史)`}
            </Text>
          </Group>

          {/* Slider 拖动条 */}
          <Box style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={screenshots.length}
              value={playbackIndex === -1 ? screenshots.length : playbackIndex}
              onChange={(val) => {
                if (val === screenshots.length) {
                  setPlaybackIndex(-1);
                } else {
                  setPlaybackIndex(val);
                }
              }}
              label={(val) => {
                if (val === screenshots.length) return 'LIVE (实时)';
                return `STEP ${val + 1}`;
              }}
              step={1}
              color={isPlaybackMode ? 'orange' : 'teal'}
              styles={{
                track: {
                  background: 'var(--flock-border-dim)',
                  height: '6px',
                },
                bar: {
                  height: '6px',
                },
                thumb: {
                  border: isPlaybackMode ? '2px solid var(--mantine-color-orange-5)' : '2px solid var(--mantine-color-teal-5)',
                  width: '16px',
                  height: '16px',
                }
              }}
            />
          </Box>
        </Box>
      )}

    </Box>
  );
}
