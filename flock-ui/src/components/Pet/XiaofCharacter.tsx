import React from 'react';
import type { XiaofMood } from '../../hooks/useXiaofState';

interface XiaofCharacterProps {
  mood: XiaofMood;
  size?: number;
}

/**
 * XiaofCharacter — 透明桌宠角色渲染组件
 * 直接加载 /pet/{mood}.png 目录下的透明图片。
 * 无任何裁剪或背景圆圈，保证图片完整显示。
 */
export function XiaofCharacter({ mood, size = 72 }: XiaofCharacterProps) {
  const imageUrl = `/pet/${mood}.png`;

  // 根据 mood 选择合适的 CSS 动画类名
  const animClassMap: Record<XiaofMood, string> = {
    idle: 'cyber-pic-idle',
    sleeping: 'cyber-pic-breathe',
    thinking: 'cyber-pic-bob',
    working: 'cyber-pic-run',
    waiting: 'cyber-pic-alert',
    takeover: 'cyber-pic-pulse',
    waking: 'cyber-pic-breathe', // 刚苏醒时用舒缓的动画
    error: 'cyber-pic-tremble',
  };

  const animClass = animClassMap[mood] || 'cyber-pic-idle';

  return (
    <div 
      className="xiaof-character-container"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible', // 确保绝对不会裁剪图片
        // 使图片区域响应拖拽
        WebkitAppRegion: 'drag',
      } as any}
    >
      {/* 宠物本体图像 */}
      <img 
        src={imageUrl} 
        alt={`Pet state: ${mood}`}
        className={animClass}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain', // 保证图片完整包含在容器内，不被拉伸变形
          userSelect: 'none',
          pointerEvents: 'none', // 让拖拽事件穿透给外层
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))', // 稍微加一点投影让它在桌面上更立体
        }}
        onError={(e) => {
          // 如果加载失败，回退到 idle 图片
          if (e.currentTarget.src !== window.location.origin + '/pet/idle.png') {
            e.currentTarget.src = '/pet/idle.png';
          }
        }}
      />
    </div>
  );
}
