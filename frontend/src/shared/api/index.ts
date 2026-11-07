// ── Mock WebSocket transport ─────────────────────────────────────────────────
export { wsClient, isMockTransport, simulateDisconnect } from "./ws/instance";
export { useConnectionStore } from "./ws/connection-store";
export type { SocketStatus } from "./ws/client";
export * from "./ws/protocol";

// ── LOS identity provider ────────────────────────────────────────────────────
export { losLogin, losHandoff, getHandoff } from "./los/index";
export type { LosUser, LosLoginResult } from "./los/index";

// ── chat_backend REST + Socket.io ────────────────────────────────────────────
export { configureFetchClient, cbFetchAttachmentBlob, ChatBackendError } from "./chat-backend/fetch-client";
export {
  apiCreateSession,
  apiGetMe,
  apiGetConversations,
  apiGetConversation,
  apiGetMessages,
  apiSendMessage,
  apiUploadAttachment,
} from "./chat-backend/endpoints";
export { chatSocket } from "./chat-backend/socket";
export { mapConversation, mapMessage } from "./chat-backend/mappers";
export type {
  CbSession,
  CbSessionUser,
  CbConversation,
  CbMessage,
  CbAttachment,
} from "./chat-backend/chat-backend-types";
