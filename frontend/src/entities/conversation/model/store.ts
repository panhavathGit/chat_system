import { create } from "zustand";
import type { ConversationDto } from "@/shared/api";

export type Conversation = ConversationDto & { archived?: boolean };

type ConversationState = {
  byId: Record<string, Conversation>;
  order: string[];
  selectedId: string | null;
  query: string;
  /** Current page loaded from the inbox REST endpoint (1-based). */
  inboxPage: number;
  /** Total pages available from the last inbox fetch. null = unknown. */
  inboxTotalPages: number | null;
  setAll: (conversations: Conversation[]) => void;
  appendInboxPage: (conversations: Conversation[], page: number, totalPages: number) => void;
  setInboxMeta: (page: number, totalPages: number) => void;
  upsert: (conversation: Conversation) => void;
  select: (id: string) => void;
  setQuery: (query: string) => void;
  markReadLocally: (id: string) => void;
  markUnreadLocally: (id: string) => void;
  assignToMeLocally: (id: string) => void;
  archiveLocally: (id: string) => void;
};

export const useConversationStore = create<ConversationState>((set) => ({
  byId: {},
  order: [],
  selectedId: null,
  query: "",
  inboxPage: 1,
  inboxTotalPages: null,
  setAll: (conversations) =>
    set((state) => {
      const stillExists = conversations.some(({ id }) => id === state.selectedId);
      return {
        byId: Object.fromEntries(conversations.map((conversation) => [conversation.id, conversation])),
        order: conversations.map(({ id }) => id),
        // Keep the current selection if it survives the refresh; otherwise fall back to the first conversation.
        selectedId: stillExists ? state.selectedId : (conversations[0]?.id ?? null),
      };
    }),
  appendInboxPage: (conversations, page, totalPages) =>
    set((state) => {
      const incoming = Object.fromEntries(conversations.map((c) => [c.id, c]));
      const newIds = conversations.map(({ id }) => id).filter((id) => !state.order.includes(id));
      return {
        byId: { ...state.byId, ...incoming },
        order: [...state.order, ...newIds],
        inboxPage: page,
        inboxTotalPages: totalPages,
      };
    }),
  setInboxMeta: (page, totalPages) => set({ inboxPage: page, inboxTotalPages: totalPages }),
  upsert: (conversation) =>
    set((state) => {
      const previous = state.byId[conversation.id];
      // Only move to the top on a new conversation or a new message, not on unread/handoff-only updates.
      const bumped = !previous || previous.lastMessageAt !== conversation.lastMessageAt;
      return {
        byId: { ...state.byId, [conversation.id]: conversation },
        order: bumped ? [conversation.id, ...state.order.filter((id) => id !== conversation.id)] : state.order,
      };
    }),
  select: (id) => set((state) => (state.byId[id] ? { selectedId: id } : state)),
  setQuery: (query) => set({ query }),
  markUnreadLocally: (id) =>
    set((state) => {
      const conversation = state.byId[id];
      if (!conversation) return state;
      return { byId: { ...state.byId, [id]: { ...conversation, unread: Math.max(1, conversation.unread) } } };
    }),
  assignToMeLocally: (id) =>
    set((state) => {
      const conversation = state.byId[id];
      if (!conversation) return state;
      return {
        byId: {
          ...state.byId,
          [id]: {
            ...conversation,
            handoff: "assigned",
            assignedAgent: { id: "local-agent", name: "You", avatar: "", active: true },
          },
        },
      };
    }),
  archiveLocally: (id) =>
    set((state) => {
      const conversation = state.byId[id];
      if (!conversation) return state;
      return {
        byId: { ...state.byId, [id]: { ...conversation, archived: true } },
        selectedId:
          state.selectedId === id
            ? (state.order.find((other) => other !== id && !state.byId[other]?.archived) ?? null)
            : state.selectedId,
      };
    }),
  markReadLocally: (id) =>
    set((state) => {
      const conversation = state.byId[id];
      if (!conversation || conversation.unread === 0) return state;
      return { byId: { ...state.byId, [id]: { ...conversation, unread: 0 } } };
    }),
}));

export const useSelectedConversation = () =>
  useConversationStore((state) => (state.selectedId ? state.byId[state.selectedId] : undefined));
