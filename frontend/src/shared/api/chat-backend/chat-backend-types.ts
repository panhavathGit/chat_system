/** Raw shapes returned by chat_backend (agent namespace). */

export type CbUserType = "CUSTOMER" | "STAFF";

export type CbAttachment = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  durationSec: number | null;
};

export type CbSender = {
  id: string;
  username: string;
  type: CbUserType;
};

export type CbMessage = {
  id: string;
  conversationId: string;
  type: "TEXT" | "VOICE" | "IMAGE" | "FILE";
  text: string | null;
  clientMessageId: string;
  createdAt: string;
  sender: CbSender;
  attachment: CbAttachment | null;
};

export type CbCustomer = {
  id: string;
  losUserId: number;
  username: string;
};

export type CbConversation = {
  id: string;
  customerId: string;
  lastMessageAt: string;
  createdAt: string;
  customer: CbCustomer;
  lastMessage: CbMessage | null;
};

export type CbSessionUser = {
  id: string;
  losUserId: number;
  type: "staff";
  username: string;
};

export type CbSession = {
  accessToken: string;
  expiresIn: string;
  user: CbSessionUser;
};

export type CbEnvelopeSuccess<T> = { status: "success"; data: T; meta?: unknown };
export type CbEnvelopeError = { status: "error"; error: { code: string; message: string; details?: unknown } };
export type CbEnvelope<T> = CbEnvelopeSuccess<T> | CbEnvelopeError;

export type CbPaginationMeta = { total: number; page: number; size: number; totalPages: number };
export type CbHistoryMeta = { size: number; nextCursor: string | null };
