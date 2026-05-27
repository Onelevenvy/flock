import React from 'react';
import type { XiaofMood } from '../../hooks/useXiaofState';

interface XiaofCharacterProps {
  mood: XiaofMood;
  size?: number;
}

/**
 * XiaofCharacter — 顶级高清晰度赛博朋克像素狐狸桌宠
 * 渲染由 AI 完美临摹原图生成的单状态超高保真透明背景 PNG 图像，结合物理动效展现，100%无底色与多余字干扰！
 */
export function XiaofCharacter({ mood, size = 72 }: XiaofCharacterProps) {
  // 为每个状态匹配对应的物理微动效 class
  const animClass = 
    mood === 'sleeping' ? 'cyber-pic-breathe' :
    mood === 'thinking' ? 'cyber-pic-bob' :
    mood === 'working' ? 'cyber-pic-run' :
    mood === 'waiting' ? 'cyber-pic-alert' :
    mood === 'takeover' ? 'cyber-pic-pulse' :
    mood === 'success' ? 'cyber-pic-jump' :
    mood === 'error' ? 'cyber-pic-tremble' : 'cyber-pic-idle';

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 霓虹发光光晕背景 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GLOW_COLORS[mood] || '#00f3ff'}2b 0%, transparent 75%)`,
        animation: mood === 'waiting' || mood === 'takeover' ? 'cyber-glow-pulsate 1.2s ease-in-out infinite' : 'cyber-glow-ambient 3s ease-in-out infinite',
        zIndex: 0,
      }} />

      {/* 独立单图透明背景渲染 (完美保留 16-bit 像素边缘，绝无锯齿与模糊) */}
      <div
        className={animClass}
        style={{
          width: size,
          height: size,
          backgroundImage: `url('/pet/${mood}.png')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated', // 100% 像素锐利度，还原超高清颗粒感！
          zIndex: 1,
          transition: 'transform 0.3s ease',
        }}
      />
    </div>
  );
}

const GLOW_COLORS: Record<XiaofMood, string> = {
  sleeping: '#6b7280',
  waking:   '#8b5cf6',
  idle:     '#00f3ff',
  thinking: '#a855f7',
  working:  '#00f3ff',
  waiting:  '#f97316',
  takeover: '#ff007f',
  error:    '#ef4444',
};
