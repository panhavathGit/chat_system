import { useConversationStore } from "@/entities/conversation";
import { useMessageStore } from "@/entities/message";
import { wsClient } from "@/shared/api";
import { useMessageSettingsStore } from "@/features/message-settings";
import { notify } from "@/shared/ui";
import { isChatBackend } from "@/shared/config";
import {
  chatSocket,
  apiGetConversations,
  apiGetMessages,
  mapConversation,
  mapMessage,
  type CbMessage,
} from "@/shared/api";
import { useSessionStore } from "@/entities/session";

/** Routes server events into the entity stores. Returns a teardown function. */
export function startRealtime() {
  if (isChatBackend) {
    return startRealtimeChatBackend();
  }
  return startRealtimeMock();
}

// ─── Mock transport (unchanged behaviour) ────────────────────────────────────

function startRealtimeMock() {
  let audio: AudioContext | undefined;
  const playTypingSound = () => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      audio ??= new AudioContext();
      if (audio.state !== "running") return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.08);
    } catch {
      /* Sound is optional when the browser restricts audio. */
    }
  };
  const unlockAudio = () => {
    if (!useMessageSettingsStore.getState().values.typingSound || !window.AudioContext) return;
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  };
  if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockAudio);
  const conversations = useConversationStore;
  const messages = useMessageStore;

  const offs = [
    wsClient.onStatus((status) => status === "open" && wsClient.send("sync.request", {})),
    wsClient.on("sync", (payload) => {
      conversations.getState().setAll(payload.conversations);
      messages.getState().replaceAll(payload.messages);
    }),
    wsClient.on("message.new", ({ message }) => messages.getState().upsert(message)),
    wsClient.on("message.ack", ({ message }) => messages.getState().upsert(message)),
    wsClient.on("message.status", ({ conversationId, messageId, status }) =>
      messages.getState().setStatus(conversationId, messageId, status),
    ),
    wsClient.on("typing", ({ conversationId, side, active }) => {
      const wasTyping = messages.getState().typing[conversationId] === side;
      messages.getState().setTyping(conversationId, side, active);
      if (
        active &&
        !wasTyping &&
        side === "customer" &&
        conversations.getState().selectedId === conversationId &&
        useMessageSettingsStore.getState().values.typingSound
      )
        playTypingSound();
    }),
    wsClient.on("conversation.updated", ({ conversation }) => {
      const store = conversations.getState();
      const isNew = !store.byId[conversation.id];
      const preferences = useMessageSettingsStore.getState().values;
      if (isNew && preferences.conversationAlerts) notify(`New conversation from ${conversation.name}`);
      if (isNew && preferences.autoAssign && conversation.handoff !== "assigned") {
        conversation = {
          ...conversation,
          handoff: "assigned",
          assignedAgent: { id: "local-agent", name: "You", avatar: "", active: true },
        };
      }
      const viewing = store.selectedId === conversation.id && conversation.unread > 0;
      store.upsert(viewing ? { ...conversation, unread: 0 } : conversation);
      if (viewing) wsClient.send("conversation.read", { conversationId: conversation.id });
    }),
    wsClient.on("conversation.assigned", ({ conversationId, agent }) => {
      const store = conversations.getState();
      const conversation = store.byId[conversationId];
      if (!conversation) return;
      store.upsert({ ...conversation, handoff: "assigned", assignedAgent: agent });
      notify(`Conversation assigned to ${agent.name}`);
    }),
    wsClient.on("notice", ({ text }) => notify(text)),
  ];

  wsClient.connect();
  return () => {
    if (typeof window !== "undefined") window.removeEventListener("pointerdown", unlockAudio);
    if (audio) void audio.close().catch(() => {});
    offs.forEach((off) => off());
    wsClient.disconnect();
  };
}

// ─── chat-backend transport ───────────────────────────────────────────────────

function startRealtimeChatBackend() {
  let audio: AudioContext | undefined;
  const playTypingSound = () => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      audio ??= new AudioContext();
      if (audio.state !== "running") return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.08);
    } catch {
      /* optional */
    }
  };
  const unlockAudio = () => {
    if (!useMessageSettingsStore.getState().values.typingSound || !window.AudioContext) return;
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  };
  if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockAudio);

  /** Reload the full inbox (page 1) and history for the currently open conversation. */
  async function reloadInboxAndHistory() {
    const { data, meta } = await apiGetConversations();
    const convStore = useConversationStore.getState();
    convStore.setAll(data.map(mapConversation));
    convStore.setInboxMeta(meta.page, meta.totalPages);

    const selectedId = useConversationStore.getState().selectedId;
    if (selectedId) {
      const { data: msgs, meta: msgMeta } = await apiGetMessages(selectedId);
      const messages = msgs.map(mapMessage).reverse();
      useMessageStore.getState().setHistory(selectedId, messages, msgMeta.nextCursor);
    }
  }

  // Load inbox + history for the auto-selected conversation on startup
  reloadInboxAndHistory().catch(() => {});

  // Connect Socket.io once after sign-in
  const { accessToken } = useSessionStore.getState();
  if (accessToken) chatSocket.connect(accessToken);

  const offs: Array<() => void> = [];

  // Reconnect handler: on the first connect do nothing extra (inbox already loaded above);
  // on subsequent reconnects reload the inbox and open conversation's latest page.
  let everConnected = false;
  offs.push(
    chatSocket.on("connect", () => {
      if (!everConnected) {
        everConnected = true;
        return;
      }
      reloadInboxAndHistory().catch(() => {});
    }),
  );

  // message:new — dedup by clientMessageId, update inbox
  offs.push(
    chatSocket.on<CbMessage>("message:new", (raw) => {
      const message = mapMessage(raw);
      useMessageStore.getState().upsert(message);

      const convStore = useConversationStore.getState();
      const existing = convStore.byId[message.conversationId];
      if (existing) {
        convStore.upsert({
          ...existing,
          lastMessageAt: message.createdAt,
          preview: message.text || (raw.attachment ? raw.attachment.fileName : ""),
        });
      } else {
        // Brand-new conversation: refresh inbox
        apiGetConversations()
          .then(({ data, meta }) => {
            convStore.setAll(data.map(mapConversation));
            convStore.setInboxMeta(meta.page, meta.totalPages);
          })
          .catch(() => {});
      }
    }),
  );

  // typing — customer → staff direction only
  offs.push(
    chatSocket.on<{
      conversationId: string;
      user: { id: string; username: string; kind: string };
      isTyping: boolean;
    }>("typing", ({ conversationId, user, isTyping }) => {
      if (user.kind !== "CUSTOMER") return;
      const wasTyping = useMessageStore.getState().typing[conversationId] === "customer";
      useMessageStore.getState().setTyping(conversationId, "customer", isTyping);
      if (
        isTyping &&
        !wasTyping &&
        useConversationStore.getState().selectedId === conversationId &&
        useMessageSettingsStore.getState().values.typingSound
      )
        playTypingSound();
    }),
  );

  return () => {
    if (typeof window !== "undefined") window.removeEventListener("pointerdown", unlockAudio);
    if (audio) void audio.close().catch(() => {});
    offs.forEach((off) => off());
    chatSocket.disconnect();
  };
}
