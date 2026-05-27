import React from 'react';
import type { XiaofMood } from '../../hooks/useXiaofState';

interface XiaofCharacterProps {
  mood: XiaofMood;
  size?: number;
}

/**
 * XiaoF — pixel-art fox spirit, rendered in pure SVG.
 * All animation is driven by CSS classes referencing keyframes in xiaof.css.
 */
export function XiaofCharacter({ mood, size = 72 }: XiaofCharacterProps) {
  // Mood → color palette
  const palette = MOOD_PALETTE[mood];

  // Body animation class
  const bodyClass = `xiaof-body-${mood}`;
  const tailClass = `xiaof-tail-${mood}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <style>{`
        .xiaof-body-sleeping  { animation: xiaof-breathe 3s ease-in-out infinite; transform-origin: 50% 60%; }
        .xiaof-body-waking    { animation: xiaof-wake-spin 1.2s linear infinite; transform-origin: 50% 50%; }
        .xiaof-body-idle      { animation: xiaof-breathe 4s ease-in-out infinite; transform-origin: 50% 60%; }
        .xiaof-body-thinking  { animation: xiaof-think-bob 1s ease-in-out infinite; }
        .xiaof-body-working   { animation: xiaof-work-lean 0.4s ease-in-out infinite; transform-origin: 50% 70%; }
        .xiaof-body-waiting   { animation: xiaof-wait-jump 0.7s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite; }
        .xiaof-body-takeover  { animation: xiaof-takeover-pulse 1.2s ease-in-out infinite; }
        .xiaof-body-error     { animation: xiaof-error-shake 0.5s ease infinite; }
        .xiaof-tail-idle      { animation: xiaof-tail-sway 2s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-thinking  { animation: xiaof-tail-sway 0.8s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-working   { animation: xiaof-tail-sway 0.3s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-waiting   { animation: xiaof-tail-sway 0.5s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-sleeping  { animation: none; }
        .xiaof-tail-waking    { animation: xiaof-tail-sway 0.6s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-takeover  { animation: xiaof-tail-sway 0.5s ease-in-out infinite; transform-origin: 48px 44px; }
        .xiaof-tail-error     { animation: none; }
        .xiaof-eye            { animation: xiaof-blink 4s ease-in-out infinite; transform-origin: center; }
      `}</style>

      {/* ── Tail ─────────────────────────────── */}
      <g className={tailClass}>
        <ellipse cx="48" cy="46" rx="10" ry="7" fill={palette.tail} />
        <ellipse cx="50" cy="43" rx="5" ry="4" fill={palette.tailTip} opacity="0.9" />
        {/* Pixel accent dots on tail */}
        <rect x="46" y="44" width="2" height="2" fill={palette.accent} opacity="0.6" />
        <rect x="50" y="42" width="2" height="2" fill={palette.accent} opacity="0.5" />
      </g>

      {/* ── Body ─────────────────────────────── */}
      <g className={bodyClass}>
        {/* Main body block (pixel-art rounded rectangle) */}
        <rect x="18" y="26" width="28" height="24" rx="6" fill={palette.body} />
        {/* Body shading */}
        <rect x="18" y="26" width="28" height="8" rx="6" fill={palette.bodyTop} />
        {/* Pixel belly patch */}
        <rect x="24" y="34" width="16" height="10" rx="4" fill={palette.belly} opacity="0.7" />
        {/* Accent stripe on body */}
        <rect x="20" y="30" width="2" height="6" rx="1" fill={palette.accent} opacity="0.7" />
        <rect x="42" y="30" width="2" height="6" rx="1" fill={palette.accent} opacity="0.7" />

        {/* ── Ears ─── */}
        {mood === 'error' || mood === 'sleeping' ? (
          /* Drooping ears for error/sleeping */
          <>
            <polygon points="20,26 14,34 22,32" fill={palette.body} />
            <polygon points="20,26 14,34 21,31" fill={palette.earInner} opacity="0.8" />
            <polygon points="44,26 50,34 42,32" fill={palette.body} />
            <polygon points="44,26 50,34 43,31" fill={palette.earInner} opacity="0.8" />
          </>
        ) : (
          /* Perky ears */
          <>
            <polygon points="20,26 15,14 26,22" fill={palette.body} />
            <polygon points="20,26 16,16 25,22" fill={palette.earInner} opacity="0.8" />
            <polygon points="44,26 49,14 38,22" fill={palette.body} />
            <polygon points="44,26 48,16 39,22" fill={palette.earInner} opacity="0.8" />
          </>
        )}

        {/* ── Head ─── */}
        <rect x="20" y="14" width="24" height="20" rx="8" fill={palette.head} />
        {/* Head pixel highlight */}
        <rect x="22" y="15" width="8" height="3" rx="1" fill="rgba(255,255,255,0.12)" />

        {/* ── Eyes ─── */}
        <g className="xiaof-eye">
          <rect x="25" y="20" width="5" height="5" rx="2" fill={palette.eye} />
          {/* Eye glow */}
          <rect x="26" y="21" width="2" height="2" rx="1" fill="rgba(255,255,255,0.8)" />
        </g>
        <g className="xiaof-eye" style={{ animationDelay: '0.1s' }}>
          <rect x="34" y="20" width="5" height="5" rx="2" fill={palette.eye} />
          <rect x="35" y="21" width="2" height="2" rx="1" fill="rgba(255,255,255,0.8)" />
        </g>

        {/* ── Mood-specific overlays ─── */}
        {mood === 'thinking' && (
          <>
            {/* Spinning circles above head */}
            <circle cx="32" cy="10" r="3" fill={palette.accent} opacity="0.9" />
            <circle cx="38" cy="8" r="2" fill={palette.accent} opacity="0.6" />
            <circle cx="26" cy="8" r="2" fill={palette.accent} opacity="0.6" />
          </>
        )}

        {mood === 'waiting' && (
          <>
            {/* Exclamation marks */}
            <rect x="29" y="6" width="3" height="6" rx="1" fill="#f97316" />
            <rect x="29" y="14" width="3" height="3" rx="1" fill="#f97316" />
          </>
        )}

        {mood === 'working' && (
          <>
            {/* Speed lines */}
            <rect x="10" y="28" width="6" height="2" rx="1" fill={palette.accent} opacity="0.5" />
            <rect x="8" y="32" width="8" height="2" rx="1" fill={palette.accent} opacity="0.35" />
            <rect x="10" y="36" width="6" height="2" rx="1" fill={palette.accent} opacity="0.25" />
          </>
        )}

        {mood === 'takeover' && (
          <>
            {/* Hand raised */}
            <rect x="46" y="24" width="4" height="8" rx="2" fill={palette.body} />
            <rect x="45" y="22" width="6" height="4" rx="2" fill={palette.body} />
            <rect x="45" y="20" width="3" height="3" rx="1" fill={palette.accent} opacity="0.8" />
            <rect x="49" y="21" width="3" height="3" rx="1" fill={palette.accent} opacity="0.7" />
          </>
        )}

        {mood === 'sleeping' && (
          <>
            {/* Z Z Z */}
            <text x="40" y="16" fontSize="6" fontWeight="bold" fill={palette.accent} opacity="0.8">z</text>
            <text x="44" y="12" fontSize="8" fontWeight="bold" fill={palette.accent} opacity="0.6">z</text>
            <text x="48" y="8" fontSize="10" fontWeight="bold" fill={palette.accent} opacity="0.4">z</text>
          </>
        )}

        {mood === 'waking' && (
          <>
            {/* Sparkles */}
            <circle cx="16" cy="16" r="2" fill={palette.accent} />
            <circle cx="48" cy="14" r="1.5" fill={palette.accent} opacity="0.8" />
            <circle cx="20" cy="8" r="1.5" fill={palette.accent} opacity="0.6" />
          </>
        )}

        {mood === 'error' && (
          <>
            {/* X over eyes */}
            <line x1="25" y1="20" x2="30" y2="25" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="30" y1="20" x2="25" y2="25" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="34" y1="20" x2="39" y2="25" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="39" y1="20" x2="34" y2="25" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}

        {/* ── Nose & mouth ─── */}
        <rect x="30" y="26" width="4" height="3" rx="1.5" fill={palette.nose} />
        {mood === 'error' ? (
          <path d="M 28 31 Q 32 28 36 31" stroke={palette.nose} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        ) : mood === 'waiting' || mood === 'takeover' ? (
          <path d="M 28 30 Q 32 34 36 30" stroke={palette.nose} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 28 30 Q 32 33 36 30" stroke={palette.nose} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        )}

        {/* ── Pixel legs ─── */}
        <rect x="22" y="46" width="6" height="6" rx="2" fill={palette.body} />
        <rect x="36" y="46" width="6" height="6" rx="2" fill={palette.body} />
      </g>
    </svg>
  );
}

// ── Mood palettes ──────────────────────────────────────────────────────────────
interface MoodPalette {
  body: string;
  bodyTop: string;
  belly: string;
  head: string;
  earInner: string;
  tail: string;
  tailTip: string;
  eye: string;
  nose: string;
  accent: string;
}

const MOOD_PALETTE: Record<XiaofMood, MoodPalette> = {
  sleeping: {
    body:    '#2d3748',
    bodyTop: '#374151',
    belly:   '#4b5563',
    head:    '#2d3748',
    earInner:'#6b7280',
    tail:    '#374151',
    tailTip: '#6b7280',
    eye:     '#6b7280',
    nose:    '#9ca3af',
    accent:  '#9ca3af',
  },
  waking: {
    body:    '#3b2f7a',
    bodyTop: '#4c3a9e',
    belly:   '#6d4fd0',
    head:    '#3b2f7a',
    earInner:'#8b5cf6',
    tail:    '#4c3a9e',
    tailTip: '#a78bfa',
    eye:     '#c4b5fd',
    nose:    '#8b5cf6',
    accent:  '#a78bfa',
  },
  idle: {
    body:    '#0e3d5e',
    bodyTop: '#164e73',
    belly:   '#0ea5e9',
    head:    '#0e3d5e',
    earInner:'#38bdf8',
    tail:    '#0c4a6e',
    tailTip: '#06b6d4',
    eye:     '#7dd3fc',
    nose:    '#0284c7',
    accent:  '#06b6d4',
  },
  thinking: {
    body:    '#4a3000',
    bodyTop: '#5c3d00',
    belly:   '#d97706',
    head:    '#4a3000',
    earInner:'#f59e0b',
    tail:    '#5c3d00',
    tailTip: '#fbbf24',
    eye:     '#fde68a',
    nose:    '#b45309',
    accent:  '#f59e0b',
  },
  working: {
    body:    '#064e3b',
    bodyTop: '#065f46',
    belly:   '#10b981',
    head:    '#064e3b',
    earInner:'#34d399',
    tail:    '#065f46',
    tailTip: '#6ee7b7',
    eye:     '#a7f3d0',
    nose:    '#059669',
    accent:  '#10b981',
  },
  waiting: {
    body:    '#431407',
    bodyTop: '#7c2d12',
    belly:   '#ea580c',
    head:    '#431407',
    earInner:'#f97316',
    tail:    '#7c2d12',
    tailTip: '#fb923c',
    eye:     '#fed7aa',
    nose:    '#c2410c',
    accent:  '#f97316',
  },
  takeover: {
    body:    '#500724',
    bodyTop: '#831843',
    belly:   '#db2777',
    head:    '#500724',
    earInner:'#ec4899',
    tail:    '#831843',
    tailTip: '#f9a8d4',
    eye:     '#fbcfe8',
    nose:    '#be185d',
    accent:  '#ec4899',
  },
  error: {
    body:    '#450a0a',
    bodyTop: '#7f1d1d',
    belly:   '#dc2626',
    head:    '#450a0a',
    earInner:'#ef4444',
    tail:    '#7f1d1d',
    tailTip: '#fca5a5',
    eye:     '#fca5a5',
    nose:    '#b91c1c',
    accent:  '#ef4444',
  },
};
