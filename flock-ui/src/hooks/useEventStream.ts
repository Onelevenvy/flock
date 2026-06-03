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
              const activeConversationId = useWorkspaceStore.getState().activeConversationId;
              if (activeConversationId) {
                const updatedMessages = useAgentStore.getState().messages;
                invoke('save_conversation_messages', {
                  convId: activeConversationId,
                  messages: updatedMessages,
                }).catch((err) => console.warn('Failed to save conversation messages on stream_end:', err));
              }
            }
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

        const workflowUnlisten = await listen<unknown>('workflow-event', (event) => {
          if (cancelled) return;
          try {
            let payload: {
              type: string;
              workflow_id: string;
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

            const msgId = payload.workflow_id;

            switch (payload.type) {
              case 'workflow_start':
                setStatus('thinking');
                handleEvent({ type: 'stream_start', msg_id: msgId });
                break;

              case 'text_delta':
                if (payload.text) {
                  handleEvent({ type: 'text_delta', text: payload.text, msg_id: msgId });
                }
                break;

              case 'thinking':
                if (payload.text) {
                  handleEvent({ type: 'thinking', text: payload.text, msg_id: msgId });
                }
                break;

              case 'node_start':
                handleEvent({
                  type: 'info',
                  msg_id: msgId,
                  message: `▶️ Running node: [${payload.node_id}]`,
                });
                break;

              case 'workflow_done':
                setStatus('ready');
                handleEvent({ type: 'stream_end', msg_id: msgId });
                {
                  const activeConversationId = useWorkspaceStore.getState().activeConversationId;
                  if (activeConversationId) {
                    const updatedMessages = useAgentStore.getState().messages;
                    invoke('save_conversation_messages', {
                      convId: activeConversationId,
                      messages: updatedMessages,
                    }).catch((err) => console.warn('Failed to save conversation messages on workflow_done:', err));
                  }
                }
                break;

              case 'workflow_error':
              case 'error':
                setStatus('ready');
                const errMsg = payload.error || payload.text || (payload as any).message || 'Unknown error';
                if (errMsg.includes('Workflow execution cancelled by user')) {
                  handleEvent({
                    type: 'text_delta',
                    msg_id: msgId,
                    text: t('chat.aborted', '\n\n*🚫 Dialogue aborted by user*'),
                  });
                  handleEvent({ type: 'stream_end', msg_id: msgId });
                  {
                    const activeConversationId = useWorkspaceStore.getState().activeConversationId;
                    if (activeConversationId) {
                      const updatedMessages = useAgentStore.getState().messages;
                      invoke('save_conversation_messages', {
                        convId: activeConversationId,
                        messages: updatedMessages,
                      }).catch((err) => console.warn('Failed to save conversation messages on workflow cancelled:', err));
                    }
                  }
                  break;
                }
                handleEvent({
                  type: 'error',
                  msg_id: msgId,
                  error: {
                    code: 'WORKFLOW_ERROR',
                    message: errMsg,
                    retryable: true,
                  },
                });
                break;

              case 'workflow_interrupted':
                setStatus('ready');
                const rawInterrupt = payload.interrupt as Record<string, unknown> | null | undefined;
                const interruptData = rawInterrupt?.value ?? rawInterrupt;
                handleEvent({
                  type: 'human_takeover',
                  call_id: 'workflow_interrupt',
                  msg_id: msgId,
                  message: typeof interruptData === 'string' ? interruptData : JSON.stringify(interruptData),
                });
                break;
            }
          } catch (e) {
            console.error('[workflow-event] map error:', e, event.payload);
          }
        });

        const cronUnlisten = await listen<string>('cron-job-updated', () => {
          if (cancelled) return;
          queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });

        if (!cancelled) {
          unlistenRefs.current = [agentUnlisten, stoppedUnlisten, stderrUnlisten, workflowUnlisten, cronUnlisten];
        } else {
          // 如果组件已经卸载，立刻清理
          agentUnlisten();
          stoppedUnlisten();
          stderrUnlisten();
          workflowUnlisten();
          cronUnlisten();
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
