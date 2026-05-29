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
  // 执行状态
  executionStatus: 'idle' | 'running' | 'done' | 'error';
  executionMessages: WorkflowExecutionMessage[];
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
  // 当前等待用户回复的打断事件数据
  activeInterrupt: any | null;
  // 从主页跳转启动的待执行初始 Query
  pendingStartQuery: string | null;

  // Actions
  setActiveWorkflowId: (id: string | null) => void;
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setDirty: (dirty: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  loadWorkflowConfig: (config: WorkflowConfig) => void;
  clearExecution: () => void;
  appendExecutionMessage: (msg: WorkflowExecutionMessage) => void;
  setExecutionStatus: (status: 'idle' | 'running' | 'done' | 'error') => void;
  updateNodeData: (nodeId: string, key: string, value: unknown) => void;
  setActiveExecutionThreadId: (id: string | null) => void;
  setDebugTarget: (target: { nodeId: string } | null) => void;
  setDebugResult: (nodeId: string, result: WorkflowStore['debugResults'][string]) => void;
  setEnvironmentVariable: (key: string, value: string, type: EnvVar['type']) => void;
  removeEnvironmentVariable: (key: string) => void;
  setEnvironmentVariables: (vars: Record<string, EnvVar>) => void;
  setActiveInterrupt: (interrupt: any | null) => void;
  setPendingStartQuery: (q: string | null) => void;
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set) => ({
      activeWorkflowId: null,
      nodes: [],
      edges: [],
      isDirty: false,
      executionStatus: 'idle',
      executionMessages: [],
      activeExecutionThreadId: null,
      selectedNodeId: null,
      debugTarget: null,
      debugResults: {},
      environmentVariables: {},
      activeInterrupt: null,
      pendingStartQuery: null,

      setActiveWorkflowId: (id) => set({ activeWorkflowId: id }),
      setActiveInterrupt: (interrupt) => set({ activeInterrupt: interrupt }),
      setPendingStartQuery: (q) => set({ pendingStartQuery: q }),
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
              if (!n2) {
                hasChanged = true;
                break;
              }
              if (n1.position.x !== n2.position.x || n1.position.y !== n2.position.y) {
                hasChanged = true;
                break;
              }
              if (JSON.stringify(n1.data) !== JSON.stringify(n2.data)) {
                hasChanged = true;
                break;
              }
            }
          }
          return {
            nodes: nextNodes,
            isDirty: s.isDirty || hasChanged,
          };
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
              if (!e2) {
                hasChanged = true;
                break;
              }
              if (
                e1.source !== e2.source ||
                e1.target !== e2.target ||
                e1.sourceHandle !== e2.sourceHandle ||
                e1.targetHandle !== e2.targetHandle
              ) {
                hasChanged = true;
                break;
              }
            }
          }
          return {
            edges: nextEdges,
            isDirty: s.isDirty || hasChanged,
          };
        }),

      setDirty: (dirty) => set({ isDirty: dirty }),

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      setDebugTarget: (target) => set({ debugTarget: target }),

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

      clearExecution: () =>
        set({ executionMessages: [], executionStatus: 'idle', activeExecutionThreadId: null, activeInterrupt: null }),

      appendExecutionMessage: (msg) =>
        set((s) => ({
          executionMessages: [...s.executionMessages, msg],
        })),

      setExecutionStatus: (status) => set({ executionStatus: status }),

      updateNodeData: (nodeId, key, value) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, [key]: value } }
              : n
          ),
          isDirty: true,
        })),

      setActiveExecutionThreadId: (id) => set({ activeExecutionThreadId: id }),

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
      // 只持久化活跃 ID，节点/边不持久化（从 DB 加载）
      partialize: (s) => ({ activeWorkflowId: s.activeWorkflowId }),
    }
  )
);
