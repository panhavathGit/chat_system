import { create } from "zustand";
import type { ChatMessageDto, DeliveryStatus, MessageSide } from "@/shared/api";

export type ChatMessage = ChatMessageDto;

type MessageState = {
  byConversation: Record<string, ChatMessage[]>;
  typing: Record<string, MessageSide | undefined>;
  /** null = no older messages; undefined = unknown (not yet fetched). */
  nextCursor: Record<string, string | null | undefined>;
  replaceAll: (messages: Record<string, ChatMessage[]>) => void;
  upsert: (message: ChatMessage) => void;
  setStatus: (conversationId: string, messageId: string, status: DeliveryStatus) => void;
  setTyping: (conversationId: string, side: MessageSide, active: boolean) => void;
  /** Replace history for one conversation (chat-backend: initial load, newest-first reversed to oldest-first). */
  setHistory: (conversationId: string, messages: ChatMessage[], nextCursor: string | null) => void;
  /** Prepend older messages (chat-backend: "load more" pages). */
  prependMessages: (conversationId: string, messages: ChatMessage[], nextCursor: string | null) => void;
};

const EMPTY: ChatMessage[] = [];

export const useMessageStore = create<MessageState>((set) => ({
  byConversation: {},
  typing: {},
  nextCursor: {},

  // Keep optimistic messages the server has not acknowledged yet.
  replaceAll: (incoming) =>
    set((state) => {
      const merged = { ...incoming };
      for (const [conversationId, local] of Object.entries(state.byConversation)) {
        const known = new Set((incoming[conversationId] ?? []).map((message) => message.id));
        const pending = local.filter((message) => message.status === "sending" && !known.has(message.id));
        if (pending.length) merged[conversationId] = [...(merged[conversationId] ?? []), ...pending];
      }
      return { byConversation: merged };
    }),

  upsert: (message) =>
    set((state) => {
      const list = state.byConversation[message.conversationId] ?? EMPTY;
      // Dedup by real id first, then by clientMessageId (replaces the optimistic placeholder).
      const index = list.findIndex(
        (item) =>
          item.id === message.id ||
          (message.clientMessageId != null && item.id === message.clientMessageId),
      );
      const next = index === -1 ? [...list, message] : list.map((item, i) => (i === index ? message : item));
      return {
        byConversation: { ...state.byConversation, [message.conversationId]: next },
      };
    }),

  setStatus: (conversationId, messageId, status) =>
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: (state.byConversation[conversationId] ?? EMPTY).map((message) =>
          message.id === messageId ? { ...message, status } : message,
        ),
      },
    })),

  setTyping: (conversationId, side, active) =>
    set((state) => ({
      typing: { ...state.typing, [conversationId]: active ? side : undefined },
    })),

  setHistory: (conversationId, messages, nextCursor) =>
    set((state) => {
      // Preserve any in-flight optimistic messages not yet echoed back.
      const existing = state.byConversation[conversationId] ?? EMPTY;
      const inFlight = existing.filter((m) => m.status === "sending");
      const knownIds = new Set(messages.map((m) => m.id));
      const toAppend = inFlight.filter((m) => !knownIds.has(m.id));
      return {
        byConversation: { ...state.byConversation, [conversationId]: [...messages, ...toAppend] },
        nextCursor: { ...state.nextCursor, [conversationId]: nextCursor },
      };
    }),

  prependMessages: (conversationId, messages, nextCursor) =>
    set((state) => {
      const existing = state.byConversation[conversationId] ?? EMPTY;
      const knownIds = new Set(existing.map((m) => m.id));
      const fresh = messages.filter((m) => !knownIds.has(m.id));
      return {
        byConversation: { ...state.byConversation, [conversationId]: [...fresh, ...existing] },
        nextCursor: { ...state.nextCursor, [conversationId]: nextCursor },
      };
    }),
}));

export const useConversationMessages = (conversationId: string | null) =>
  useMessageStore((state) => (conversationId ? (state.byConversation[conversationId] ?? EMPTY) : EMPTY));

export const useHasOlderMessages = (conversationId: string | null) =>
  useMessageStore((state) =>
    conversationId ? state.nextCursor[conversationId] != null : false,
  );
