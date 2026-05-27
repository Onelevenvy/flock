import React from 'react';
import type { XiaofMood } from '../../hooks/useXiaofState';

interface XiaofCharacterProps {
  mood: XiaofMood;
  size?: number;
}

/**
 * XiaoF — 赛博像素狐狸精，参考配色：暗海军蓝 + 青色/紫色发光纹路
 * 全 SVG 实现，CSS 动画驱动
 */
export function XiaofCharacter({ mood, size = 72 }: XiaofCharacterProps) {
  const p = PALETTE[mood];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`tail-grad-${mood}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.tailBase} />
          <stop offset="100%" stopColor={p.tailTip} />
        </linearGradient>
        <linearGradient id={`body-grad-${mood}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.bodyTop} />
          <stop offset="100%" stopColor={p.bodyBot} />
        </linearGradient>
      </defs>

      <style>{`
        /* Body animations per mood */
        .xf-body-sleeping  { animation: xiaof-breathe 3.5s ease-in-out infinite; transform-origin: 40px 50px; }
        .xf-body-waking    { animation: xiaof-think-bob 0.6s ease-in-out infinite; }
        .xf-body-idle      { animation: xiaof-breathe 5s ease-in-out infinite; transform-origin: 40px 50px; }
        .xf-body-thinking  { animation: xiaof-think-bob 1s ease-in-out infinite; }
        .xf-body-working   { animation: xiaof-work-lean 0.35s ease-in-out infinite; transform-origin: 40px 60px; }
        .xf-body-waiting   { animation: xiaof-wait-jump 0.65s cubic-bezier(0.36,0.07,0.19,0.97) infinite; }
        .xf-body-takeover  { animation: xiaof-takeover-pulse 1.1s ease-in-out infinite; }
        .xf-body-error     { animation: xiaof-error-shake 0.45s ease infinite; }

        /* Tail animations */
        .xf-tail-idle      { animation: xiaof-tail-sway 2.2s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-thinking  { animation: xiaof-tail-sway 0.9s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-working   { animation: xiaof-tail-sway 0.28s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-waiting   { animation: xiaof-tail-sway 0.5s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-sleeping  { animation: none; }
        .xf-tail-waking    { animation: xiaof-tail-sway 0.7s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-takeover  { animation: xiaof-tail-sway 0.5s ease-in-out infinite; transform-origin: 54px 48px; }
        .xf-tail-error     { animation: xiaof-error-shake 0.45s ease infinite; transform-origin: 54px 48px; }

        /* Eye blink */
        .xf-eye { animation: xiaof-blink 4.5s ease-in-out infinite; transform-origin: center; }
        .xf-eye2 { animation: xiaof-blink 4.5s ease-in-out infinite 0.15s; transform-origin: center; }

        /* Glow pulse on markings */
        .xf-marking { animation: xiaof-marking-pulse 2s ease-in-out infinite; }
        @keyframes xiaof-marking-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; filter: brightness(1.4); }
        }
      `}</style>

      {/* ── TAIL ──────────────────────────────────────────────── */}
      <g className={`xf-tail-${mood}`}>
        {/* Tail base shape: large fluffy sweep curving to the right */}
        <ellipse cx="58" cy="50" rx="14" ry="10" fill={`url(#tail-grad-${mood})`} />
        <ellipse cx="62" cy="45" rx="9" ry="7" fill={p.tailTip} opacity="0.9" />
        <ellipse cx="65" cy="41" rx="5" ry="4" fill={p.tailTip} />
        {/* Tail tip glow stripe */}
        <ellipse cx="66" cy="40" rx="3" ry="2.5" fill={p.accent} opacity="0.8" filter="url(#glow-cyan)" />
        {/* Tail markings */}
        <path d="M 54 52 Q 58 46 63 42" stroke={p.marking} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        <path d="M 56 55 Q 61 49 65 44" stroke={p.marking} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* ── BODY GROUP ─────────────────────────────────────────── */}
      <g className={`xf-body-${mood}`}>

        {/* Body main — fox sitting upright */}
        {/* Hindquarters / haunches */}
        <ellipse cx="38" cy="60" rx="16" ry="12" fill={`url(#body-grad-${mood})`} />
        {/* Lower legs */}
        <rect x="24" y="65" width="8" height="10" rx="4" fill={p.bodyBot} />
        <rect x="46" y="65" width="8" height="10" rx="4" fill={p.bodyBot} />
        {/* Paw accent */}
        <ellipse cx="28" cy="74" rx="4" ry="2" fill={p.accent} opacity="0.5" />
        <ellipse cx="50" cy="74" rx="4" ry="2" fill={p.accent} opacity="0.5" />

        {/* Chest / belly — lighter oval */}
        <ellipse cx="38" cy="52" rx="10" ry="13" fill={p.chest} />

        {/* Upper body */}
        <rect x="26" y="38" width="24" height="22" rx="8" fill={`url(#body-grad-${mood})`} />

        {/* Body circuit markings */}
        <g className="xf-marking" filter="url(#glow-cyan)">
          {/* Left shoulder rune */}
          <path d="M 29 44 L 31 44 L 31 47 L 33 47" stroke={p.marking} strokeWidth="1.2" strokeLinecap="square" fill="none" opacity="0.8" />
          {/* Right shoulder rune */}
          <path d="M 47 44 L 45 44 L 45 47 L 43 47" stroke={p.marking} strokeWidth="1.2" strokeLinecap="square" fill="none" opacity="0.8" />
          {/* Center diamond */}
          <polygon points="38,47 41,50 38,53 35,50" stroke={p.marking} strokeWidth="1" fill="none" opacity="0.9" />
        </g>

        {/* ── EARS ── */}
        {mood === 'error' || mood === 'sleeping' ? (
          /* Drooping / flat ears */
          <>
            <polygon points="28,38 20,44 30,42" fill={p.bodyTop} />
            <polygon points="28,38 21,43 29,41" fill={p.earInner} opacity="0.8" />
            <polygon points="48,38 56,44 46,42" fill={p.bodyTop} />
            <polygon points="48,38 55,43 47,41" fill={p.earInner} opacity="0.8" />
          </>
        ) : (
          /* Tall pointed fox ears */
          <>
            {/* Left ear */}
            <polygon points="29,38 22,18 36,30" fill={p.bodyTop} />
            <polygon points="29,38 23,20 35,30" fill={p.earInner} opacity="0.85" />
            {/* Left ear tip glow */}
            <circle cx="23" cy="20" r="2" fill={p.accent} opacity="0.6" filter="url(#glow-cyan)" />
            {/* Right ear */}
            <polygon points="47,38 54,18 40,30" fill={p.bodyTop} />
            <polygon points="47,38 53,20 41,30" fill={p.earInner} opacity="0.85" />
            {/* Right ear tip glow */}
            <circle cx="53" cy="20" r="2" fill={p.accent} opacity="0.6" filter="url(#glow-cyan)" />
          </>
        )}

        {/* ── HEAD ── */}
        <ellipse cx="38" cy="30" rx="14" ry="13" fill={`url(#body-grad-${mood})`} />

        {/* Head highlight */}
        <ellipse cx="34" cy="23" rx="4" ry="2" fill="rgba(255,255,255,0.08)" />

        {/* Head circuit mark — forehead */}
        <g className="xf-marking" filter="url(#glow-cyan)">
          {/* Forehead rune: spiral-like */}
          <path d="M 35 25 Q 38 22 41 25 Q 38 28 35 25" stroke={p.marking} strokeWidth="1" fill="none" opacity="0.8" />
          {/* Side dots */}
          <circle cx="30" cy="29" r="1" fill={p.marking} opacity="0.7" />
          <circle cx="46" cy="29" r="1" fill={p.marking} opacity="0.7" />
        </g>

        {/* ── EYES ── */}
        {mood === 'error' ? (
          /* X eyes for error */
          <>
            <line x1="30" y1="28" x2="35" y2="33" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
            <line x1="35" y1="28" x2="30" y2="33" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
            <line x1="41" y1="28" x2="46" y2="33" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
            <line x1="46" y1="28" x2="41" y2="33" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
          </>
        ) : mood === 'sleeping' ? (
          /* Closed arc eyes */
          <>
            <path d="M 30 31 Q 32.5 28 35 31" stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 41 31 Q 43.5 28 46 31" stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          /* Normal glowing cat-slit eyes */
          <>
            <g className="xf-eye" filter="url(#glow-strong)">
              {/* Eye outer glow */}
              <ellipse cx="32.5" cy="30.5" rx="4" ry="3.5" fill={p.eyeGlow} opacity="0.3" />
              {/* Eye bg */}
              <ellipse cx="32.5" cy="30.5" rx="3" ry="3" fill={p.eyeBg} />
              {/* Vertical slit pupil */}
              <ellipse cx="32.5" cy="30.5" rx="1" ry="2.5" fill={p.pupil} />
              {/* Eye shine */}
              <circle cx="31.5" cy="29" r="0.8" fill="rgba(255,255,255,0.9)" />
            </g>
            <g className="xf-eye2" filter="url(#glow-strong)">
              <ellipse cx="43.5" cy="30.5" rx="4" ry="3.5" fill={p.eyeGlow} opacity="0.3" />
              <ellipse cx="43.5" cy="30.5" rx="3" ry="3" fill={p.eyeBg} />
              <ellipse cx="43.5" cy="30.5" rx="1" ry="2.5" fill={p.pupil} />
              <circle cx="42.5" cy="29" r="0.8" fill="rgba(255,255,255,0.9)" />
            </g>
          </>
        )}

        {/* ── NOSE & MUZZLE ── */}
        <ellipse cx="38" cy="36" rx="4" ry="2.5" fill={p.muzzle} opacity="0.5" />
        <ellipse cx="38" cy="35.5" rx="1.5" ry="1" fill={p.accent} opacity="0.8" />
        {/* Mouth */}
        {mood === 'error' ? (
          <path d="M 35 38 Q 38 36 41 38" stroke={p.accent} strokeWidth="1" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 35 38 Q 38 40 41 38" stroke={p.accent} strokeWidth="1" fill="none" strokeLinecap="round" />
        )}

        {/* ── MOOD OVERLAYS ── */}
        {mood === 'thinking' && (
          <g filter="url(#glow-strong)">
            <text x="44" y="18" fontSize="8" fontWeight="bold" fill={p.accent} opacity="0.9">?</text>
            <circle cx="38" cy="12" r="2.5" fill={p.accent} opacity="0.7" />
            <circle cx="44" cy="9" r="1.5" fill={p.accent} opacity="0.5" />
          </g>
        )}

        {mood === 'waiting' && (
          <g filter="url(#glow-strong)">
            {/* Exclamation */}
            <rect x="36" y="8" width="3" height="7" rx="1.5" fill="#f97316" />
            <circle cx="37.5" cy="17" r="1.5" fill="#f97316" />
          </g>
        )}

        {mood === 'working' && (
          <g opacity="0.7" filter="url(#glow-cyan)">
            {/* Speed lines left */}
            <rect x="6" y="34" width="10" height="2" rx="1" fill={p.marking} />
            <rect x="4" y="39" width="14" height="2" rx="1" fill={p.marking} opacity="0.6" />
            <rect x="6" y="44" width="10" height="2" rx="1" fill={p.marking} opacity="0.4" />
            {/* Tool icons (wrench shape) */}
            <path d="M 60 30 L 66 24 M 63 27 L 65 25" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 62 34 L 68 28" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )}

        {mood === 'takeover' && (
          /* Raised arm / paw */
          <g>
            <rect x="50" y="35" width="6" height="10" rx="3" fill={p.bodyTop} />
            <ellipse cx="53" cy="34" rx="3.5" ry="3" fill={p.bodyTop} />
            <circle cx="52" cy="32" r="1.2" fill={p.accent} filter="url(#glow-cyan)" />
            <circle cx="55" cy="33" r="1" fill={p.accent} filter="url(#glow-cyan)" opacity="0.8" />
          </g>
        )}

        {mood === 'waking' && (
          <g filter="url(#glow-strong)">
            <circle cx="18" cy="20" r="2.5" fill={p.accent} opacity="0.8" />
            <circle cx="58" cy="18" r="1.8" fill={p.accent} opacity="0.6" />
            <circle cx="22" cy="12" r="1.5" fill={p.marking} opacity="0.7" />
            <path d="M 55 12 L 57 10 L 59 12 L 57 14 Z" fill={p.marking} opacity="0.7" />
          </g>
        )}

        {mood === 'sleeping' && (
          <g filter="url(#glow-cyan)">
            <text x="50" y="26" fontSize="7" fontWeight="bold" fill={p.accent} opacity="0.7">z</text>
            <text x="54" y="20" fontSize="9" fontWeight="bold" fill={p.accent} opacity="0.5">z</text>
            <text x="58" y="14" fontSize="11" fontWeight="bold" fill={p.accent} opacity="0.35">z</text>
          </g>
        )}

        {/* Stars for success/takeover */}
        {(mood === 'takeover') && (
          <g filter="url(#glow-strong)">
            <path d="M 14 40 L 15.5 37 L 17 40 L 14 38 L 17 38 Z" fill={p.accent} />
            <path d="M 10 32 L 11 30 L 12 32 L 10 31 L 12 31 Z" fill={p.marking} opacity="0.8" />
          </g>
        )}

      </g>
    </svg>
  );
}

// ── Palette definitions ────────────────────────────────────────────────────────
interface FoxPalette {
  bodyTop:  string;
  bodyBot:  string;
  chest:    string;
  earInner: string;
  muzzle:   string;
  tailBase: string;
  tailTip:  string;
  eyeBg:    string;
  eyeGlow:  string;
  pupil:    string;
  accent:   string;   // main glow / circuit color
  marking:  string;   // secondary circuit marks
}

const PALETTE: Record<XiaofMood, FoxPalette> = {
  // All moods use the dark navy + cyan base, only accent/glow changes
  sleeping: {
    bodyTop:  '#1a2744',
    bodyBot:  '#0d1b2a',
    chest:    '#1e2e48',
    earInner: '#2a4060',
    muzzle:   '#1e2e48',
    tailBase: '#152035',
    tailTip:  '#2a4060',
    eyeBg:    '#1e2e48',
    eyeGlow:  '#4b6080',
    pupil:    '#6b8aaa',
    accent:   '#4b7aa8',
    marking:  '#3d6080',
  },
  waking: {
    bodyTop:  '#1a1e4a',
    bodyBot:  '#0f1235',
    chest:    '#1e2260',
    earInner: '#2e3580',
    muzzle:   '#1e2260',
    tailBase: '#1a1e55',
    tailTip:  '#4040c0',
    eyeBg:    '#1e2260',
    eyeGlow:  '#7c6fe0',
    pupil:    '#a78bfa',
    accent:   '#8b5cf6',
    marking:  '#6d4fcc',
  },
  idle: {
    bodyTop:  '#0d2040',
    bodyBot:  '#061528',
    chest:    '#0f2a50',
    earInner: '#1a3d6e',
    muzzle:   '#0f2a50',
    tailBase: '#0a2040',
    tailTip:  '#06b6d4',
    eyeBg:    '#0a2040',
    eyeGlow:  '#06b6d4',
    pupil:    '#22d3ee',
    accent:   '#06b6d4',
    marking:  '#0891b2',
  },
  thinking: {
    bodyTop:  '#1a1500',
    bodyBot:  '#100d00',
    chest:    '#241d00',
    earInner: '#3d3200',
    muzzle:   '#241d00',
    tailBase: '#1a1800',
    tailTip:  '#d97706',
    eyeBg:    '#1a1500',
    eyeGlow:  '#f59e0b',
    pupil:    '#fbbf24',
    accent:   '#f59e0b',
    marking:  '#d97706',
  },
  working: {
    bodyTop:  '#002820',
    bodyBot:  '#001810',
    chest:    '#003828',
    earInner: '#005c40',
    muzzle:   '#003828',
    tailBase: '#002820',
    tailTip:  '#10b981',
    eyeBg:    '#002820',
    eyeGlow:  '#10b981',
    pupil:    '#34d399',
    accent:   '#10b981',
    marking:  '#059669',
  },
  waiting: {
    bodyTop:  '#1c0f00',
    bodyBot:  '#100800',
    chest:    '#2a1500',
    earInner: '#4a2200',
    muzzle:   '#2a1500',
    tailBase: '#1c1000',
    tailTip:  '#f97316',
    eyeBg:    '#1c0f00',
    eyeGlow:  '#f97316',
    pupil:    '#fb923c',
    accent:   '#f97316',
    marking:  '#ea580c',
  },
  takeover: {
    bodyTop:  '#1e0030',
    bodyBot:  '#120020',
    chest:    '#2a0045',
    earInner: '#480070',
    muzzle:   '#2a0045',
    tailBase: '#1e0030',
    tailTip:  '#ec4899',
    eyeBg:    '#1e0030',
    eyeGlow:  '#ec4899',
    pupil:    '#f472b6',
    accent:   '#ec4899',
    marking:  '#db2777',
  },
  error: {
    bodyTop:  '#1e0000',
    bodyBot:  '#120000',
    chest:    '#2a0000',
    earInner: '#480000',
    muzzle:   '#2a0000',
    tailBase: '#1e0000',
    tailTip:  '#ef4444',
    eyeBg:    '#1e0000',
    eyeGlow:  '#ef4444',
    pupil:    '#f87171',
    accent:   '#ef4444',
    marking:  '#dc2626',
  },
};
