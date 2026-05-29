import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { WorkflowTauriEvent } from './useWorkflowExecution';
import type { WorkflowExecutionMessage } from '../store/workflowStore';

/**
 * 工作流对话模式的执行 hook（用于 WorkspaceView 内嵌的工作流对话，区别于 WorkflowEditor 里的调试面板）
 * 不依赖 workflowStore.activeWorkflowId，而是直接接受 workflowId 参数
 */
export function useWorkflowChatExecution(params: {
  workflowId: string | null;
  threadId: string | null;
  onMessage: (msg: WorkflowExecutionMessage) => void;
  onStatusChange: (status: 'idle' | 'running' | 'done' | 'error') => void;
  onInterrupt: (data: any | null) => void;
}) {
  const { workflowId, threadId, onMessage, onStatusChange, onInterrupt } = params;

  // Keep refs stable to avoid re-subscribing
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const onInterruptRef = useRef(onInterrupt);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { onInterruptRef.current = onInterrupt; }, [onInterrupt]);

  useEffect(() => {
    if (!workflowId) return;

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function setup() {
      try {
        const fn = await listen<any>('workflow-event', (event) => {
          if (cancelled) return;
          try {
            let payload: WorkflowTauriEvent;
            if (typeof event.payload === 'string') {
              payload = JSON.parse(event.payload);
            } else {
              payload = event.payload as WorkflowTauriEvent;
            }

            // 只处理当前工作流的事件
            if (payload.workflow_id !== workflowId) return;

            const timestamp = Date.now();

            switch (payload.type) {
              case 'workflow_start':
                onStatusChangeRef.current('running');
                onInterruptRef.current(null);
                break;

              case 'node_start':
                onMessageRef.current({
                  type: 'info',
                  content: `▶️ Running node: [${payload.node_id}]`,
                  nodeId: payload.node_id,
                  timestamp,
                });
                break;

              case 'text_delta':
                if (payload.text) {
                  onMessageRef.current({
                    type: 'text_delta',
                    content: payload.text,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'thinking':
                if (payload.text) {
                  onMessageRef.current({
                    type: 'thinking',
                    content: payload.text,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'node_done': {
                onMessageRef.current({
                  type: 'info',
                  content: `✅ Node [${payload.node_id}] finished.`,
                  nodeId: payload.node_id,
                  timestamp,
                });
                // 补偿非流式返回
                if (payload.output && typeof payload.output === 'object') {
                  const outputObj = payload.output as Record<string, unknown>;
                  const responseText = outputObj.response || outputObj.answer;
                  if (typeof responseText === 'string' && responseText.trim()) {
                    onMessageRef.current({
                      type: 'text_delta',
                      content: responseText,
                      nodeId: payload.node_id,
                      timestamp: timestamp + 1,
                    });
                  }
                }
                break;
              }

              case 'workflow_interrupted': {
                const rawInterrupt = payload.interrupt as any;
                const interruptData = rawInterrupt?.value ?? rawInterrupt;
                onStatusChangeRef.current('idle');
                onInterruptRef.current(interruptData);
                onMessageRef.current({
                  type: 'interrupt' as any,
                  content: JSON.stringify(interruptData),
                  timestamp,
                });
                break;
              }

              case 'workflow_done':
                onStatusChangeRef.current('done');
                onInterruptRef.current(null);
                onMessageRef.current({
                  type: 'info',
                  content: `🎉 Workflow execution completed successfully.`,
                  timestamp,
                });
                break;

              case 'workflow_error':
              case 'error':
                onStatusChangeRef.current('error');
                onInterruptRef.current(null);
                onMessageRef.current({
                  type: 'error',
                  content: `❌ Execution error: ${payload.error || payload.text || 'Unknown error'}`,
                  timestamp,
                });
                break;
            }
          } catch (e) {
            console.error('Failed to parse workflow event payload:', e);
          }
        });

        if (!cancelled) {
          unlisten = fn;
        } else {
          fn();
        }
      } catch (e) {
        console.warn('Failed to setup workflow chat listener:', e);
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [workflowId]);

  const startWorkflow = useCallback(async (input: string) => {
    if (!workflowId || !threadId) return;

    onStatusChangeRef.current('running');
    onInterruptRef.current(null);

    let userMsgContent = input;
    try {
      if (input.trim().startsWith('{')) {
        const parsed = JSON.parse(input);
        if (parsed.query) {
          userMsgContent = parsed.query;
        }
      }
    } catch (_) {}

    onMessageRef.current({
      type: 'user',
      content: userMsgContent,
      timestamp: Date.now(),
    });

    try {
      await invoke('run_workflow', {
        workflowId,
        input,
        threadId,
      });
    } catch (e) {
      onStatusChangeRef.current('error');
      onMessageRef.current({
        type: 'error',
        content: `Failed to start workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId, threadId]);

  const resumeWorkflow = useCallback(async (choiceValue: unknown) => {
    if (!workflowId || !threadId) return;
    onStatusChangeRef.current('running');

    try {
      await invoke('run_workflow', {
        workflowId,
        resumeValue: choiceValue,
        threadId,
      });
    } catch (e) {
      onStatusChangeRef.current('error');
      onMessageRef.current({
        type: 'error',
        content: `Failed to resume workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId, threadId]);

  const stopWorkflow = useCallback(async () => {
    if (!workflowId) return;
    try {
      await invoke('stop_workflow', { workflowId });
      onStatusChangeRef.current('idle');
      onMessageRef.current({
        type: 'info',
        content: `🛑 Workflow execution stopped by user.`,
        timestamp: Date.now(),
      });
    } catch (e) {
      onMessageRef.current({
        type: 'error',
        content: `Failed to stop workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId]);

  return { startWorkflow, resumeWorkflow, stopWorkflow };
}
