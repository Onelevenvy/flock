import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useXiaofState } from '../../hooks/useXiaofState';
import { usePetStore } from '../../store/petStore';
import { useAgentStore } from '../../store/agentStore';
import { XiaofCharacter } from './XiaofCharacter';
import './xiaof.css';

const MOOD_STATUS_KEYS: Record<string, string> = {
  sleeping: 'pet.status.sleeping',
  waking:   'pet.status.waking',
  idle:     'pet.status.idle',
  thinking: 'pet.status.thinking',
  working:  'pet.status.working',
  waiting:  'pet.status.waiting',
  takeover: 'pet.status.takeover',
  error:    'pet.status.error',
};

const MOOD_DOT_COLOR: Record<string, string> = {
  sleeping: '#6b7280',
  waking:   '#8b5cf6',
  idle:     '#06b6d4',
  thinking: '#f59e0b',
  working:  '#10b981',
  waiting:  '#f97316',
  takeover: '#ec4899',
  error:    '#ef4444',
};

export function XiaofPet() {
  const { t } = useTranslation();
  const { enabled, minimized, position, bubbleEnabled, setMinimized, setPosition } = usePetStore();
  const { mood, bubbleText, pendingCount } = useXiaofState();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);

  // ── Hover: tracked on the outermost container so popup doesn't break it ──
  const [isHovered, setIsHovered] = useState(false);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRootMouseEnter = useCallback(() => {
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    setIsHovered(true);
  }, []);

  const handleRootMouseLeave = useCallback(() => {
    // Small delay prevents flicker when moving between widget and popup
    hoverLeaveTimerRef.current = setTimeout(() => setIsHovered(false), 350);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBubbleRef = useRef<string | null>(null);

  // Compute position style (negative = offset from right/bottom)
  const getStyle = (): React.CSSProperties => {
    if (position.x < 0 && position.y < 0) {
      return { right: Math.abs(position.x), bottom: Math.abs(position.y) };
    }
    if (position.x < 0) {
      return { right: Math.abs(position.x), top: position.y };
    }
    if (position.y < 0) {
      return { left: position.x, bottom: Math.abs(position.y) };
    }
    return { left: position.x, top: position.y };
  };

  // Show bubble when text changes
  useEffect(() => {
    if (!bubbleEnabled) return;
    if (bubbleText && bubbleText !== prevBubbleRef.current) {
      prevBubbleRef.current = bubbleText;
      setShowBubble(true);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 3500);
    } else if (!bubbleText) {
      prevBubbleRef.current = null;
      setShowBubble(false);
    }
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [bubbleText, bubbleEnabled]);

  // ── Drag logic ─────────────────────────────────────────────────────────────
  const dragStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.xiaof-approve-popup, .xiaof-close-btn, .xiaof-approve-btn')) return;
    e.preventDefault();
    const widget = (e.currentTarget as HTMLElement).querySelector('.xiaof-widget') as HTMLElement | null;
    const el = widget ? widget.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      px: el.left + el.width / 2,
      py: el.top + el.height / 2,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      const newCx = dragStartRef.current.px + dx;
      const newCy = dragStartRef.current.py + dy;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const fromRight = w - newCx;
      const fromBottom = h - newCy;
      setPosition({ x: -(fromRight - 50), y: -(fromBottom - 50) });
    };
    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, setPosition]);

  // ── Quick approve handlers ─────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    const approval = pendingApprovals[0];
    if (!approval) return;
    removePendingApproval(approval.call_id);
    await invoke('approve_tool', { callId: approval.call_id, scope: 'once' });
  }, [pendingApprovals, removePendingApproval]);

  const handleDeny = useCallback(async () => {
    const approval = pendingApprovals[0];
    if (!approval) return;
    removePendingApproval(approval.call_id);
    await invoke('deny_tool', { callId: approval.call_id, reason: 'User denied via XiaoF' });
  }, [pendingApprovals, removePendingApproval]);

  if (!enabled) return null;

  const firstPending = pendingApprovals[0];
  const showApprovePopup = isHovered && pendingCount > 0 && !isDragging;
  const showActiveBubble = showBubble && !isHovered && !isDragging && bubbleText;

  const size = minimized ? 36 : 72;

  return (
    // Outermost container: hover tracked here so popup is inside the hover zone
    <div
      className="xiaof-pet-root"
      style={getStyle()}
      onMouseEnter={handleRootMouseEnter}
      onMouseLeave={handleRootMouseLeave}
      onMouseDown={onMouseDown}
    >
      {/* Speech bubble (only when not hovering) */}
      {showActiveBubble && (
        <div className="xiaof-bubble">
          {bubbleText}
        </div>
      )}

      {/* Quick approve popup — inside root so hover stays active */}
      {showApprovePopup && firstPending && (
        <div className="xiaof-approve-popup">
          <div className="xiaof-approve-title">{t('pet.approval.title')}</div>
          <div className="xiaof-approve-tool-name" title={firstPending.tool.name}>
            🔧 {firstPending.tool.name}
          </div>
          {pendingCount > 1 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: -2 }}>
              {t('pet.approval.more', { count: pendingCount - 1 })}
            </div>
          )}
          <div className="xiaof-approve-btns">
            <button
              className="xiaof-approve-btn approve"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleApprove}
            >
              ✓ {t('pet.approval.approve')}
            </button>
            <button
              className="xiaof-approve-btn deny"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleDeny}
            >
              ✕ {t('pet.approval.deny')}
            </button>
          </div>
        </div>
      )}

      {/* Main widget */}
      <div
        className={`xiaof-widget mood-${mood} ${minimized ? 'minimized' : ''}`}
        onDoubleClick={() => setMinimized(!minimized)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Pending badge */}
        {pendingCount > 0 && (
          <div className="xiaof-badge">{pendingCount > 9 ? '9+' : pendingCount}</div>
        )}

        {/* Minimize button */}
        <button
          className="xiaof-close-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
          title={minimized ? t('pet.expand') : t('pet.minimize')}
        >
          {minimized ? '▲' : '▽'}
        </button>

        {/* Character */}
        <XiaofCharacter mood={mood} size={size} />

        {/* Status label */}
        {!minimized && (
          <div className="xiaof-status-label">
            <span
              className="xiaof-status-dot"
              style={{ background: MOOD_DOT_COLOR[mood] }}
            />
            {t(MOOD_STATUS_KEYS[mood] ?? 'pet.status.idle')}
          </div>
        )}
      </div>
    </div>
  );
}
