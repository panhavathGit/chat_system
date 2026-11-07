import { cbGet, cbPost, cbUpload } from "./fetch-client";
import type {
  CbSession,
  CbConversation,
  CbMessage,
  CbPaginationMeta,
  CbHistoryMeta,
  CbAttachment,
} from "./chat-backend-types";

/** POST /auth/session — exchange handoff token for a chat session. No Bearer needed. */
export async function apiCreateSession(handoffToken: string): Promise<CbSession> {
  const env = await cbPost<CbSession>("/auth/session", { handoffToken });
  return env.data;
}

/** GET /auth/me */
export async function apiGetMe(): Promise<CbSession["user"]> {
  const env = await cbGet<CbSession["user"]>("/auth/me");
  return env.data;
}

/** GET /chat/conversations?page=1&size=20 */
export async function apiGetConversations(
  page = 1,
  size = 20,
): Promise<{ data: CbConversation[]; meta: CbPaginationMeta }> {
  const env = await cbGet<CbConversation[]>(`/chat/conversations?page=${page}&size=${size}`);
  return { data: env.data, meta: env.meta as CbPaginationMeta };
}

/** GET /chat/conversations/:id */
export async function apiGetConversation(id: string): Promise<CbConversation> {
  const env = await cbGet<CbConversation>(`/chat/conversations/${id}`);
  return env.data;
}

/** GET /chat/conversations/:id/messages?size=30&before=<cursor> */
export async function apiGetMessages(
  conversationId: string,
  size = 30,
  before?: string,
): Promise<{ data: CbMessage[]; meta: CbHistoryMeta }> {
  const qs = before ? `size=${size}&before=${before}` : `size=${size}`;
  const env = await cbGet<CbMessage[]>(`/chat/conversations/${conversationId}/messages?${qs}`);
  return { data: env.data, meta: env.meta as CbHistoryMeta };
}

/** POST /chat/conversations/:id/messages */
export async function apiSendMessage(
  conversationId: string,
  payload: { clientMessageId: string; type: string; text?: string; attachmentId?: string },
): Promise<CbMessage> {
  const env = await cbPost<CbMessage>(`/chat/conversations/${conversationId}/messages`, payload);
  return env.data;
}

/** POST /chat/attachments (multipart) */
export async function apiUploadAttachment(file: File, durationSec?: number): Promise<CbAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  if (durationSec !== undefined) formData.append("durationSec", String(durationSec));
  const env = await cbUpload<CbAttachment>(formData);
  return env.data;
}
