import { useConversationStore } from "@/entities/conversation";
import { useMessageStore } from "@/entities/message";
import { wsClient } from "@/shared/api";
import { isChatBackend } from "@/shared/config";
import { apiGetMessages, apiGetConversations, mapConversation, mapMessage } from "@/shared/api";

/** Select a conversation and tell the server its unread messages were seen. */
export function selectConversation(id: string) {
  const store = useConversationStore.getState();
  store.select(id);

  if (isChatBackend) {
    // Load message history from REST (newest-first → reverse to oldest-first).
    apiGetMessages(id)
      .then(({ data, meta }) => {
        const messages = data.map(mapMessage).reverse();
        useMessageStore.getState().setHistory(id, messages, meta.nextCursor);
      })
      .catch(() => {});
  } else {
    if (store.byId[id]?.unread) {
      store.markReadLocally(id);
      wsClient.send("conversation.read", { conversationId: id });
    }
  }
}

/** Load the next page of older messages for the open conversation (chat-backend only). */
export async function loadOlderMessages(conversationId: string): Promise<void> {
  const msgStore = useMessageStore.getState();
  const cursor = msgStore.nextCursor[conversationId];
  if (cursor == null) return; // null = exhausted; undefined = cursor not yet known
  const { data, meta } = await apiGetMessages(conversationId, 30, cursor);
  const messages = data.map(mapMessage).reverse();
  useMessageStore.getState().prependMessages(conversationId, messages, meta.nextCursor);
}

/** Load the next page of inbox conversations (chat-backend only). */
export async function loadMoreInbox(): Promise<void> {
  const { inboxPage, inboxTotalPages } = useConversationStore.getState();
  if (inboxTotalPages !== null && inboxPage >= inboxTotalPages) return;
  const nextPage = inboxPage + 1;
  const { data, meta } = await apiGetConversations(nextPage);
  useConversationStore
    .getState()
    .appendInboxPage(data.map(mapConversation), meta.page, meta.totalPages);
}
