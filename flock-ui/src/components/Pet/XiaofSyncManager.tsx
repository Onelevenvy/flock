import { useEffect } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { usePetStore } from '../../store/petStore';
import { useXiaofState } from '../../hooks/useXiaofState';
import { useAgentStore } from '../../store/agentStore';

/**
 * XiaofSyncManager
 * 作为一个无 DOM 渲染的背景管理器，将主窗口的状态和审批任务实时通过 Tauri Event 广播。
 * 桌面悬浮宠物窗口 (XiaofOverlayApp) 接收事件并完成状态渲染及交互。
 */
export function XiaofSyncManager() {
  const { enabled, minimized, setMinimized } = usePetStore();
  const { mood, bubbleText, pendingCount } = useXiaofState();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);

  // 1. 实时同步基本状态 (mood, pendingCount, enabled, bubbleText, minimized)
  useEffect(() => {
    emit('xiaof-state-sync', {
      mood,
      pendingCount,
      enabled,
      bubbleText,
      minimized,
    }).catch((err) => console.error('[Pet Sync] Failed to emit state sync:', err));
  }, [mood, pendingCount, enabled, bubbleText, minimized]);

  // 2. 实时同步待审批的任务信息
  useEffect(() => {
    const firstPending = pendingApprovals[0];
    if (firstPending) {
      emit('xiaof-pending-approval', {
        tool_name: firstPending.tool.name,
        call_id: firstPending.call_id,
      }).catch((err) => console.error('[Pet Sync] Failed to emit pending approval:', err));
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

  return null;
}
