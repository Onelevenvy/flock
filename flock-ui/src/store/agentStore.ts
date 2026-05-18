import { create } from 'zustand';
import { useUiStore } from './uiStore';
import { useWorkspaceStore } from './workspaceStore';
import { queryClient } from '../lib/queryClient';
import {
  AgentStatus,
  Capabilities,
  ChatMessage,
  PendingApproval,
  ProtocolEvent,
  ToolRequestChunk,
} from '../types/protocol';

interface AgentStore {
  // 连接状态
  status: AgentStatus;
  capabilities: Capabilities | null;
  workdir: string;
  errorMessage: string | null;

  // 聊天消息列表
  messages: ChatMessage[];

  // 待审批工具调用（队列，按顺序弹出）
  pendingApprovals: PendingApproval[];

  // === Actions ===

  setStatus: (status: AgentStatus) => void;
  setWorkdir: (dir: string) => void;
  setError: (msg: string | null) => void;
  setCapabilities: (caps: Capabilities) => void;

  addUserMessage: (id: string, content: string) => void;

  /** 处理来自 Agent 的原始 ProtocolEvent */
  handleEvent: (event: ProtocolEvent) => void;

  /** 用户批准/拒绝后，从队列移除 */
  removePendingApproval: (call_id: string) => void;

  clearMessages: () => void;
  loadHistory: (workspaceId: string, convId: string) => Promise<void>;
}

import { invoke } from '@tauri-apps/api/core';

export const useAgentStore = create<AgentStore>((set, _get) => ({
  status: 'disconnected',
  capabilities: null,
  workdir: '',
  errorMessage: null,
  messages: [],
  pendingApprovals: [],

  setStatus: (status) => set({ status }),
  setWorkdir: (dir) => set({ workdir: dir }),
  setError: (msg) => set({ errorMessage: msg }),
  setCapabilities: (caps) => set({ capabilities: caps }),

  addUserMessage: (id, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: 'user',
          chunks: [{ kind: 'text', text: content }],
          streaming: false,
          timestamp: Date.now(),
        },
      ],
    })),

  loadHistory: async (workspaceId: string, convId: string) => {
    try {
      const history = await invoke<ChatMessage[]>('load_conversation_history', {
        workspaceId,
        convId,
      });
      // 转换后端时间戳为前端时间戳，并补充 UI 属性
      const formattedHistory = history.map(m => ({
        ...m,
        streaming: false,
        timestamp: m.timestamp === 0 ? Date.now() : m.timestamp,
        chunks: m.chunks.map(c => {
          if (c.kind === 'thinking') {
            return { ...c, collapsed: true };
          }
          return c;
        })
      }));
      set({ messages: formattedHistory, pendingApprovals: [] });
    } catch (e) {
      console.error('Failed to load history:', e);
      set({ messages: [], pendingApprovals: [] });
    }
  },

  handleEvent: (event: ProtocolEvent) => {
    switch (event.type) {
      case 'ready':
        set({ status: 'ready', capabilities: event.capabilities });
        break;

      case 'stream_start':
        // 新建 assistant 消息占位
        set((s) => ({
          status: 'thinking',
          messages: [
            ...s.messages,
            {
              id: event.msg_id,
              role: 'assistant',
              chunks: [],
              streaming: true,
              timestamp: Date.now(),
            },
          ],
        }));
        break;

      case 'text_delta':
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const chunks = [...m.chunks];
            const last = chunks[chunks.length - 1];
            if (last && last.kind === 'text') {
              // 追加到最后一个 text chunk
              chunks[chunks.length - 1] = { kind: 'text', text: last.text + event.text };
            } else {
              chunks.push({ kind: 'text', text: event.text });
            }
            return { ...m, chunks };
          }),
        }));
        break;

      case 'thinking':
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const chunks = [...m.chunks];
            const last = chunks[chunks.length - 1];
            if (last && last.kind === 'thinking') {
              chunks[chunks.length - 1] = {
                kind: 'thinking',
                text: last.text + event.text,
                collapsed: last.collapsed,
              };
            } else {
              chunks.push({ kind: 'thinking', text: event.text, collapsed: false });
            }
            return { ...m, chunks };
          }),
        }));
        break;

      case 'tool_request':
        // 在消息里添加 tool_request chunk（pending 状态）
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const toolChunk: ToolRequestChunk = {
              kind: 'tool_request',
              call_id: event.call_id,
              tool: event.tool,
              status: 'pending',
            };
            return { ...m, chunks: [...m.chunks, toolChunk] };
          }),
          pendingApprovals: [
            ...s.pendingApprovals,
            { call_id: event.call_id, tool: event.tool, msg_id: event.msg_id },
          ],
        }));
        break;

      case 'tool_running':
        set((s) => ({
          messages: s.messages.map((m) => ({
            ...m,
            chunks: m.chunks.map((c) =>
              c.kind === 'tool_request' && c.call_id === event.call_id
                ? { ...c, status: 'running' as const }
                : c
            ),
          })),
        }));
        break;

      case 'tool_result':
        set((s) => ({
          messages: s.messages.map((m) => ({
            ...m,
            chunks: m.chunks.map((c) =>
              c.kind === 'tool_request' && c.call_id === event.call_id
                ? {
                    ...c,
                    status: 'done' as const,
                    result: event.output,
                    result_status: event.status,
                  }
                : c
            ),
          })),
        }));
        if (event.status === 'success') {
          useUiStore.getState().triggerFileTreeRefresh();
        }
        break;

      case 'tool_cancelled':
        set((s) => ({
          messages: s.messages.map((m) => ({
            ...m,
            chunks: m.chunks.map((c) =>
              c.kind === 'tool_request' && c.call_id === event.call_id
                ? { ...c, status: 'cancelled' as const }
                : c
            ),
          })),
          pendingApprovals: s.pendingApprovals.filter((p) => p.call_id !== event.call_id),
        }));
        break;

      case 'stream_end':
        set((s) => ({
          status: 'ready',
          messages: s.messages.map((m) =>
            m.id === event.msg_id
              ? { ...m, streaming: false, usage: event.usage }
              : m
          ),
        }));
        // 一轮对话完成，通知文件树刷新
        setTimeout(() => useUiStore.getState().triggerFileTreeRefresh(), 500);
        break;

      case 'error':
        set({
          status: 'error',
          errorMessage: event.error.message,
        });
        break;

      case 'config_changed':
        set({ capabilities: event.capabilities });
        break;

      case 'title_updated': {
        const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        if (activeWorkspaceId) {
          queryClient.invalidateQueries({ queryKey: ['conversations', activeWorkspaceId] });
        }
        break;
      }

      default:
        break;
    }
  },

  removePendingApproval: (call_id) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((p) => p.call_id !== call_id),
    })),

  clearMessages: () => set({ messages: [], pendingApprovals: [] }),
}));
