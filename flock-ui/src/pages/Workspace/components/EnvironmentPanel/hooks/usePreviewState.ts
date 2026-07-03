import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAgentStore } from '@/store/agentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * Compute the formatted VNC URL with required query params for noVNC.
 */
export function useVncUrl(rawPath: string | undefined): string {
  return (() => {
    let url = rawPath || '';
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (url.startsWith('https://')) {
      try {
        const u = new URL(url);
        if (u.pathname === '/' || u.pathname === '') {
          u.pathname = '/vnc.html';
        }
        if (!u.searchParams.has('autoconnect')) {
          u.searchParams.set('autoconnect', 'true');
        }
        if (!u.searchParams.has('resize')) {
          u.searchParams.set('resize', 'scale');
        }
        // E2B sandboxes use websockify with `path=websockify`
        // Daytona sandboxes need skip-preview-warning headers instead
        const isE2b = u.hostname.endsWith('.e2b.app');
        if (isE2b) {
          if (!u.searchParams.has('path')) {
            u.searchParams.set('path', 'websockify');
          }
        } else {
          if (!u.searchParams.has('skip-preview-warning')) {
            u.searchParams.set('skip-preview-warning', 'true');
          }
          if (!u.searchParams.has('skip_preview_warning')) {
            u.searchParams.set('skip_preview_warning', 'true');
          }
        }
        return u.toString();
      } catch {
        return url;
      }
    }
    return url;
  })();
}


/**
 * Manage preview file absolute path, screenshot path, and auto-refresh trigger.
 */
export function usePreviewFileState(
  previewFilePath: string | undefined,
  ext: string,
  isPreviewOpen: boolean,
  activeWorkspaceId: string | undefined,
) {
  const [absPath, setAbsPath] = useState<string>('');
  const [screenshotAbsPath, setScreenshotAbsPath] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const activeConversationId = useWorkspaceStore((s) => s.activeConversationId);
  const sessionId = activeConversationId || 'default';
  const targetScreenshotPath = `.flock/sandbox/screenshot_${sessionId}.png`;

  // Detect running sandbox tools for polling frequency
  const messages = useAgentStore((s) => s.messages);
  const isSandboxToolRunning = messages.some(m =>
    m.chunks.some(c =>
      c.kind === 'tool_request' &&
      (c.status === 'running' || c.status === 'pending') &&
      (c.tool?.name?.toLowerCase().includes('browser') ||
       c.tool?.name?.toLowerCase().includes('computer') ||
       c.tool?.name?.toLowerCase().includes('sandbox'))
    )
  );

  // Auto-refresh polling for sandbox screenshot / VNC
  useEffect(() => {
    const isSandboxPreview = previewFilePath === targetScreenshotPath || ext === 'vnc';
    if (!isSandboxPreview || !isPreviewOpen) return;

    const interval = isSandboxToolRunning ? 500 : 1500;
    const timer = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [previewFilePath, targetScreenshotPath, ext, isPreviewOpen, isSandboxToolRunning]);

  // Resolve screenshot absolute path
  useEffect(() => {
    if (activeWorkspaceId) {
      invoke<string>('get_workspace_file_absolute_path', {
        workspaceId: activeWorkspaceId,
        relativePath: targetScreenshotPath,
      })
        .then((path) => { setScreenshotAbsPath(path); })
        .catch((e) => { console.error('Failed to get screenshot path:', e); });
    }
  }, [activeWorkspaceId, targetScreenshotPath]);

  // Resolve file absolute path
  useEffect(() => {
    if (!previewFilePath || !activeWorkspaceId) {
      setAbsPath('');
      return;
    }
    invoke<string>('get_workspace_file_absolute_path', {
      workspaceId: activeWorkspaceId,
      relativePath: previewFilePath,
    })
      .then((path) => { setAbsPath(path); })
      .catch((e) => { console.error('Failed to get absolute path:', e); });
  }, [previewFilePath, activeWorkspaceId]);

  return { absPath, screenshotAbsPath, refreshTrigger, setRefreshTrigger };
}
