import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkflowStore } from '../store/workflowStore';
import { invoke } from '@tauri-apps/api/core';

// 定义 Tauri 传过来的事件接口
interface WorkflowTauriEvent {
  type:
    | 'workflow_start'
    | 'workflow_progress'
    | 'workflow_interrupted'
    | 'workflow_done'
    | 'workflow_error'
    | 'node_start'
    | 'node_done'
    | 'text_delta'
    | 'thinking'
    | 'error'
    | 'debug_start'
    | 'debug_progress'
    | 'debug_done'
    | 'debug_error';
  workflow_id: string;
  node_id?: string;
  text?: string;
  output?: unknown;
  error?: string;
  interrupt?: unknown;
}

export function useWorkflowExecution() {
  const store = useWorkflowStore();
  const unlistenRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    // 切换工作流时自动清理当前调试状态与 thread_id，避免跨工作流数据与会话残留
    store.clearExecution();

    let cancelled = false;

    async function setupListener() {
      try {
        const unlisten = await listen<any>('workflow-event', (event) => {
          if (cancelled) return;
          try {
            let payload: WorkflowTauriEvent;
            if (typeof event.payload === 'string') {
              payload = JSON.parse(event.payload);
            } else {
              payload = event.payload as WorkflowTauriEvent;
            }

            if (payload.workflow_id !== store.activeWorkflowId) {
              // 如果不是当前活跃的工作流，忽略
              return;
            }

            const timestamp = Date.now();

            switch (payload.type) {
              case 'workflow_start':
                store.setExecutionStatus('running');
                store.setActiveInterrupt(null);
                store.appendExecutionMessage({
                  type: 'info',
                  content: `🚀 Workflow ${payload.workflow_id} execution started...`,
                  timestamp,
                });
                break;

              case 'node_start':
                store.appendExecutionMessage({
                  type: 'info',
                  content: `▶️ Running node: [${payload.node_id}]`,
                  nodeId: payload.node_id,
                  timestamp,
                });
                break;

              case 'text_delta':
                if (payload.text) {
                  store.appendExecutionMessage({
                    type: 'text_delta',
                    content: payload.text,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'thinking':
                if (payload.text) {
                  store.appendExecutionMessage({
                    type: 'thinking',
                    content: payload.text,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'node_done': {
                store.appendExecutionMessage({
                  type: 'info',
                  content: `✅ Node [${payload.node_id}] finished. Output: ${JSON.stringify(payload.output)}`,
                  nodeId: payload.node_id,
                  timestamp,
                });

                // 补偿非流式返回：如果期间没有任何 text_delta 产生，在此一次性补偿以供 UI 聊天气泡显示
                if (payload.output && typeof payload.output === 'object') {
                  const outputObj = payload.output as Record<string, unknown>;
                  const responseText = outputObj.response || outputObj.answer;
                  if (typeof responseText === 'string' && responseText.trim()) {
                    // 使用 getState() 获取最新的 state，彻底解决 React 闭包捕获 stale closure 导致的重复补偿 Bug
                    const currentMessages = useWorkflowStore.getState().executionMessages;
                    const hasDeltas = currentMessages.some(
                      (m) => m.nodeId === payload.node_id && m.type === 'text_delta'
                    );
                    if (!hasDeltas) {
                      store.appendExecutionMessage({
                        type: 'text_delta',
                        content: responseText,
                        nodeId: payload.node_id,
                        timestamp,
                      });
                    }
                  }
                }
                break;
              }

              case 'workflow_interrupted':
                store.setExecutionStatus('idle'); // 暂停等待 HITL 输入
                store.setActiveInterrupt(payload.interrupt);
                store.appendExecutionMessage({
                  type: 'info',
                  content: `⏳ Interrupt hit! Waiting for user input... Detail: ${JSON.stringify(payload.interrupt)}`,
                  timestamp,
                });
                break;

              case 'workflow_done':
                store.setExecutionStatus('done');
                store.setActiveInterrupt(null);
                store.appendExecutionMessage({
                  type: 'info',
                  content: `🎉 Workflow execution completed successfully.`,
                  timestamp,
                });
                break;

              case 'workflow_error':
              case 'error':
                store.setExecutionStatus('error');
                store.setActiveInterrupt(null);
                store.appendExecutionMessage({
                  type: 'error',
                  content: `❌ Execution error: ${payload.error || payload.text || 'Unknown error'}`,
                  timestamp,
                });
                break;

              case 'debug_start':
                store.setExecutionStatus('running');
                store.appendExecutionMessage({
                  type: 'info',
                  content: `🔍 Debugging node [${payload.node_id}]...`,
                  nodeId: payload.node_id,
                  timestamp,
                });
                break;

              case 'debug_done':
                store.setExecutionStatus('done');
                store.appendExecutionMessage({
                  type: 'info',
                  content: `✅ Debug done. Output: ${JSON.stringify(payload.output)}`,
                  nodeId: payload.node_id,
                  timestamp,
                });
                break;

              case 'debug_error':
                store.setExecutionStatus('error');
                store.appendExecutionMessage({
                  type: 'error',
                  content: `❌ Debug error: ${payload.error || 'Unknown error'}`,
                  timestamp,
                });
                break;
            }
          } catch (e) {
            console.error('Failed to parse workflow event payload:', e);
          }
        });

        if (!cancelled) {
          unlistenRefs.current = [unlisten];
        } else {
          unlisten();
        }
      } catch (e) {
        console.warn('Failed to setup workflow listener:', e);
      }
    }

    if (store.activeWorkflowId) {
      setupListener();
    }

    return () => {
      cancelled = true;
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];
    };
  }, [store.activeWorkflowId]);

  const startWorkflow = async (input: string) => {
    if (!store.activeWorkflowId) return;

    let threadId = store.activeExecutionThreadId;
    if (!threadId) {
      // 开启全新调试会话时，清空之前会话痕迹并生成全新的隔离 thread_id
      store.clearExecution();
      threadId = `${store.activeWorkflowId}_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      store.setActiveExecutionThreadId(threadId);
    }

    store.setExecutionStatus('running');

    let userMsgContent = input;
    try {
      if (input.trim().startsWith('{')) {
        const parsed = JSON.parse(input);
        if (parsed.query) {
          userMsgContent = parsed.query;
        } else {
          userMsgContent = Object.entries(parsed)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        }
      }
    } catch (_) {}

    store.appendExecutionMessage({
      type: 'user',
      content: userMsgContent,
      timestamp: Date.now(),
    });

    try {
      await invoke('run_workflow', {
        workflowId: store.activeWorkflowId,
        input,
        threadId,
      });
    } catch (e) {
      store.setExecutionStatus('error');
      store.appendExecutionMessage({
        type: 'error',
        content: `Failed to start workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  };

  const resumeWorkflow = async (choiceValue: unknown) => {
    if (!store.activeWorkflowId) return;
    store.setExecutionStatus('running');

    const threadId = store.activeExecutionThreadId || store.activeWorkflowId;

    try {
      await invoke('run_workflow', {
        workflowId: store.activeWorkflowId,
        resumeValue: choiceValue,
        threadId,
      });
    } catch (e) {
      store.setExecutionStatus('error');
      store.appendExecutionMessage({
        type: 'error',
        content: `Failed to resume workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  };

  const stopWorkflow = async () => {
    if (!store.activeWorkflowId) return;
    try {
      await invoke('stop_workflow', {
        workflowId: store.activeWorkflowId,
      });
      store.setExecutionStatus('idle');
      store.appendExecutionMessage({
        type: 'info',
        content: `🛑 Workflow execution stopped by user.`,
        timestamp: Date.now(),
      });
    } catch (e) {
      store.appendExecutionMessage({
        type: 'error',
        content: `Failed to stop workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  };

  const debugNode = async (nodeId: string, input?: string) => {
    if (!store.activeWorkflowId) return;

    store.clearExecution();
    store.setExecutionStatus('running');
    store.appendExecutionMessage({
      type: 'info',
      content: `🔍 Starting debug for node [${nodeId}]...`,
      nodeId,
      timestamp: Date.now(),
    });

    try {
      await invoke('debug_node', {
        workflowId: store.activeWorkflowId,
        nodeId,
        input: input ?? '',
      });
    } catch (e) {
      store.setExecutionStatus('error');
      store.appendExecutionMessage({
        type: 'error',
        content: `Failed to debug node: ${e}`,
        timestamp: Date.now(),
      });
    }
  };

  return {
    startWorkflow,
    resumeWorkflow,
    stopWorkflow,
    debugNode,
  };
}

