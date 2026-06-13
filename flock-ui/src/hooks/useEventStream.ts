import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAgentStore } from '@/store/agentStore';
import { ProtocolEvent } from '@/types/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { invoke } from '@tauri-apps/api/core';

/**
 * 监听 Tauri 事件流，将 Agent 发来的 JSON 事件解析后分发到 store
 * 修复：每次 listen 返回的 unlisten 函数正确保存，避免 Promise 竞争问题
 */
export function useEventStream() {
  const { t } = useTranslation();
  const handleEvent = useAgentStore((s) => s.handleEvent);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setError = useAgentStore((s) => s.setError);
  const queryClient = useQueryClient();

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
            if (parsed.type === 'stream_end') {
              // 使用后端注入的 session_id，确保后台 session 的消息也能正确保存
              const sessionId = (parsed as any).session_id as string | undefined;
              const convId = (sessionId && sessionId !== 'default')
                ? sessionId
                : useWorkspaceStore.getState().activeConversationId;
              if (convId) {
                const storeState = useAgentStore.getState();
                // 保存该 session 自己的消息，而不是当前激活 session 的消息
                const sessionMessages = storeState.sessions[convId]?.messages ?? storeState.messages;
                invoke('save_conversation_messages', {
                  convId,
                  messages: sessionMessages,
                }).catch((err) => console.warn('Failed to save conversation messages on stream_end:', err));
              }
            }
          } catch (e) {
            console.error('[agent-event] JSON parse error:', e, event.payload);
          }
        });
        if (cancelled) {
          agentUnlisten();
          return;
        }
        unlistenRefs.current.push(agentUnlisten);

        const stoppedUnlisten = await listen('agent-stopped', () => {
          if (cancelled) return;
          setStatus('disconnected');
        });
        if (cancelled) {
          stoppedUnlisten();
          return;
        }
        unlistenRefs.current.push(stoppedUnlisten);

        const stderrUnlisten = await listen<string>('agent-stderr', (event) => {
          if (cancelled) return;
          const line = event.payload;
          console.debug('[flock stderr]', line);
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            setError(`Agent stderr: ${line}`);
          }
        });
        if (cancelled) {
          stderrUnlisten();
          return;
        }
        unlistenRefs.current.push(stderrUnlisten);

        const workflowUnlisten = await listen<unknown>('workflow-event', (event) => {
          if (cancelled) return;
          try {
            let payload: {
              type: string;
              workflow_id: string;
              thread_id?: string;
              node_id?: string;
              text?: string;
              error?: string;
              interrupt?: unknown;
            };
            if (typeof event.payload === 'string') {
              payload = JSON.parse(event.payload);
            } else {
              payload = event.payload as typeof payload;
            }

            switch (payload.type) {
              case 'workflow_start':
                setStatus('thinking');
                break;

              case 'workflow_done':
              case 'workflow_error':
              case 'error':
              case 'workflow_interrupted':
                setStatus('ready');
                break;
            }
          } catch (e) {
            console.error('[workflow-event] map error:', e, event.payload);
          }
        });
        if (cancelled) {
          workflowUnlisten();
          return;
        }
        unlistenRefs.current.push(workflowUnlisten);

        const cronUnlisten = await listen<string>('cron-job-updated', () => {
          if (cancelled) return;
          queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });
        if (cancelled) {
          cronUnlisten();
          return;
        }
        unlistenRefs.current.push(cronUnlisten);
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
