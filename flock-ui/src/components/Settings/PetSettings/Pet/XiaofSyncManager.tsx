import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '@/store/petStore';
import { useXiaofState } from '@/hooks/useXiaofState';
import { useAgentStore } from '@/store/agentStore';

/**
 * XiaofDisabledSyncer
 * 仅在桌宠关闭或不是桌面模式时，单次发送已关闭状态给 Rust 以关闭/隐藏悬浮窗口。
 */
function XiaofDisabledSyncer() {
  useEffect(() => {
    invoke('sync_pet_state', {
      state: {
        enabled: false,
        mood: 'sleeping',
        pendingCount: 0,
        bubbleText: null,
        minimized: false,
        pendingTool: null,
        pendingCallId: null,
      }
    }).catch((err) => console.error('[Pet Sync] Failed to sync disabled state:', err));
  }, []);

  return null;
}

/**
 * XiaofActiveSyncManager
 * 处于活跃状态下的同步逻辑，调用各类 Hook 监听状态变更并与后台进行通信。
 */
function XiaofActiveSyncManager() {
  const { enabled, minimized, mode, setMinimized } = usePetStore();
  const { mood, bubbleText, pendingCount } = useXiaofState();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);

  // 1. 实时同步基本状态 (mood, pendingCount, enabled, bubbleText, minimized, pendingTool, pendingCallId)
  const lastStateRef = useRef<string>('');
  useEffect(() => {
    const firstPending = pendingApprovals[0];
    const stateObj = {
      mood,
      pendingCount,
      enabled: enabled && mode === 'desktop',
      bubbleText,
      minimized,
      pendingTool: firstPending ? firstPending.tool.name : null,
      pendingCallId: firstPending ? firstPending.call_id : null,
    };
    const stateStr = JSON.stringify(stateObj);
    if (stateStr === lastStateRef.current) return;
    lastStateRef.current = stateStr;

    invoke('sync_pet_state', { state: stateObj })
      .catch((err) => console.error('[Pet Sync] Failed to sync pet state:', err));
  }, [mood, pendingCount, enabled, mode, bubbleText, minimized, pendingApprovals]);

  // 2. 实时同步待审批的任务信息
  const lastApprovalRef = useRef<string>('');
  useEffect(() => {
    const firstPending = pendingApprovals[0];
    const approvalObj = firstPending
      ? { tool_name: firstPending.tool.name, call_id: firstPending.call_id }
      : null;
    const approvalStr = JSON.stringify(approvalObj);
    if (approvalStr === lastApprovalRef.current) return;
    lastApprovalRef.current = approvalStr;

    invoke('sync_pet_pending_approval', { approval: approvalObj })
      .catch((err) => console.error('[Pet Sync] Failed to sync pending approval:', err));
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
          enabled: enabled && mode === 'desktop',
          bubbleText,
          minimized,
          pendingTool: firstPending ? firstPending.tool.name : null,
          pendingCallId: firstPending ? firstPending.call_id : null,
        }
      }).catch((err) => console.error('[Pet Sync] Failed to sync pet state on pull request:', err));
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [mood, pendingCount, enabled, mode, bubbleText, minimized, pendingApprovals]);

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

/**
 * XiaofSyncManager
 * 作为一个无 DOM 渲染的背景管理器，根据是否启用有条件地加载活跃的管理器或静默关闭器。
 */
export function XiaofSyncManager() {
  const { enabled, mode } = usePetStore();
  const isSyncActive = enabled && mode === 'desktop';

  if (!isSyncActive) {
    return <XiaofDisabledSyncer />;
  }

  return <XiaofActiveSyncManager />;
}

