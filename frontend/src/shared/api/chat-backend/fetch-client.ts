import { CHAT_API } from "@/shared/config";
import type { CbEnvelope, CbEnvelopeSuccess } from "./chat-backend-types";

/** Returned when the server responds with status:"error". */
export class ChatBackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ChatBackendError";
  }
}

type TokenGetter = () => string | null;
type Renewer = () => Promise<string>;

let _getToken: TokenGetter = () => null;
let _renew: Renewer = () => Promise.reject(new Error("No renewer registered"));

/** Called by entities/session to wire up token access and renewal. */
export function configureFetchClient(getToken: TokenGetter, renew: Renewer) {
  _getToken = getToken;
  _renew = renew;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  isRetry = false,
): Promise<CbEnvelopeSuccess<T>> {
  const accessToken = token ?? _getToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${CHAT_API}/agent/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isRetry && path !== "/auth/session") {
    // Try to renew the session once, then retry.
    // Skip renewal for /auth/session itself — a 401 there means the handoff token was
    // rejected; surface the backend error rather than looping infinitely.
    const newToken = await _renew();
    return request<T>(method, path, body, newToken, true);
  }

  const envelope: CbEnvelope<T> = await res.json();
  if (envelope.status === "error") {
    throw new ChatBackendError(envelope.error.code, envelope.error.message, envelope.error.details);
  }
  return envelope;
}

export async function cbGet<T>(path: string): Promise<CbEnvelopeSuccess<T>> {
  return request<T>("GET", path);
}

export async function cbPost<T>(path: string, body: unknown): Promise<CbEnvelopeSuccess<T>> {
  return request<T>("POST", path, body);
}

/** Upload a file (multipart). Returns the raw envelope so the caller can inspect meta. */
export async function cbUpload<T>(formData: FormData): Promise<CbEnvelopeSuccess<T>> {
  const accessToken = _getToken();
  const headers: HeadersInit = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${CHAT_API}/agent/api/v1/chat/attachments`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    const newToken = await _renew();
    headers["Authorization"] = `Bearer ${newToken}`;
    const retryRes = await fetch(`${CHAT_API}/agent/api/v1/chat/attachments`, {
      method: "POST",
      headers,
      body: formData,
    });
    const envelope: CbEnvelope<T> = await retryRes.json();
    if (envelope.status === "error") throw new ChatBackendError(envelope.error.code, envelope.error.message, envelope.error.details);
    return envelope;
  }

  const envelope: CbEnvelope<T> = await res.json();
  if (envelope.status === "error") throw new ChatBackendError(envelope.error.code, envelope.error.message, envelope.error.details);
  return envelope;
}

/** Fetch an attachment blob (needs Bearer). Returns an object URL — caller must revoke it. */
export async function cbFetchAttachmentBlob(attachmentId: string): Promise<string> {
  const accessToken = _getToken();
  const headers: HeadersInit = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${CHAT_API}/agent/api/v1/chat/attachments/${attachmentId}`, { headers });
  if (!res.ok) throw new Error(`Attachment fetch failed (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
