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
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';

interface VncViewProps {
  formattedVncUrl: string;
  screenshotAbsPath: string;
  activeWorkspaceId: string;
  refreshTrigger: number;
}

export interface ScreenshotInfo {
  path: string;
  callId: string;
  action?: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  toolName?: string;
}

// 提取物理路径中关于 .flock/sandbox/screenshots/ 的相对工作空间路径
function getRelativePath(absPath: string): string {
  if (!absPath) return "";
  const normalized = absPath.replace(/\\/g, '/');
  const keyword = ".flock/sandbox/screenshots/";
  const idx = normalized.indexOf(keyword);
  if (idx !== -1) {
    return normalized.substring(idx);
  }
  return "";
}

// 结构化提取消息中的截图物理绝对路径，并关联当时的 Tool 动作参数
function extractScreenshotsStructured(messages: any[]): ScreenshotInfo[] {
  const list: ScreenshotInfo[] = [];
  const fileRegex = /file:\/\/\/([^\s'")\])]+\.png)/gi;
  
  // 1. 扫描所有图片物理路径
  const foundPaths: string[] = [];
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
          let path = match[1];
          // 如果是 Windows 风格的以 / 开头的路径 (如 /C:/...)，则去掉前导斜杠
          if (path.match(/^\/[a-zA-Z]:/)) {
            path = path.substring(1);
          }
          if (!foundPaths.includes(path)) {
            foundPaths.push(path);
          }
        }
      }
    });
  });

  // 2. 根据物理路径，提取文件名中的 callId 并关联动作
  foundPaths.forEach(path => {
    const baseName = path.split(/[/\\]/).pop() || '';
    const callId = baseName.replace(/\.png$/i, '');
    
    let action = '';
    let x: number | undefined = undefined;
    let y: number | undefined = undefined;
    let text = '';
    let key = '';
    let toolName = '';

    for (const msg of messages) {
      if (!msg.chunks) continue;
      const foundChunk = msg.chunks.find((c: any) => c.kind === 'tool_request' && c.call_id === callId);
      if (foundChunk && foundChunk.tool) {
        toolName = foundChunk.tool.name || '';
        const args = foundChunk.tool.args || {};
        try {
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
          action = parsedArgs.action || '';
          x = typeof parsedArgs.x === 'number' ? parsedArgs.x : (parsedArgs.x ? parseInt(parsedArgs.x) : undefined);
          y = typeof parsedArgs.y === 'number' ? parsedArgs.y : (parsedArgs.y ? parseInt(parsedArgs.y) : undefined);
          text = parsedArgs.text || '';
          key = parsedArgs.key || parsedArgs.button || '';
        } catch (e) {
          // Fallback if parsing fails
        }
        break;
      }
    }

    list.push({
      path,
      callId,
      action,
      x,
      y,
      text,
      key,
      toolName
    });
  });

  return list;
}

// Manus 风格的动作高亮悬浮图层
function ActionOverlay({ info }: { info: ScreenshotInfo }) {
  if (info.x === undefined || info.y === undefined || info.x < 0 || info.y < 0) return null;

  // 根据 Daytona 标准分辨率 1024x768 换算为百分比
  const xPercent = Math.min(Math.max((info.x / 1024) * 100, 0), 100);
  const yPercent = Math.min(Math.max((info.y / 768) * 100, 0), 100);

  const isClick = ['click', 'move', 'drag', 'double_click', 'right_click'].includes(info.action?.toLowerCase() || '');
  const isType = ['type', 'fill'].includes(info.action?.toLowerCase() || '');

  return (
    <Box
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* 1. 脉冲波纹红圈 (点击动作) */}
      {isClick && (
        <>
          <Box
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255, 59, 48, 0.35)',
              border: '2px solid #ff3b30',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'ripple 1.5s infinite ease-out',
            }}
          />
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ff3b30',
              boxShadow: '0 0 8px rgba(255, 59, 48, 0.8)',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </>
      )}

      {/* 2. 绿色输入框焦点与输入提示 (打字输入动作) */}
      {isType && (
        <>
          <Box
            style={{
              width: 20,
              height: 20,
              border: '2px dashed #34c759',
              borderRadius: 4,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'typePulse 2.0s infinite ease-in-out',
            }}
          />
          <Box
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(52, 199, 89, 0.4)',
              color: '#34c759',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              position: 'absolute',
              top: 22,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            输入: "{info.text}"
          </Box>
        </>
      )}

      {/* 3. 步骤动作 Tooltip */}
      <Box
        style={{
          background: 'rgba(26, 27, 30, 0.9)',
          border: '1px solid var(--flock-border-dim)',
          color: '#eef2f6',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: '10px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {info.action ? `${info.action.toUpperCase()}` : 'ACTION'} ({info.x}, {info.y})
      </Box>

      {/* 关键帧动画注入 */}
      <style>{`
        @keyframes ripple {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes typePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }
      `}</style>
    </Box>
  );
}

export function VncView({
  formattedVncUrl,
  screenshotAbsPath,
  activeWorkspaceId,
  refreshTrigger,
}: VncViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'screenshot' | 'vnc'>('screenshot');
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);

  const messages = useAgentStore((s) => s.messages);
  const playbackIndex = useAgentStore((s) => s.playbackIndex);
  const setPlaybackIndex = useAgentStore((s) => s.setPlaybackIndex);

  const screenshots = extractScreenshotsStructured(messages);

  const isOfflineMode = !formattedVncUrl; // 无活跃 VNC 代理时属于离线回放模式

  // 当有 VNC URL 时默认切到 VNC，否则强制使用截图 Tab
  useEffect(() => {
    if (formattedVncUrl) {
      setActiveTab('vnc');
    } else {
      setActiveTab('screenshot');
    }
  }, [formattedVncUrl]);

  // 重置回放索引当消息数量变化时
  useEffect(() => {
    setPlaybackIndex(-1);
  }, [messages.length, setPlaybackIndex]);

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
        <Group gap={8}>
          <IconDeviceDesktop size={14} color="var(--flock-accent)" />
          <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', letterSpacing: '0.5px' }}>
            {isOfflineMode 
              ? t('chat.vnc.screenshotPlaybackTitle', { defaultValue: 'DESKTOP PLAYBACK' }) 
              : t('chat.vnc.liveDesktopTitle', { defaultValue: 'LIVE DESKTOP' })}
          </Text>
        </Group>

        {/* 状态徽章：Live 状态或是回放状态 */}
        <Group gap="xs">
          {!isPlaybackMode && !isOfflineMode && (
            <Group gap={6} mr={6}>
              <Tooltip label={t('chat.vnc.openInBrowser')} withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={() => window.open(formattedVncUrl, '_blank')}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('chat.vnc.reloadConsole')} withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="blue"
                  onClick={() => {
                    const iframe = document.getElementById('flock-vnc-iframe') as HTMLIFrameElement | null;
                    if (iframe) {
                      iframe.src = formattedVncUrl;
                    }
                  }}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}

          {isPlaybackMode ? (
            <Badge variant="light" color="orange" size="sm" style={{ height: 24, fontSize: '11px' }}>
              {t('chat.vnc.playbackMode', { current: playbackIndex + 1, total: screenshots.length })}
            </Badge>
          ) : isOfflineMode ? (
            <Badge variant="light" color="gray" size="sm" style={{ height: 24, fontSize: '11px' }}>
              {t('chat.vnc.offlineReplay', { defaultValue: '离线历史记录' })}
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
              {t('chat.vnc.liveStatus')}
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
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <Box 
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: 'calc(100vh - 380px)', // 与 VNC 实时尺寸 100% 物理对齐！
                border: '1px solid var(--flock-border-dim)',
                background: 'var(--flock-bg-deep)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ImageView
                absPath={screenshots[playbackIndex].path}
                workspaceId={activeWorkspaceId}
                relativePath={getRelativePath(screenshots[playbackIndex].path)}
                fileName={`Step Snapshot ${playbackIndex + 1}`}
                fullWidth={true}
              />
              {/* Manus 风格的动作高亮叠加图层 */}
              <ActionOverlay info={screenshots[playbackIndex]} />
            </Box>
          </Box>
        )}

        {/* === 2. 实时大图展示 (或离线模式下的首屏静态展示) === */}
        {!isPlaybackMode && activeTab === 'screenshot' && (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <Box 
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: 'calc(100vh - 380px)', // 同样与 VNC 高度绝对对齐！
                border: '1px solid var(--flock-border-dim)',
                background: 'var(--flock-bg-deep)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ImageView
                absPath={isOfflineMode && screenshots.length > 0 ? screenshots[screenshots.length - 1].path : screenshotAbsPath}
                workspaceId={activeWorkspaceId}
                relativePath={isOfflineMode && screenshots.length > 0 ? getRelativePath(screenshots[screenshots.length - 1].path) : `.flock/sandbox/screenshot_${activeConversationId || 'default'}.png`}
                fileName="FLOCK COMPUTER"
                refreshKey={refreshTrigger}
                fullWidth={true}
              />
            </Box>
          </Box>
        )}

        {/* === 3. VNC 网页控制台展示 === */}
        {!isPlaybackMode && activeTab === 'vnc' && !isOfflineMode && (
          <Box style={{ width: '100%', height: '100%' }}>
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                display: 'block'
              }}
              allow="fullscreen; clipboard-read; clipboard-write; autoplay"
            />
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
              <Tooltip label={t('chat.vnc.prevStep')} withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={handlePrev} disabled={screenshots.length <= 1}>
                  <IconPlayerSkipBack size={14} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label={t('chat.vnc.nextStep')} withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={handleNext} disabled={screenshots.length <= 1}>
                  <IconPlayerSkipForward size={14} />
                </ActionIcon>
              </Tooltip>

              {isPlaybackMode && !isOfflineMode && (
                <Tooltip label={t('chat.vnc.backToLive')} withArrow>
                  <ActionIcon variant="light" color="teal" size="sm" onClick={handleGoLive}>
                    <IconDeviceDesktop size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            <Text size="xs" fw={500} c={isPlaybackMode ? 'orange' : 'teal'}>
              {isPlaybackMode 
                ? t('chat.vnc.playbackStatus', { current: playbackIndex + 1, total: screenshots.length }) 
                : isOfflineMode
                ? t('chat.vnc.offlineReplayTotal', { total: screenshots.length, defaultValue: `回放共计 ${screenshots.length} 步` })
                : t('chat.vnc.liveStatusWithTotal', { total: screenshots.length })}
            </Text>
          </Group>

          {/* Slider 拖动条 */}
          <Box style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={screenshots.length - (isOfflineMode ? 1 : 0)}
              value={playbackIndex === -1 ? (isOfflineMode ? screenshots.length - 1 : screenshots.length) : playbackIndex}
              onChange={(val) => {
                if (!isOfflineMode && val === screenshots.length) {
                  setPlaybackIndex(-1);
                } else {
                  setPlaybackIndex(val);
                }
              }}
              label={(val) => {
                if (!isOfflineMode && val === screenshots.length) return t('chat.vnc.liveLabel');
                const actionDesc = screenshots[val]?.action ? ` (${screenshots[val].action})` : '';
                return t('chat.vnc.stepLabel', { index: val + 1 }) + actionDesc;
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

