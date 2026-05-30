import { create } from 'zustand';
import { useUiStore } from './uiStore';
import {
  AgentStatus,
  Capabilities,
  ChatMessage,
  HumanTakeoverInfo,
  PendingApproval,
  ProtocolEvent,
} from '../types/protocol';
import { handleAgentEvent, loadAgentHistory } from './agentEventHandlers';

export interface AgentStore {
  status: AgentStatus;
  capabilities: Capabilities | null;
  workdir: string;
  errorMessage: string | null;
  messages: ChatMessage[];
  pendingApprovals: PendingApproval[];
  humanTakeover: HumanTakeoverInfo | null;
  playbackIndex: number;

  setStatus: (status: AgentStatus) => void;
  setWorkdir: (dir: string) => void;
  setError: (msg: string | null) => void;
  setCapabilities: (caps: Capabilities) => void;
  setPlaybackIndex: (index: number) => void;
  addUserMessage: (id: string, content: string) => void;
  handleEvent: (event: ProtocolEvent) => void;
  removePendingApproval: (call_id: string) => void;
  addPendingApproval: (approval: PendingApproval) => void;
  clearHumanTakeover: () => void;
  clearMessages: () => void;
  loadHistory: (workspaceId: string, convId: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  status: 'disconnected',
  capabilities: null,
  workdir: '',
  errorMessage: null,
  messages: [],
  pendingApprovals: [],
  humanTakeover: null,
  playbackIndex: -1,

  setStatus: (status) => set({ status }),
  setWorkdir: (dir) => set({ workdir: dir }),
  setError: (msg) => set({ errorMessage: msg }),
  setCapabilities: (caps) => set({ capabilities: caps }),
  setPlaybackIndex: (playbackIndex) => set({ playbackIndex }),

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

  handleEvent: (event: ProtocolEvent) => handleAgentEvent(event, get, set),

  loadHistory: (workspaceId: string, convId: string) =>
    loadAgentHistory(workspaceId, convId, set),

  removePendingApproval: (call_id) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((p) => p.call_id !== call_id),
    })),

  addPendingApproval: (approval) =>
    set((s) => ({
      pendingApprovals: [...s.pendingApprovals, approval],
    })),

  clearHumanTakeover: () => set({ humanTakeover: null }),

  clearMessages: () => {
    useUiStore.getState().closeEnvironment();
    set({ messages: [], pendingApprovals: [] });
  },
}));
