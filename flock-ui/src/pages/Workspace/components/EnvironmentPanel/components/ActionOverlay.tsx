import { Box } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ScreenshotInfo } from '../utils/vncUtils';

export function ActionOverlay({ info }: { info: ScreenshotInfo }) {
  const { t } = useTranslation();

  if (info.x === undefined || info.y === undefined || info.x < 0 || info.y < 0)
    return null;

  const xPercent = Math.min(Math.max((info.x / 1024) * 100, 0), 100);
  const yPercent = Math.min(Math.max((info.y / 768) * 100, 0), 100);

  const isClick = [
    'click',
    'move',
    'drag',
    'double_click',
    'right_click',
  ].includes(info.action?.toLowerCase() || '');
  const isType = ['type', 'fill'].includes(info.action?.toLowerCase() || '');

  return (
    <Box
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {isClick && (
        <>
          <Box
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255, 59, 48, 0.35)',
              border: '2px solid #ff3b30',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'ripple 1.5s infinite ease-out',
            }}
          />
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ff3b30',
              boxShadow: '0 0 8px rgba(255, 59, 48, 0.8)',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </>
      )}

      {isType && (
        <>
          <Box
            style={{
              width: 20,
              height: 20,
              border: '2px dashed #34c759',
              borderRadius: 4,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'typePulse 2.0s infinite ease-in-out',
            }}
          />
          <Box
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(52, 199, 89, 0.4)',
              color: '#34c759',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              position: 'absolute',
              top: 22,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {t('chat.vnc.inputLabel', { text: info.text, defaultValue: `Input: "${info.text}"` })}
          </Box>
        </>
      )}

      <Box
        style={{
          background: 'rgba(26, 27, 30, 0.9)',
          border: '1px solid var(--flock-border-dim)',
          color: '#eef2f6',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: '10px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {info.action ? `${info.action.toUpperCase()}` : 'ACTION'} ({info.x}, {info.y})
      </Box>

      <style>{`
        @keyframes ripple {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes typePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }
      `}</style>
    </Box>
  );
}
