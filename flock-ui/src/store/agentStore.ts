import { create } from 'zustand';
import { useUiStore } from './uiStore';
import { useWorkspaceStore } from './workspaceStore';
import {
  AgentStatus,
  Capabilities,
  ChatMessage,
  HumanTakeoverInfo,
  PendingApproval,
  ProtocolEvent,
} from '@/types/protocol';
import { handleAgentEvent, loadAgentHistory } from './agentEventHandlers';

export interface SessionState {
  status: AgentStatus;
  capabilities: Capabilities | null;
  workdir: string;
  errorMessage: string | null;
  messages: ChatMessage[];
  pendingApprovals: PendingApproval[];
  humanTakeover: HumanTakeoverInfo | null;
  playbackIndex: number;
}

export interface AgentStore {
  status: AgentStatus;
  capabilities: Capabilities | null;
  workdir: string;
  errorMessage: string | null;
  messages: ChatMessage[];
  pendingApprovals: PendingApproval[];
  humanTakeover: HumanTakeoverInfo | null;
  playbackIndex: number;

  sessions: Record<string, SessionState>;

  setStatus: (status: AgentStatus, sessionId?: string) => void;
  setWorkdir: (dir: string, sessionId?: string) => void;
  setError: (msg: string | null, sessionId?: string) => void;
  setCapabilities: (caps: Capabilities, sessionId?: string) => void;
  setPlaybackIndex: (index: number, sessionId?: string) => void;
  addUserMessage: (id: string, content: string, attachments?: any[], sessionId?: string) => void;
  handleEvent: (event: ProtocolEvent) => void;
  removePendingApproval: (call_id: string, sessionId?: string) => void;
  addPendingApproval: (approval: PendingApproval, sessionId?: string) => void;
  clearHumanTakeover: (sessionId?: string) => void;
  clearMessages: (sessionId?: string) => void;
  loadHistory: (workspaceId: string, convId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
}

const getActiveSessionId = () => {
  return useWorkspaceStore.getState().activeConversationId || 'default';
};

const getSessionState = (state: any, sessId: string): SessionState => {
  return state.sessions[sessId] || {
    status: 'disconnected',
    capabilities: null,
    workdir: '',
    errorMessage: null,
    messages: [],
    pendingApprovals: [],
    humanTakeover: null,
    playbackIndex: -1,
  };
};

export const useAgentStore = create<AgentStore>((set, get) => {
  const updateSessionState = (
    sessId: string,
    updater: Partial<SessionState> | ((prev: SessionState) => Partial<SessionState>)
  ) => {
    set((state: any) => {
      const prevSession = getSessionState(state, sessId);
      const partialUpdate = typeof updater === 'function' ? updater(prevSession) : updater;
      const updatedSession = { ...prevSession, ...partialUpdate };
      const nextSessions = { ...state.sessions, [sessId]: updatedSession };
      
      const currentActiveId = getActiveSessionId();
      if (sessId === currentActiveId) {
        return {
          sessions: nextSessions,
          status: updatedSession.status,
          capabilities: updatedSession.capabilities,
          workdir: updatedSession.workdir,
          errorMessage: updatedSession.errorMessage,
          messages: updatedSession.messages,
          pendingApprovals: updatedSession.pendingApprovals,
          humanTakeover: updatedSession.humanTakeover,
          playbackIndex: updatedSession.playbackIndex,
        };
      } else {
        return {
          sessions: nextSessions,
        };
      }
    });
  };

  return {
    status: 'disconnected',
    capabilities: null,
    workdir: '',
    errorMessage: null,
    messages: [],
    pendingApprovals: [],
    humanTakeover: null,
    playbackIndex: -1,

    sessions: {},

    setStatus: (status, sessionId) => updateSessionState(sessionId || getActiveSessionId(), { status }),
    setWorkdir: (dir, sessionId) => updateSessionState(sessionId || getActiveSessionId(), { workdir: dir }),
    setError: (msg, sessionId) => updateSessionState(sessionId || getActiveSessionId(), { errorMessage: msg }),
    setCapabilities: (caps, sessionId) => updateSessionState(sessionId || getActiveSessionId(), { capabilities: caps }),
    setPlaybackIndex: (playbackIndex, sessionId) => updateSessionState(sessionId || getActiveSessionId(), { playbackIndex }),

    addUserMessage: (id, content, attachments, sessionId) => {
      const targetSessionId = sessionId || getActiveSessionId();
      const chunks: any[] = [{ kind: 'text', text: content }];
      if (attachments && attachments.length > 0) {
        attachments.forEach((att: any) => {
          if (att.kind === 'image' && att.data_base64) {
            chunks.push({ kind: 'image', text: att.data_base64 });
          }
        });
      }
      updateSessionState(targetSessionId, (prev) => ({
        messages: [
          ...prev.messages,
          {
            id,
            role: 'user',
            chunks,
            streaming: false,
            timestamp: Date.now(),
          },
        ],
      }));
    },

    handleEvent: (event: ProtocolEvent) => {
      const eventSessionId = (event as any).session_id || getActiveSessionId();

      const customGet = () => {
        const state = get();
        const session = getSessionState(state, eventSessionId);
        return {
          ...state,
          ...session,
        };
      };

      const customSet = (updater: any) => {
        set((state: any) => {
          const prevSession = getSessionState(state, eventSessionId);
          const update = typeof updater === 'function' ? updater({ ...state, ...prevSession }) : updater;
          
          const sessionKeys = ['status', 'capabilities', 'workdir', 'errorMessage', 'messages', 'pendingApprovals', 'humanTakeover', 'playbackIndex'];
          const sessionUpdate: any = {};
          const globalUpdate: any = {};
          
          for (const key of Object.keys(update)) {
            if (sessionKeys.includes(key)) {
              sessionUpdate[key] = update[key];
            } else {
              globalUpdate[key] = update[key];
            }
          }
          
          const updatedSession = { ...prevSession, ...sessionUpdate };
          const nextSessions = { ...state.sessions, [eventSessionId]: updatedSession };
          const currentActiveId = getActiveSessionId();

          if (eventSessionId === currentActiveId) {
            return {
              ...globalUpdate,
              sessions: nextSessions,
              status: updatedSession.status,
              capabilities: updatedSession.capabilities,
              workdir: updatedSession.workdir,
              errorMessage: updatedSession.errorMessage,
              messages: updatedSession.messages,
              pendingApprovals: updatedSession.pendingApprovals,
              humanTakeover: updatedSession.humanTakeover,
              playbackIndex: updatedSession.playbackIndex,
            };
          } else {
            return {
              ...globalUpdate,
              sessions: nextSessions,
            };
          }
        });
      };

      handleAgentEvent(event, customGet, customSet);
    },

    loadHistory: async (workspaceId: string, convId: string) => {
      get().switchSession(convId);

      const session = getSessionState(get(), convId);
      if (session && (session.status === 'thinking' || session.status === 'connecting')) {
        console.warn('[loadHistory] Session is active/running, skipping DB history load to prevent overwrite:', convId);
        return;
      }

      const customSet = (updater: any) => {
        set((state: any) => {
          const prevSession = getSessionState(state, convId);
          const update = typeof updater === 'function' ? updater({ ...state, ...prevSession }) : updater;
          
          const sessionKeys = ['status', 'capabilities', 'workdir', 'errorMessage', 'messages', 'pendingApprovals', 'humanTakeover', 'playbackIndex'];
          const sessionUpdate: any = {};
          const globalUpdate: any = {};
          
          for (const key of Object.keys(update)) {
            if (sessionKeys.includes(key)) {
              sessionUpdate[key] = update[key];
            } else {
              globalUpdate[key] = update[key];
            }
          }
          
          const updatedSession = { ...prevSession, ...sessionUpdate };
          const nextSessions = { ...state.sessions, [convId]: updatedSession };
          const currentActiveId = getActiveSessionId();
          
          if (convId === currentActiveId) {
            return {
              ...globalUpdate,
              sessions: nextSessions,
              status: updatedSession.status,
              capabilities: updatedSession.capabilities,
              workdir: updatedSession.workdir,
              errorMessage: updatedSession.errorMessage,
              messages: updatedSession.messages,
              pendingApprovals: updatedSession.pendingApprovals,
              humanTakeover: updatedSession.humanTakeover,
              playbackIndex: updatedSession.playbackIndex,
            };
          } else {
            return {
              ...globalUpdate,
              sessions: nextSessions,
            };
          }
        });
      };

      await loadAgentHistory(workspaceId, convId, customSet);
    },

    removePendingApproval: (call_id, sessionId) => {
      const targetSessionId = sessionId || getActiveSessionId();
      updateSessionState(targetSessionId, (prev) => ({
        pendingApprovals: prev.pendingApprovals.filter((p) => p.call_id !== call_id),
      }));
    },

    addPendingApproval: (approval, sessionId) => {
      const targetSessionId = sessionId || getActiveSessionId();
      updateSessionState(targetSessionId, (prev) => ({
        pendingApprovals: [...prev.pendingApprovals, approval],
      }));
    },

    clearHumanTakeover: (sessionId) => {
      updateSessionState(sessionId || getActiveSessionId(), { humanTakeover: null });
    },

    clearMessages: (sessionId) => {
      useUiStore.getState().closeEnvironment();
      updateSessionState(sessionId || getActiveSessionId(), { messages: [], pendingApprovals: [] });
    },

    switchSession: (sessionId) => {
      set((state: any) => {
        const session = getSessionState(state, sessionId);
        return {
          status: session.status,
          capabilities: session.capabilities,
          workdir: session.workdir,
          errorMessage: session.errorMessage,
          messages: session.messages,
          pendingApprovals: session.pendingApprovals,
          humanTakeover: session.humanTakeover,
          playbackIndex: session.playbackIndex,
        };
      });
    }
  };
});

