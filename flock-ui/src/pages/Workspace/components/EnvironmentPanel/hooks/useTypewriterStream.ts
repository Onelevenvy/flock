import { useEffect, useRef, useState } from 'react';

export function useTypewriterStream(liveContent: string) {
  const [displayedContent, setDisplayedContent] = useState('');
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastProcessedContentRef = useRef('');

  useEffect(() => {
    if (liveContent === lastProcessedContentRef.current) return;
    const prevContent = lastProcessedContentRef.current;
    lastProcessedContentRef.current = liveContent;

    if (!liveContent) {
      setDisplayedContent('');
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Handle executing/waiting status strings (both Chinese legacy and new English)
    if (
      liveContent === '正在执行沙盒命令...' ||
      liveContent.startsWith('正在执行') ||
      liveContent.startsWith('等待命令') ||
      liveContent === 'Executing sandbox command...' ||
      liveContent.startsWith('Executing sandbox command:')
    ) {
      setDisplayedContent(liveContent);
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Typewriter: only stream the incremental portion
    if (prevContent && liveContent.startsWith(prevContent)) {
      const extra = liveContent.substring(prevContent.length);
      if (extra) {
        queueRef.current.push(...extra.split('\n'));
      }
    } else {
      setDisplayedContent('');
      queueRef.current = liveContent.split('\n');
    }

    if (!timerRef.current) {
      const processQueue = () => {
        if (queueRef.current.length > 0) {
          const batchSize = Math.min(3, queueRef.current.length);
          const batch = queueRef.current.splice(0, batchSize);
          setDisplayedContent((prev) => {
            const separator = prev ? (prev.endsWith('\n') ? '' : '\n') : '';
            return prev + separator + batch.join('\n');
          });
          timerRef.current = requestAnimationFrame(processQueue);
        } else {
          timerRef.current = null;
        }
      };
      timerRef.current = requestAnimationFrame(processQueue);
    }

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [liveContent]);

  return displayedContent;
}
