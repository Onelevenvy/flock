import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../../store/petStore';
import { useXiaofState } from '../../hooks/useXiaofState';
import { useAgentStore } from '../../store/agentStore';

/**
 * XiaofSyncManager
 * 作为一个无 DOM 渲染的背景管理器，将主窗口的状态和审批任务通过 Tauri Command 实时同步到 Rust。
 * 桌面悬浮宠物窗口 (XiaofOverlayApp) 接收全局事件并完成状态渲染及交互。
 */
export function XiaofSyncManager() {
  const { enabled, minimized, setMinimized } = usePetStore();
  const { mood, bubbleText, pendingCount } = useXiaofState();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);

  // 1. 实时同步基本状态 (mood, pendingCount, enabled, bubbleText, minimized, pendingTool, pendingCallId)
  useEffect(() => {
    const firstPending = pendingApprovals[0];
    invoke('sync_pet_state', {
      state: {
        mood,
        pendingCount,
        enabled,
        bubbleText,
        minimized,
        pendingTool: firstPending ? firstPending.tool.name : null,
        pendingCallId: firstPending ? firstPending.call_id : null,
      }
    }).catch((err) => console.error('[Pet Sync] Failed to sync pet state:', err));
  }, [mood, pendingCount, enabled, bubbleText, minimized, pendingApprovals]);

  // 2. 实时同步待审批的任务信息
  useEffect(() => {
    const firstPending = pendingApprovals[0];
    if (firstPending) {
      invoke('sync_pet_pending_approval', {
        approval: {
          tool_name: firstPending.tool.name,
          call_id: firstPending.call_id,
        }
      }).catch((err) => console.error('[Pet Sync] Failed to sync pending approval:', err));
    } else {
      invoke('sync_pet_pending_approval', {
        approval: null
      }).catch((err) => console.error('[Pet Sync] Failed to clear pending approval:', err));
    }
  }, [pendingApprovals]);

  // 3. 监听来自悬浮宠物的双击最小化事件，回写到 store
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<boolean>('xiaof-minimized-change', (evt) => {
      setMinimized(evt.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setMinimized]);

  // 4. 监听来自桌宠的「拉取状态」请求，在它刚启动时立即补发一次最新状态
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('xiaof-pull-state-request', () => {
      const firstPending = pendingApprovals[0];
      invoke('sync_pet_state', {
        state: {
          mood,
          pendingCount,
          enabled,
          bubbleText,
          minimized,
          pendingTool: firstPending ? firstPending.tool.name : null,
          pendingCallId: firstPending ? firstPending.call_id : null,
        }
      }).catch((err) => console.error('[Pet Sync] Failed to sync pet state on pull request:', err));
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [mood, pendingCount, enabled, bubbleText, minimized, pendingApprovals]);

  // 5. 监听来自桌宠的乐观操作事件，提前在主窗口移除该项以加速同步
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ callId: string; action: 'approve' | 'deny' }>('xiaof-approve-action', (evt) => {
      removePendingApproval(evt.payload.callId);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [removePendingApproval]);

  return null;
}
