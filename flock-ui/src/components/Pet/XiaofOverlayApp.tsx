/**
 * XiaofOverlayApp
 * Runs inside the dedicated transparent pet-overlay Tauri window.
 * Communicates with the main window via Tauri events to stay in sync.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { XiaofCharacter } from './XiaofCharacter';
import type { XiaofMood } from '../../hooks/useXiaofState';
import './xiaof.css';
import '../../index.css';

interface PetSyncState {
  mood: XiaofMood;
  pendingCount: number;
  enabled: boolean;
  bubbleText: string | null;
  minimized: boolean;
}

const MOOD_DOT_COLOR: Record<string, string> = {
  sleeping: '#6b7280',
  waking:   '#8b5cf6',
  idle:     '#00f0ff',
  thinking: '#a855f7',
  working:  '#00f0ff',
  waiting:  '#f97316',
  takeover: '#ff007f',
  error:    '#ef4444',
};

const MOOD_STATUS: Record<string, string> = {
  sleeping: '休眠中', waking: '苏醒中...', idle: '待命',
  thinking: '思考中...', working: '执行中...', waiting: '需要确认！',
  takeover: '需要操作！', error: '出错了',
};

export function XiaofOverlayApp() {
  const [state, setState] = useState<PetSyncState>({
    mood: 'idle',
    pendingCount: 0,
    enabled: true,
    bubbleText: null,
    minimized: false,
  });
  const [showBubble, setShowBubble] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBubble = useRef<string | null>(null);
  const winRef = useRef(getCurrentWindow());

  // Listen to state sync events from main window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<PetSyncState>('xiaof-state-sync', (evt) => {
      setState(evt.payload);
      if (evt.payload.pendingCount === 0) {
        setPendingTool(null);
        setPendingCallId(null);
        setShowPopup(false);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Listen to pending approval events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ tool_name: string; call_id: string }>('xiaof-pending-approval', (evt) => {
      setPendingTool(evt.payload.tool_name);
      setPendingCallId(evt.payload.call_id);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Pull initial state from main window/backend on mount
  useEffect(() => {
    invoke('pull_pet_state').catch((err) => console.error('[Pet Sync] Failed to pull initial state:', err));
  }, []);

  // Bubble display logic
  useEffect(() => {
    const text = state.bubbleText;
    if (text && text !== prevBubble.current) {
      prevBubble.current = text;
      setShowBubble(true);
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => setShowBubble(false), 3500);
    } else if (!text) {
      prevBubble.current = null;
      setShowBubble(false);
    }
  }, [state.bubbleText]);

  // Click outside to close popup
  useEffect(() => {
    if (!showPopup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.xiaof-widget') && !target.closest('.xiaof-approve-popup')) {
        setShowPopup(false);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [showPopup]);

  // ── Absolute screen coordinate dragging algorithm ──
  const dragStart = useRef<{ mx: number; my: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.xiaof-approve-btn, .xiaof-close-btn, .xiaof-approve-popup')) return;
    
    // Lock drag starting point to absolute screen-relative coordinates
    dragStart.current = { mx: e.screenX, my: e.screenY };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const win = winRef.current;
    
    const onMove = async (e: MouseEvent) => {
      if (!dragStart.current) return;
      
      // Calculate delta physically using screen-absolute distance
      const dx = e.screenX - dragStart.current.mx;
      const dy = e.screenY - dragStart.current.my;
      
      if (dx !== 0 || dy !== 0) {
        const pos = await win.outerPosition();
        await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy));
        
        // Lock drag reference coordinates instantly to the newest screen state
        dragStart.current = { mx: e.screenX, my: e.screenY };
      }
    };
    
    const onUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleApprove = useCallback(async () => {
    if (!pendingCallId) return;
    await invoke('approve_tool', { callId: pendingCallId, scope: 'once' });
    setPendingTool(null);
    setPendingCallId(null);
    setShowPopup(false);
  }, [pendingCallId]);

  const handleDeny = useCallback(async () => {
    if (!pendingCallId) return;
    await invoke('deny_tool', { callId: pendingCallId, reason: 'Denied via XiaoF overlay' });
    setPendingTool(null);
    setPendingCallId(null);
    setShowPopup(false);
  }, [pendingCallId]);

  const toggleMinimized = useCallback(() => {
    const nextMin = !state.minimized;
    setState(prev => ({ ...prev, minimized: nextMin }));
    invoke('sync_pet_minimized', { minimized: nextMin }).catch(console.error);
  }, [state.minimized]);

  const handlePetClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    if (e.detail === 2) return;
    if ((e.target as HTMLElement).closest('.xiaof-close-btn')) return;
    
    if (state.pendingCount > 0 && pendingTool) {
      setShowPopup(prev => !prev);
    }
  }, [state.pendingCount, pendingTool, isDragging]);

  const hasPending = state.pendingCount > 0 && pendingTool;
  const size = state.minimized ? 46 : 96;

  // Compute effective mood dynamically to override when sync-lag happens
  const effectiveMood = (() => {
    if (state.mood === 'takeover') return 'takeover';
    if (hasPending) return 'waiting';
    return state.mood;
  })();

  if (!state.enabled) return null;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 8,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative', // Establish positioning context
      }}
      onMouseDown={onMouseDown}
    >
      {/* Bubble (only when not minimized) */}
      {!state.minimized && showBubble && state.bubbleText && (
        <div className="xiaof-bubble" style={{ marginBottom: 110 }}>
          {state.bubbleText}
        </div>
      )}

      {/* Approval popup */}
      {!state.minimized && hasPending && showPopup && (
        <div
          className="xiaof-approve-popup"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="xiaof-approve-title">待审批操作</div>
          <div className="xiaof-approve-tool-name" title={pendingTool}>🔧 {pendingTool}</div>
          <div className="xiaof-approve-btns">
            <button
              className="xiaof-approve-btn approve"
              onClick={(e) => {
                e.stopPropagation();
                handleApprove();
              }}
            >
              ✓ 批准
            </button>
            <button
              className="xiaof-approve-btn deny"
              onClick={(e) => {
                e.stopPropagation();
                handleDeny();
              }}
            >
              ✕ 拒绝
            </button>
          </div>
        </div>
      )}

      {/* Main widget */}
      <div
        className={`xiaof-widget mood-${effectiveMood} ${state.minimized ? 'minimized' : ''}`}
        onClick={handlePetClick}
        onDoubleClick={toggleMinimized}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {state.pendingCount > 0 && (
          <div className="xiaof-badge">{state.pendingCount > 9 ? '9+' : state.pendingCount}</div>
        )}

        {/* Minimize / Expand Toggle Button */}
        <button
          className="xiaof-close-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleMinimized(); }}
          title={state.minimized ? "展开" : "折叠"}
        >
          {state.minimized ? '▲' : '▽'}
        </button>

        {/* Dynamic Glowing Cyber Fox Character */}
        <XiaofCharacter mood={effectiveMood} size={size} />

        {/* Status label (only when expanded) */}
        {!state.minimized && (
          <div className="xiaof-status-label">
            <span className="xiaof-status-dot" style={{ background: MOOD_DOT_COLOR[effectiveMood] || '#06b6d4' }} />
            {MOOD_STATUS[effectiveMood] ?? '待命'}
          </div>
        )}
      </div>
    </div>
  );
}
