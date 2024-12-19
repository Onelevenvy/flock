// store.ts
import { create } from "zustand";
import { persist } from 'zustand/middleware';

interface ChatTeamIdStore {
  teamId: number;
  setTeamId: (teamId: number) => void;
}

const useChatTeamIdStore = create<ChatTeamIdStore>()(
  persist(
    (set) => ({
      teamId: 1,
      setTeamId: (teamId) => set(() => ({ teamId })),
    }),
    {
      name: 'chat-team-id',
    }
  )
);

export default useChatTeamIdStore;
