import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAgentStore } from '../store/agentStore';
import { ProtocolEvent } from '../types/protocol';

/**
 * 监听 Tauri 事件流，将 Agent 发来的 JSON 事件解析后分发到 store
 * 修复：每次 listen 返回的 unlisten 函数正确保存，避免 Promise 竞争问题
 */
export function useEventStream() {
  const handleEvent = useAgentStore((s) => s.handleEvent);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setError = useAgentStore((s) => s.setError);

  // 用 ref 存 unlisten 函数，避免闭包捕获过期值
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function setupListeners() {
      try {
        const agentUnlisten = await listen<string>('agent-event', (event) => {
          if (cancelled) return;
          try {
            const parsed: ProtocolEvent = JSON.parse(event.payload);
            handleEvent(parsed);
          } catch (e) {
            console.error('[agent-event] JSON parse error:', e, event.payload);
          }
        });

        const stoppedUnlisten = await listen('agent-stopped', () => {
          if (cancelled) return;
          setStatus('disconnected');
        });

        const stderrUnlisten = await listen<string>('agent-stderr', (event) => {
          if (cancelled) return;
          const line = event.payload;
          console.debug('[flock stderr]', line);
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            setError(`Agent stderr: ${line}`);
          }
        });

        if (!cancelled) {
          unlistenRefs.current = [agentUnlisten, stoppedUnlisten, stderrUnlisten];
        } else {
          // 如果组件已经卸载，立刻清理
          agentUnlisten();
          stoppedUnlisten();
          stderrUnlisten();
        }
      } catch (e) {
        // 在非 Tauri 环境（如浏览器 dev）下忽略
        console.warn('[useEventStream] Failed to set up Tauri listeners:', e);
      }
    }

    setupListeners();

    return () => {
      cancelled = true;
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];
    };
  }, []); // 空依赖：只挂载一次，handleEvent/setStatus/setError 通过 zustand 的 getState 访问
}
