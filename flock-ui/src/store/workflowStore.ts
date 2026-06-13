import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from 'reactflow';

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  config: WorkflowConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  active_version?: string;
}

export interface WorkflowConfig {
  nodes: Node[];
  edges: Edge[];
  metadata?: {
    viewport?: { x: number; y: number; zoom: number };
    env_vars?: Record<string, { value: string; type: string }>;
    [key: string]: unknown;
  };
}

export interface WorkflowExecutionMessage {
  type: 'user' | 'text_delta' | 'thinking' | 'info' | 'error' | 'done';
  content: string;
  nodeId?: string;
  timestamp: number;
  attachments?: any[];
}

/** 单个线程的执行状态 */
export interface ThreadExecution {
  messages: WorkflowExecutionMessage[];
  status: 'idle' | 'running' | 'done' | 'error';
  interrupt: any | null;
}

export interface EnvVar {
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

interface WorkflowStore {
  // 活跃工作流 ID（编辑器中打开的）
  activeWorkflowId: string | null;
  // 画布节点/边（编辑中的临时状态）
  nodes: Node[];
  edges: Edge[];
  // 是否有未保存更改
  isDirty: boolean;
  // ── 按 threadId 索引的执行状态（统一调试 + 工作空间对话） ──
  threadExecutions: Record<string, ThreadExecution>;
  // 调试面板当前活跃的 threadId（由 WorkflowEditor 管理）
  activeExecutionThreadId: string | null;
  // 当前选中的节点 ID（属性面板用）
  selectedNodeId: string | null;
  // 单节点调试目标
  debugTarget: { nodeId: string } | null;
  // 调试结果记录 (nodeId -> debugResult)
  debugResults: Record<string, {
    status: 'running' | 'done' | 'error';
    input: any;
    output: any;
    error?: string;
    startTime: number;
    duration?: number;
    tokens?: number;
  }>;
  // 环境变量
  environmentVariables: Record<string, EnvVar>;
  // 从主页跳转启动的待执行初始 Query
  pendingStartQuery: string | null;
  // 从探索页跳转启动的完整 Start 入参
  pendingStartInput: Record<string, any> | null;
  // 保存草稿的全局 Ref
  saveDraftRef?: { current: (() => Promise<void>) | null };

  // ── 派生字段（向后兼容，从 activeExecutionThreadId 的 thread 取值） ──
  // 供 FlowCanvas/NodeDebugPanel 等直接读取调试面板状态
  readonly executionMessages: WorkflowExecutionMessage[];
  readonly executionStatus: 'idle' | 'running' | 'done' | 'error';
  readonly activeInterrupt: any | null;

  // Actions
  setActiveWorkflowId: (id: string | null) => void;
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setDirty: (dirty: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  loadWorkflowConfig: (config: WorkflowConfig) => void;
  setActiveExecutionThreadId: (id: string | null) => void;

  // Thread execution actions
  appendThreadMessage: (threadId: string, msg: WorkflowExecutionMessage) => void;
  setThreadStatus: (threadId: string, status: 'idle' | 'running' | 'done' | 'error') => void;
  setThreadInterrupt: (threadId: string, interrupt: any | null) => void;
  clearThreadExecution: (threadId: string) => void;

  // 调试面板专用（操作 activeExecutionThreadId 对应的 thread）
  clearExecution: () => void;
  appendExecutionMessage: (msg: WorkflowExecutionMessage) => void;
  setExecutionStatus: (status: 'idle' | 'running' | 'done' | 'error') => void;
  setActiveInterrupt: (interrupt: any | null) => void;

  updateNodeData: (nodeId: string, key: string, value: unknown) => void;
  setDebugTarget: (target: { nodeId: string } | null) => void;
  setDebugResult: (nodeId: string, result: WorkflowStore['debugResults'][string]) => void;
  setEnvironmentVariable: (key: string, value: string, type: EnvVar['type']) => void;
  removeEnvironmentVariable: (key: string) => void;
  setEnvironmentVariables: (vars: Record<string, EnvVar>) => void;
  setPendingStartQuery: (q: string | null) => void;
  setPendingStartInput: (input: Record<string, any> | null) => void;
}

/** 获取或初始化一个 thread 的执行状态 */
function getThread(threadExecutions: Record<string, ThreadExecution>, threadId: string): ThreadExecution {
  return threadExecutions[threadId] ?? { messages: [], status: 'idle', interrupt: null };
}

/** 调试面板使用的固定 threadId key（当 activeExecutionThreadId 为 null 时的 fallback） */
const DEBUG_FALLBACK_THREAD = '__debug__';

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      activeWorkflowId: null,
      nodes: [],
      edges: [],
      isDirty: false,
      threadExecutions: {},
      activeExecutionThreadId: null,
      selectedNodeId: null,
      debugTarget: null,
      debugResults: {},
      environmentVariables: {},
      pendingStartQuery: null,
      pendingStartInput: null,
      saveDraftRef: { current: null },

      // ── 派生计算属性（调试面板当前 thread 的状态） ──
      get executionMessages() {
        const s = get();
        const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
        return getThread(s.threadExecutions, tid).messages;
      },
      get executionStatus() {
        const s = get();
        const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
        return getThread(s.threadExecutions, tid).status;
      },
      get activeInterrupt() {
        const s = get();
        const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
        return getThread(s.threadExecutions, tid).interrupt;
      },

      setActiveWorkflowId: (id) => set({ activeWorkflowId: id }),
      setPendingStartQuery: (q) => set({ pendingStartQuery: q }),
      setPendingStartInput: (input) => set({ pendingStartInput: input }),

      setDebugResult: (nodeId, result) => set((s) => ({
        debugResults: { ...s.debugResults, [nodeId]: result }
      })),

      setNodes: (nodes) =>
        set((s) => {
          const nextNodes = typeof nodes === 'function' ? nodes(s.nodes) : nodes;
          let hasChanged = false;
          if (nextNodes.length !== s.nodes.length) {
            hasChanged = true;
          } else {
            for (let i = 0; i < nextNodes.length; i++) {
              const n1 = nextNodes[i];
              const n2 = s.nodes.find((n) => n.id === n1.id);
              if (!n2) { hasChanged = true; break; }
              if (n1.position.x !== n2.position.x || n1.position.y !== n2.position.y) { hasChanged = true; break; }
              if (JSON.stringify(n1.data) !== JSON.stringify(n2.data)) { hasChanged = true; break; }
            }
          }
          return { nodes: nextNodes, isDirty: s.isDirty || hasChanged };
        }),

      setEdges: (edges) =>
        set((s) => {
          const nextEdges = typeof edges === 'function' ? edges(s.edges) : edges;
          let hasChanged = false;
          if (nextEdges.length !== s.edges.length) {
            hasChanged = true;
          } else {
            for (let i = 0; i < nextEdges.length; i++) {
              const e1 = nextEdges[i];
              const e2 = s.edges.find((e) => e.id === e1.id);
              if (!e2) { hasChanged = true; break; }
              if (e1.source !== e2.source || e1.target !== e2.target ||
                  e1.sourceHandle !== e2.sourceHandle || e1.targetHandle !== e2.targetHandle) {
                hasChanged = true; break;
              }
            }
          }
          return { edges: nextEdges, isDirty: s.isDirty || hasChanged };
        }),

      setDirty: (dirty) => set({ isDirty: dirty }),
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setDebugTarget: (target) => set({ debugTarget: target }),
      setActiveExecutionThreadId: (id) => set({ activeExecutionThreadId: id }),

      loadWorkflowConfig: (config) => {
        const nextNodes = (config.nodes ?? []).filter((n) => n.type !== 'end');
        const endNodeIds = new Set(
          (config.nodes ?? []).filter((n) => n.type === 'end').map((n) => n.id)
        );
        const nextEdges = (config.edges ?? []).filter(
          (e) => !endNodeIds.has(e.source) && !endNodeIds.has(e.target)
        );
        set({
          nodes: nextNodes,
          edges: nextEdges,
          environmentVariables: (config.metadata?.env_vars as any) ?? {},
          isDirty: false,
        });
      },

      // ── Thread execution actions ──

      appendThreadMessage: (threadId, msg) =>
        set((s) => {
          const prev = getThread(s.threadExecutions, threadId);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [threadId]: { ...prev, messages: [...prev.messages, msg] },
            },
          };
        }),

      setThreadStatus: (threadId, status) =>
        set((s) => {
          const prev = getThread(s.threadExecutions, threadId);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [threadId]: { ...prev, status },
            },
          };
        }),

      setThreadInterrupt: (threadId, interrupt) =>
        set((s) => {
          const prev = getThread(s.threadExecutions, threadId);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [threadId]: { ...prev, interrupt },
            },
          };
        }),

      clearThreadExecution: (threadId) =>
        set((s) => {
          const rest = { ...s.threadExecutions };
          delete rest[threadId];
          return { threadExecutions: rest };
        }),

      // ── 调试面板快捷方法（操作 activeExecutionThreadId 对应的 thread） ──

      clearExecution: () =>
        set((s) => {
          const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
          const rest = { ...s.threadExecutions };
          delete rest[tid];
          return { threadExecutions: rest, activeExecutionThreadId: null };
        }),

      appendExecutionMessage: (msg) =>
        set((s) => {
          const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
          const prev = getThread(s.threadExecutions, tid);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [tid]: { ...prev, messages: [...prev.messages, msg] },
            },
          };
        }),

      setExecutionStatus: (status) =>
        set((s) => {
          const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
          const prev = getThread(s.threadExecutions, tid);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [tid]: { ...prev, status },
            },
          };
        }),

      setActiveInterrupt: (interrupt) =>
        set((s) => {
          const tid = s.activeExecutionThreadId ?? DEBUG_FALLBACK_THREAD;
          const prev = getThread(s.threadExecutions, tid);
          return {
            threadExecutions: {
              ...s.threadExecutions,
              [tid]: { ...prev, interrupt },
            },
          };
        }),

      updateNodeData: (nodeId, key, value) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n
          ),
          isDirty: true,
        })),

      setEnvironmentVariable: (key, value, type) =>
        set((s) => ({
          environmentVariables: { ...s.environmentVariables, [key]: { value, type } },
          isDirty: true,
        })),

      removeEnvironmentVariable: (key) =>
        set((s) => {
          const rest = Object.fromEntries(
            Object.entries(s.environmentVariables).filter(([k]) => k !== key)
          );
          return { environmentVariables: rest, isDirty: true };
        }),

      setEnvironmentVariables: (vars) => set({ environmentVariables: vars }),
    }),
    {
      name: 'flock-workflow-store',
      // 只持久化活跃 ID，不持久化执行消息（后续用 SQLite）
      partialize: (s) => ({ activeWorkflowId: s.activeWorkflowId }),
    }
  )
);
