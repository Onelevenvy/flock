import { useEffect } from 'react';
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
    | 'error';
  workflow_id: string;
  node_id?: string;
  text?: string;
  output?: unknown;
  error?: string;
  interrupt?: unknown;
}

export function useWorkflowExecution() {
  const store = useWorkflowStore();

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function setupListener() {
      unlisten = await listen<any>('workflow-event', (event) => {
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
              store.clearExecution();
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
                  type: 'info',
                  content: `🤔 [${payload.node_id}] Thinking: ${payload.text}`,
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
                const responseText = outputObj.response;
                if (typeof responseText === 'string' && responseText.trim()) {
                  // 检查是否已经存在该节点的 text_delta 消息
                  const hasDeltas = store.executionMessages.some(
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
              store.appendExecutionMessage({
                type: 'info',
                content: `⏳ Interrupt hit! Waiting for user input... Detail: ${JSON.stringify(payload.interrupt)}`,
                timestamp,
              });
              break;

            case 'workflow_done':
              store.setExecutionStatus('done');
              store.appendExecutionMessage({
                type: 'info',
                content: `🎉 Workflow execution completed successfully.`,
                timestamp,
              });
              break;

            case 'workflow_error':
            case 'error':
              store.setExecutionStatus('error');
              store.appendExecutionMessage({
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
    }

    if (store.activeWorkflowId) {
      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [store.activeWorkflowId, store.setActiveWorkflowId]);

  const startWorkflow = async (input: string) => {
    if (!store.activeWorkflowId) return;
    store.clearExecution();
    store.setExecutionStatus('running');
    try {
      await invoke('run_workflow', {
        workflowId: store.activeWorkflowId,
        input,
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
    try {
      await invoke('run_workflow', {
        workflowId: store.activeWorkflowId,
        resumeValue: choiceValue,
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

  return {
    startWorkflow,
    resumeWorkflow,
    stopWorkflow,
  };
}
