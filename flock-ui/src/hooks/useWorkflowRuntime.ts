/**
 * useWorkflowRuntime - 统一的工作流执行 Hook
 *
 * 同时服务于两种场景：
 *  - isDebug=true  →  WorkflowEditor 里的调试面板（ExecutionPanel）
 *  - isDebug=false →  Workspace 里的工作流对话（WorkflowChatPanel）
 */
import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { taskService } from '@/services/taskService';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '@/store/workflowStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAgentStore } from '@/store/agentStore';
import type { WorkflowExecutionMessage } from '@/store/workflowStore';

export interface WorkflowTauriEvent {
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
    | 'tool_request'
    | 'tool_running'
    | 'tool_result'
    | 'tool_cancelled'
    | 'debug_start'
    | 'debug_progress'
    | 'debug_done'
    | 'debug_error';
  workflow_id: string;
  thread_id?: string;
  node_id?: string;
  text?: string;
  output?: unknown;
  error?: string;
  interrupt?: { value?: unknown; [key: string]: unknown };
  call_id?: string;
  tool_name?: string;
  category?: string;
  tool_args?: unknown;
}

interface UseWorkflowRuntimeOptions {
  /** 工作流 ID */
  workflowId: string | null;
  /**
   * 线程 ID（用于隔离不同对话或调试会话的执行状态）。
   * - 调试面板：由调用方传入 workflowStore.activeExecutionThreadId（可为 null，首次运行时生成）
   * - 工作空间对话：传入 conversationId
   */
  threadId: string | null;
  /**
   * 是否为调试模式。
   * true  → 额外处理 debug_start/done/error、debugResults 写入、debug_* 消息过滤
   * false → 只处理普通工作流执行事件
   */
  isDebug?: boolean;
}

export function useWorkflowRuntime({
  workflowId,
  threadId,
  isDebug = false,
}: UseWorkflowRuntimeOptions) {
  const { t } = useTranslation();
  const store = useWorkflowStore();

  // ── 当前 threadId 的快捷读取 ──
  const getThread = useCallback(() => {
    if (!threadId) return null;
    return store.threadExecutions[threadId] ?? { messages: [], status: 'idle', interrupt: null };
  }, [threadId, store.threadExecutions]);

  const messages = threadId
    ? (store.threadExecutions[threadId]?.messages ?? [])
    : [];
  const status = threadId
    ? (store.threadExecutions[threadId]?.status ?? 'idle')
    : 'idle';
  const activeInterrupt = threadId
    ? (store.threadExecutions[threadId]?.interrupt ?? null)
    : null;

  // ── 追踪本轮已接收的消息（用于 node_done 补偿去重，不走 store 避免异步问题） ──
  const sentMessagesRef = useRef<WorkflowExecutionMessage[]>([]);

  // ── 分发消息（同时写 store + 更新 ref + 实时增量持久化至 SQLite） ──
  const dispatch = useCallback((tid: string, msg: WorkflowExecutionMessage) => {
    sentMessagesRef.current = [...sentMessagesRef.current, msg];
    store.appendThreadMessage(tid, msg);

    if (!isDebug) {
      const allMsgs = [...(store.threadExecutions[tid]?.messages ?? []), msg];
      invoke('save_workflow_messages', {
        threadId: tid,
        messagesJson: JSON.stringify(allMsgs),
      }).catch((e: unknown) => console.warn('[WorkflowRuntime] Failed to auto-save workflow messages:', e));
    }
  }, [store, isDebug]);

  // ── 切换工作流时清理旧调试数据（仅调试模式） ──
  useEffect(() => {
    if (isDebug) {
      store.clearExecution();
    }
  }, [workflowId]);

  // ── 追踪当前的 threadId 动态值，避免监听器 useEffect 因 threadId 变化频繁销毁和异步重建造成事件漏单 ──
  const threadIdRef = useRef<string | null>(threadId);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  // ── 首次挂载或 threadId 改变时，从 SQLite 加载原生工作流消息（精确还原历史界面） ──
  useEffect(() => {
    const activeTid = threadId;
    if (!activeTid || isDebug) return;

    // 如果内存中已有消息记录，不重复加载
    const currentExec = store.threadExecutions[activeTid];
    if (currentExec && currentExec.messages.length > 0) return;

    async function loadHistory(tid: string) {
      try {
        // 优先加载工作流原生格式（由 save_workflow_messages 保存，精确还原）
        const nativeMsgs = await invoke<WorkflowExecutionMessage[] | null>('load_workflow_messages', {
          threadId: tid,
        });

        if (nativeMsgs && nativeMsgs.length > 0) {
          useWorkflowStore.setState((s) => ({
            threadExecutions: {
              ...s.threadExecutions,
              [tid]: {
                messages: nativeMsgs,
                status: 'done',
                interrupt: null,
              },
            },
          }));
        }
        // 原生格式不存在时不再 fallback，避免因旧格式映射引发的显示错误
      } catch (e) {
        console.warn('[WorkflowRuntime] Failed to load workflow messages:', e);
      }
    }

    loadHistory(activeTid);
  }, [threadId, isDebug, workflowId]);

  // ── 事件监听 ──
  useEffect(() => {
    if (!workflowId) return;

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function setup() {
      try {
        const fn = await listen<any>('workflow-event', (event) => {
          if (cancelled) return;
          console.log("[useWorkflowRuntime] Raw event payload:", event.payload);
          try {
            let payload: WorkflowTauriEvent;
            if (typeof event.payload === 'string') {
              payload = JSON.parse(event.payload);
            } else {
              payload = event.payload as WorkflowTauriEvent;
            }

            // 调试模式：接受 workflowId 本身 + debug 子 ID；聊天模式：只接受精确 workflowId
            const isExactMatch = payload.workflow_id === workflowId;
            const isDebugSubflow = isDebug && payload.workflow_id.startsWith(`${workflowId}:debug:`);
            if (!isExactMatch && !isDebugSubflow) return;

            // 计算当前有效 threadId（调试模式从 store 取最新值）
            const activeTid = isDebug
              ? (useWorkflowStore.getState().activeExecutionThreadId ?? `${workflowId}:debug`)
              : threadIdRef.current;
            if (!activeTid) return;

            // ─── 物理级防串线过滤 ───
            if (payload.thread_id && payload.thread_id !== activeTid) {
              return;
            }

            console.log(`[WorkflowRuntime] Received event type: "${payload.type}" for threadId: "${activeTid}", nodeId: "${payload.node_id ?? ''}"`);

            const timestamp = Date.now();

            switch (payload.type) {
              case 'workflow_start':
                store.setThreadStatus(activeTid, 'running');
                store.setThreadInterrupt(activeTid, null);
                dispatch(activeTid, {
                  type: 'info',
                  content: `🚀 Workflow started...`,
                  timestamp,
                });
                break;

              case 'node_start':
                if (!isDebugSubflow) {
                  dispatch(activeTid, {
                    type: 'info',
                    content: `▶️ Running node: [${payload.node_id}]`,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'text_delta':
                if (payload.text) {
                  if (isDebugSubflow) {
                    // 调试子流：写入 debugResults
                    const targetId = store.debugTarget?.nodeId;
                    if (targetId) {
                      const prev = store.debugResults[targetId];
                      if (prev) {
                        const currentOutput = (prev.output && typeof prev.output === 'object') ? { ...prev.output } : {};
                        currentOutput.response = (currentOutput.response || '') + payload.text;
                        store.setDebugResult(targetId, { ...prev, output: currentOutput });
                      }
                    }
                  } else {
                    dispatch(activeTid, {
                      type: 'text_delta',
                      content: payload.text,
                      nodeId: payload.node_id,
                      timestamp,
                    });
                  }
                }
                break;

              case 'thinking':
                if (payload.text) {
                  if (isDebugSubflow) {
                    const targetId = store.debugTarget?.nodeId;
                    if (targetId) {
                      const prev = store.debugResults[targetId];
                      if (prev) {
                        const currentOutput = (prev.output && typeof prev.output === 'object') ? { ...prev.output } : {};
                        currentOutput.thinking = (currentOutput.thinking || '') + payload.text;
                        store.setDebugResult(targetId, { ...prev, output: currentOutput });
                      }
                    }
                  } else {
                    dispatch(activeTid, {
                      type: 'thinking',
                      content: payload.text,
                      nodeId: payload.node_id,
                      timestamp,
                    });
                  }
                }
                break;

              case 'node_done': {
                if (!isDebugSubflow) {
                  dispatch(activeTid, {
                    type: 'info',
                    content: `✅ Node [${payload.node_id}] finished.`,
                    nodeId: payload.node_id,
                    timestamp,
                  });

                  // 补偿非流式返回：只在该节点还没有 text_delta 时才补偿
                  if (payload.output && typeof payload.output === 'object') {
                    const outputObj = payload.output as Record<string, unknown>;
                    const responseText = outputObj.response || outputObj.answer;
                    if (typeof responseText === 'string' && responseText.trim()) {
                      const hasDeltas = sentMessagesRef.current.some(
                        (m) => m.nodeId === payload.node_id && m.type === 'text_delta'
                      );
                      if (!hasDeltas) {
                        dispatch(activeTid, {
                          type: 'text_delta',
                          content: responseText,
                          nodeId: payload.node_id,
                          timestamp: timestamp + 1,
                        });
                      }
                    }
                  }
                }
                break;
              }

              case 'workflow_interrupted': {
                const rawInterrupt = payload.interrupt as any;
                const interruptData = rawInterrupt?.value ?? rawInterrupt;
                console.log(`[WorkflowRuntime] workflow_interrupted event details:`, interruptData);
                store.setThreadStatus(activeTid, 'idle');
                store.setThreadInterrupt(activeTid, interruptData);
                dispatch(activeTid, {
                  type: 'interrupt' as any,
                  content: JSON.stringify(interruptData),
                  timestamp,
                });
                break;
              }

              case 'workflow_done':
                store.setThreadStatus(activeTid, 'done');
                store.setThreadInterrupt(activeTid, null);
                dispatch(activeTid, {
                  type: 'info',
                  content: `🎉 Workflow execution completed successfully.`,
                  timestamp,
                });
                // 将完整消息数组保存到 SQLite（原生格式），确保重启后历史界面与当前完全一致
                if (!isDebug) {
                  const msgs = useWorkflowStore.getState().threadExecutions[activeTid]?.messages ?? [];
                  invoke('save_workflow_messages', {
                    threadId: activeTid,
                    messagesJson: JSON.stringify(msgs),
                  }).catch((e: unknown) => console.warn('[WorkflowRuntime] Failed to save workflow messages:', e));
                }
                break;

              case 'workflow_error':
              case 'error':
                const isUserCancel = (payload.error || payload.text || (payload as any).message || '').includes('Workflow execution cancelled by user');
                if (isUserCancel) {
                  store.setThreadStatus(activeTid, 'idle');
                  break;
                }
                store.setThreadStatus(activeTid, 'error');
                store.setThreadInterrupt(activeTid, null);
                dispatch(activeTid, {
                  type: 'error',
                  content: `❌ Execution error: ${payload.error || payload.text || (payload as any).message || 'Unknown error'}`,
                  timestamp,
                });
                break;

              case 'tool_request': {
                console.log("[useWorkflowRuntime] tool_request payload:", payload);
                if (payload.call_id && payload.tool_name) {
                  useAgentStore.getState().addPendingApproval({
                    call_id: payload.call_id!,
                    tool: {
                      name: payload.tool_name!,
                      category: (payload.category?.toLowerCase() as any) || 'exec',
                      args: (payload.tool_args as any) || {},
                      description: '',
                    },
                    msg_id: activeTid,
                    is_workflow: true,
                  });
                }
                break;
              }

              case 'tool_running':
              case 'tool_result':
              case 'tool_cancelled': {
                if (payload.call_id) {
                  useAgentStore.getState().removePendingApproval(payload.call_id);
                }
                break;
              }

              // ── 调试专属事件 ──
              case 'debug_start':
                if (isDebug) {
                  store.setThreadStatus(activeTid, 'running');
                  dispatch(activeTid, {
                    type: 'info',
                    content: `🔍 Debugging node [${payload.node_id}]...`,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;

              case 'debug_done': {
                if (isDebug) {
                  store.setThreadStatus(activeTid, 'done');
                  const targetId = payload.node_id || store.debugTarget?.nodeId || '';
                  const prev = targetId ? store.debugResults[targetId] : null;
                  const startTime = prev?.startTime || Date.now();
                  if (targetId) {
                    store.setDebugResult(targetId, {
                      status: 'done',
                      input: prev?.input || null,
                      output: payload.output,
                      startTime,
                      duration: Date.now() - startTime,
                    });
                  }
                  dispatch(activeTid, {
                    type: 'info',
                    content: `✅ Debug done. Output: ${JSON.stringify(payload.output)}`,
                    nodeId: payload.node_id,
                    timestamp,
                  });
                }
                break;
              }

              case 'debug_error': {
                if (isDebug) {
                  store.setThreadStatus(activeTid, 'error');
                  const targetId = payload.node_id || store.debugTarget?.nodeId || '';
                  const prev = targetId ? store.debugResults[targetId] : null;
                  if (targetId) {
                    store.setDebugResult(targetId, {
                      status: 'error',
                      input: prev?.input || null,
                      output: null,
                      error: payload.error || 'Unknown error',
                      startTime: prev?.startTime || Date.now(),
                      duration: prev ? Date.now() - prev.startTime : undefined,
                    });
                  }
                  dispatch(activeTid, {
                    type: 'error',
                    content: `❌ Debug error: ${payload.error || 'Unknown error'}`,
                    timestamp,
                  });
                }
                break;
              }
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
        console.warn('Failed to setup workflow runtime listener:', e);
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [workflowId, isDebug]);

  // ── startWorkflow ──
  const startWorkflow = useCallback(async (input: string) => {
    if (!workflowId) return;

    // 触发强制自动保存如果存在未保存的修改
    const saveRef = store.saveDraftRef?.current;
    if (saveRef && store.isDirty) {
      await saveRef();
    }

    let activeTid = threadId;
    if (isDebug && !activeTid) {
      // 调试模式：无活跃 threadId 时才全新生成并清空
      activeTid = `${workflowId}_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      store.clearExecution();
      store.setActiveExecutionThreadId(activeTid);
    }
    if (!activeTid) return;

    // 清空本轮消息追踪
    sentMessagesRef.current = [];

    store.setThreadStatus(activeTid, 'running');
    store.setThreadInterrupt(activeTid, null);

    // 提取 user 显示文本
    let userMsgContent = input;
    try {
      if (input.trim().startsWith('{')) {
        const parsed = JSON.parse(input);
        if (parsed.query) {
          userMsgContent = parsed.query;
        } else {
          userMsgContent = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join('\n');
        }
      }
    } catch (_) {}

    dispatch(activeTid, {
      type: 'user',
      content: userMsgContent,
      timestamp: Date.now(),
    });

    try {
      await taskService.runWorkflow({
        workflowId,
        input,
        threadId: activeTid,
        useDraft: isDebug,
      });
    } catch (e) {
      store.setThreadStatus(activeTid, 'error');
      dispatch(activeTid, {
        type: 'error',
        content: `Failed to start workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId, threadId, isDebug, store, dispatch]);

  // ── resumeWorkflow ──
  const resumeWorkflow = useCallback(async (
    choiceValue: unknown,
    actionLabel?: string,
    resolvedFeedback?: string,
  ) => {
    if (!workflowId) return;
    const activeTid = isDebug
      ? (store.activeExecutionThreadId ?? `${workflowId}:debug`)
      : threadId;
    if (!activeTid) return;

    store.setThreadStatus(activeTid, 'running');

    // 将 resume 动作派出为一条 user 消息保入 store，并附带 resolvedActionLabel 平套字段
    // 这样 save_workflow_messages 能完整保存 Human 节点展示所需的信息
    const resumeUserMsg: any = {
      type: 'user',
      content: typeof choiceValue === 'object' && choiceValue !== null
        ? JSON.stringify(choiceValue)
        : String(choiceValue ?? ''),
      timestamp: Date.now(),
      resolvedActionLabel: actionLabel,
      resolvedFeedback: resolvedFeedback,
    };
    dispatch(activeTid, resumeUserMsg);

    try {
      await taskService.runWorkflow({
        workflowId,
        resumeValue: choiceValue,
        threadId: activeTid,
        useDraft: isDebug,
      });
    } catch (e) {
      store.setThreadStatus(activeTid, 'error');
      dispatch(activeTid, {
        type: 'error',
        content: `Failed to resume workflow: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId, threadId, isDebug, store, dispatch]);

  // ── stopWorkflow ──
  const stopWorkflow = useCallback(async () => {
    console.log("[useWorkflowRuntime] stopWorkflow clicked! workflowId:", workflowId, "threadId:", threadId, "isDebug:", isDebug);
    if (!workflowId) {
      console.warn("[useWorkflowRuntime] stopWorkflow failed: workflowId is null or empty");
      return;
    }
    const activeTid = isDebug
      ? (store.activeExecutionThreadId ?? `${workflowId}:debug`)
      : threadId;
    try {
      console.log("[useWorkflowRuntime] Invoking stop_workflow with workflowId:", workflowId);
      await taskService.stopWorkflow(workflowId);
      console.log("[useWorkflowRuntime] stop_workflow command executed successfully on backend.");
      
      // 同时重置 AgentStore 的状态，以防全局状态处于 thinking 或连接中
      useAgentStore.getState().setStatus('ready');

      if (activeTid) {
        store.setThreadStatus(activeTid, 'idle');
        dispatch(activeTid, {
          type: 'text_delta',
          content: t('chat.aborted'),
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      console.error("[useWorkflowRuntime] stop_workflow invoke failed:", e);
      if (activeTid) {
        dispatch(activeTid, {
          type: 'error',
          content: `Failed to stop workflow: ${e}`,
          timestamp: Date.now(),
        });
      }
    }
  }, [workflowId, threadId, isDebug, store, dispatch]);

  // ── debugNode（调试专属） ──
  const debugNode = useCallback(async (nodeId: string, input?: string) => {
    if (!workflowId || !isDebug) return;

    // 调试单个节点也触发强制自动保存
    const saveRef = store.saveDraftRef?.current;
    if (saveRef && store.isDirty) {
      await saveRef();
    }

    const activeTid = isDebug
      ? (store.activeExecutionThreadId ?? `${workflowId}:debug`)
      : threadId;
    if (!activeTid) return;

    store.clearExecution();
    store.setThreadStatus(activeTid, 'running');

    let parsedInput = null;
    try { if (input) parsedInput = JSON.parse(input); } catch {}

    store.setDebugResult(nodeId, {
      status: 'running',
      input: parsedInput,
      output: null,
      startTime: Date.now(),
    });

    dispatch(activeTid, {
      type: 'info',
      content: `🔍 Starting debug for node [${nodeId}]...`,
      nodeId,
      timestamp: Date.now(),
    });

    try {
      await invoke('debug_node', {
        workflowId,
        nodeId,
        input: input ?? '',
      });
    } catch (e) {
      store.setThreadStatus(activeTid, 'error');
      store.setDebugResult(nodeId, {
        status: 'error',
        input: parsedInput,
        output: null,
        error: String(e),
        startTime: Date.now(),
      });
      dispatch(activeTid, {
        type: 'error',
        content: `Failed to debug node: ${e}`,
        timestamp: Date.now(),
      });
    }
  }, [workflowId, threadId, isDebug, store, dispatch]);

  // ── clearExecution（清理当前 thread） ──
  const clearExecution = useCallback(() => {
    if (isDebug) {
      store.clearExecution(); // 同时重置 activeExecutionThreadId
    } else if (threadId) {
      store.clearThreadExecution(threadId);
    }
    sentMessagesRef.current = [];
  }, [isDebug, threadId, store]);

  return {
    messages,
    status,
    activeInterrupt,
    startWorkflow,
    resumeWorkflow,
    stopWorkflow,
    debugNode: isDebug ? debugNode : undefined,
    clearExecution,
  };
}
