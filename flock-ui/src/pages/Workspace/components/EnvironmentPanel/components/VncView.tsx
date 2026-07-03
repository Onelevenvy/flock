import { memo } from 'react';
import { Box } from '@mantine/core';
import { ImageView } from '@/pages/Workspace/components/EnvironmentPanel/ImageView';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getRelativePath } from '@/pages/Workspace/components/EnvironmentPanel/utils/vncUtils';
import { useScreenshotPlayback } from '@/pages/Workspace/components/EnvironmentPanel/hooks/useScreenshotPlayback';
import { VncHeader } from './VncHeader';
import { VncTimeline } from './VncTimeline';
import { ActionOverlay } from './ActionOverlay';

export type { ScreenshotInfo } from '@/pages/Workspace/components/EnvironmentPanel/utils/vncUtils';

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
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);

  const {
    activeTab,
    screenshots,
    isOfflineMode,
    isPlaybackMode,
    playbackIndex,
    setPlaybackIndex,
    handlePrev,
    handleNext,
    handleGoLive,
  } = useScreenshotPlayback(formattedVncUrl);

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        padding: '16px',
        background: 'var(--flock-bg-deepest)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <VncHeader
        isOfflineMode={isOfflineMode}
        isPlaybackMode={isPlaybackMode}
        formattedVncUrl={formattedVncUrl}
        playbackIndex={playbackIndex}
        screenshotCount={screenshots.length}
      />

      <Box style={{ flex: 1, position: 'relative', width: '100%' }}>
        {isPlaybackMode && (
          <Box
            style={{
              position: 'relative',
              width: '100%',
              height: 'calc(100vh - 380px)',
              border: '1px solid var(--flock-border-dim)',
              background: 'var(--flock-bg-deep)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageView
              absPath={screenshots[playbackIndex].path}
              workspaceId={activeWorkspaceId}
              relativePath={getRelativePath(screenshots[playbackIndex].path)}
              fileName={`Step Snapshot ${playbackIndex + 1}`}
              fullWidth={true}
            />
            <ActionOverlay info={screenshots[playbackIndex]} />
          </Box>
        )}

        {!isPlaybackMode && activeTab === 'screenshot' && (
          <Box
            style={{
              position: 'relative',
              width: '100%',
              height: 'calc(100vh - 380px)',
              border: '1px solid var(--flock-border-dim)',
              background: 'var(--flock-bg-deep)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageView
              absPath={
                isOfflineMode && screenshots.length > 0
                  ? screenshots[screenshots.length - 1].path
                  : screenshotAbsPath
              }
              workspaceId={activeWorkspaceId}
              relativePath={
                isOfflineMode && screenshots.length > 0
                  ? getRelativePath(screenshots[screenshots.length - 1].path)
                  : `.flock/sandbox/screenshot_${activeConversationId || 'default'}.png`
              }
              fileName="FLOCK COMPUTER"
              refreshKey={refreshTrigger}
              fullWidth={true}
            />
          </Box>
        )}

        {!isPlaybackMode && activeTab === 'vnc' && !isOfflineMode && (
          <Box style={{ width: '100%', height: '100%' }}>
            <StableVncIframe vncUrl={formattedVncUrl} />
          </Box>
        )}
      </Box>

      <VncTimeline
        screenshots={screenshots}
        isPlaybackMode={isPlaybackMode}
        isOfflineMode={isOfflineMode}
        playbackIndex={playbackIndex}
        onPrev={handlePrev}
        onNext={handleNext}
        onGoLive={handleGoLive}
        onChangeIndex={setPlaybackIndex}
      />
    </Box>
  );
}

/**
 * Memoized iframe that only remounts when vncUrl changes.
 * Prevents noVNC WebSocket from being disconnected by parent re-renders
 * caused by screenshot polling (refreshTrigger).
 */
const StableVncIframe = memo(function StableVncIframe({ vncUrl }: { vncUrl: string }) {
  return (
    <iframe
      id="flock-vnc-iframe"
      src={vncUrl}
      style={{
        width: '100%',
        height: 'calc(100vh - 380px)',
        border: '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-deep)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        display: 'block',
      }}
      allow="fullscreen; clipboard-read; clipboard-write; autoplay"
    />
  );
});
