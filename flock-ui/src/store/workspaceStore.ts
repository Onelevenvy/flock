import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 重新导出类型，以保证其它组件导入路径不被破坏 (Backward Compatibility)
export type { WorkspaceInfo, ConversationInfo } from '../types/workspace';

interface WorkspaceStore {
  activeWorkspaceId: string | null;
  activeConversationId: string | null;
  conversationAssistants: Record<string, string>; // Maps conversationId -> assistantId
  selectedHomeAssistantId: string | null; // Temp field to pass chosen assistant to HomeView
  error: string | null;

  // Actions
  setActiveWorkspace: (id: string | null) => void;
  setActiveConversation: (id: string | null) => void;
  setConversationAssistant: (convId: string, assistantId: string) => void;
  setSelectedHomeAssistantId: (id: string | null) => void;
  setError: (err: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      activeConversationId: null,
      conversationAssistants: {},
      selectedHomeAssistantId: null,
      error: null,

      setActiveWorkspace: (id) =>
        set({ activeWorkspaceId: id, activeConversationId: null }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      setConversationAssistant: (convId, assistantId) =>
        set((state) => ({
          conversationAssistants: {
            ...state.conversationAssistants,
            [convId]: assistantId,
          },
        })),

      setSelectedHomeAssistantId: (id) => set({ selectedHomeAssistantId: id }),

      setError: (err) => set({ error: err }),
    }),
    {
      name: 'flock-workspace-store',
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        activeConversationId: s.activeConversationId,
        conversationAssistants: s.conversationAssistants,
        selectedHomeAssistantId: s.selectedHomeAssistantId,
      }),
    }
  )
);

