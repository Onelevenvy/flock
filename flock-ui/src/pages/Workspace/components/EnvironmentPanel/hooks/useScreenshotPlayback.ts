import { useState, useEffect, useCallback } from 'react';
import { useAgentStore } from '@/store/agentStore';
import { extractScreenshotsStructured, type ScreenshotInfo } from '@/pages/Workspace/components/EnvironmentPanel/utils/vncUtils';

export function useScreenshotPlayback(formattedVncUrl: string) {
  const [activeTab, setActiveTab] = useState<'screenshot' | 'vnc'>('screenshot');

  const messages = useAgentStore((s) => s.messages);
  const playbackIndex = useAgentStore((s) => s.playbackIndex);
  const setPlaybackIndex = useAgentStore((s) => s.setPlaybackIndex);

  const screenshots = extractScreenshotsStructured(messages);
  const isOfflineMode = !formattedVncUrl;
  const isPlaybackMode = playbackIndex >= 0 && playbackIndex < screenshots.length;

  useEffect(() => {
    setActiveTab(formattedVncUrl ? 'vnc' : 'screenshot');
  }, [formattedVncUrl]);

  useEffect(() => {
    setPlaybackIndex(-1);
  }, [messages.length, setPlaybackIndex]);

  const handlePrev = useCallback(() => {
    if (screenshots.length === 0) return;
    if (playbackIndex === -1) {
      setPlaybackIndex(screenshots.length - 1);
    } else if (playbackIndex > 0) {
      setPlaybackIndex(playbackIndex - 1);
    }
  }, [screenshots.length, playbackIndex, setPlaybackIndex]);

  const handleNext = useCallback(() => {
    if (screenshots.length === 0) return;
    if (playbackIndex === screenshots.length - 1) {
      setPlaybackIndex(-1);
    } else if (playbackIndex !== -1) {
      setPlaybackIndex(playbackIndex + 1);
    }
  }, [screenshots.length, playbackIndex, setPlaybackIndex]);

  const handleGoLive = useCallback(() => {
    setPlaybackIndex(-1);
  }, [setPlaybackIndex]);

  return {
    activeTab,
    screenshots,
    isOfflineMode,
    isPlaybackMode,
    playbackIndex,
    setPlaybackIndex,
    handlePrev,
    handleNext,
    handleGoLive,
  };
}
