import { wsClient } from "@/shared/api";

export const takeOverConversation = (conversationId: string) =>
  wsClient.send("conversation.takeover", { conversationId });
