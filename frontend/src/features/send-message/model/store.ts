import { create } from "zustand";
import { wsClient } from "@/shared/api";
import { useMessageStore } from "@/entities/message";
import { isChatBackend } from "@/shared/config";
import { apiSendMessage, mapMessage } from "@/shared/api";

type ComposerState = {
  drafts: Record<string, string>;
  attachments: Record<string, string>;
  recording: boolean;
  setDraft: (conversationId: string, text: string) => void;
  setAttachment: (conversationId: string, name: string) => void;
  toggleRecording: () => void;
};

export const useComposerStore = create<ComposerState>((set) => ({
  drafts: {},
  attachments: {},
  recording: false,
  setDraft: (conversationId, text) => set((state) => ({ drafts: { ...state.drafts, [conversationId]: text } })),
  setAttachment: (conversationId, name) =>
    set((state) => ({ attachments: { ...state.attachments, [conversationId]: name } })),
  toggleRecording: () => set((state) => ({ recording: !state.recording })),
}));

export const useAttachment = (conversationId: string) =>
  useComposerStore((state) => state.attachments[conversationId] ?? "");

export const useDraft = (conversationId: string) => useComposerStore((state) => state.drafts[conversationId] ?? "");

/** Re-sends a message that failed, reusing its clientMessageId so the server deduplicates it. */
export function retryMessage(conversationId: string, messageId: string) {
  const messages = useMessageStore.getState();
  const failed = messages.byConversation[conversationId]?.find((m) => m.id === messageId && m.status === "failed");
  if (!failed) return false;
  messages.setStatus(conversationId, messageId, "sending");

  if (isChatBackend) {
    apiSendMessage(conversationId, { clientMessageId: messageId, type: "TEXT", text: failed.text })
      .then((serverMsg) => {
        useMessageStore.getState().upsert(mapMessage(serverMsg));
      })
      .catch(() => {
        messages.setStatus(conversationId, messageId, "failed");
      });
  } else {
    wsClient.send("message.send", { conversationId, clientId: messageId, text: failed.text });
  }
  return true;
}

/** Optimistically appends the message, then sends via REST (chat-backend) or socket (mock). */
export function sendMessage(conversationId: string, rawText: string) {
  const text = rawText.trim();
  if (!text) return false;
  const clientId = crypto.randomUUID();

  useMessageStore.getState().upsert({
    id: clientId,
    conversationId,
    side: "agent",
    text,
    createdAt: new Date().toISOString(),
    status: "sending",
    clientMessageId: clientId,
  });

  if (isChatBackend) {
    apiSendMessage(conversationId, { clientMessageId: clientId, type: "TEXT", text })
      .then((serverMsg) => {
        // Replace the optimistic message with the server-confirmed copy.
        // The socket echo will also call upsert; clientMessageId dedup handles both — only one entry.
        useMessageStore.getState().upsert(mapMessage(serverMsg));
      })
      .catch(() => {
        useMessageStore.getState().setStatus(conversationId, clientId, "failed");
      });
  } else {
    wsClient.send("message.send", { conversationId, clientId, text });
  }

  const composer = useComposerStore.getState();
  composer.setDraft(conversationId, "");
  composer.setAttachment(conversationId, "");
  return true;
}
