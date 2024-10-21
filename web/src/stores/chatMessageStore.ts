import { create } from "zustand";

import type { ChatResponse } from "@/client";

interface ChatMessageState {
  messages: ChatResponse[];
  setMessages: (
    update: ChatResponse[] | ((prevMessages: ChatResponse[]) => ChatResponse[]),
  ) => void;
  activeNodeName: string | null;
  setActiveNodeName: (name: string | null) => void;
}

const useChatMessageStore = create<ChatMessageState>((set) => ({
  messages: [],
  setMessages: (update) =>
    set((state) => ({
      messages: typeof update === "function" ? update(state.messages) : update,
    })),
  activeNodeName: null,
  setActiveNodeName: (name) => set({ activeNodeName: name }),
}));

export default useChatMessageStore;
