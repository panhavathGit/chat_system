# chat_backend integration contract

_Last updated: 2026-11-09. Every example below was captured from the running service._

This is the **only document another repo needs** to connect to chat_backend. It is written for people and coding agents working in `los_backend`, `los_web`, `chat_web` (the staff chat UI) and the Flutter customer app, who cannot see chat_backend's code.

## Start here: what your repo must do

| Your repo | Read | Your job |
| :--- | :--- | :--- |
| **los_backend** | [§2](#2-los_backend-issue-a-chat-handoff-token) | Add one endpoint that issues a 2-minute chat handoff token for staff. |
| **los_web** | [§3](#3-los_web-host-the-chat-iframe) | Embed chat_web in an iframe and pass it the handoff token by postMessage. |
| **chat_web** (staff UI) | [§3](#3-los_web-host-the-chat-iframe), [§5](#5-sessions-and-refresh-tokens-both-apps), [§6](#6-rest-api), [§7](#7-socketio-real-time) | Exchange the handoff for a chat session, then use the staff API (`/agent/api/v1`). |
| **Flutter app** | [§4](#4-flutter-app-customer), [§5](#5-sessions-and-refresh-tokens-both-apps), [§6](#6-rest-api), [§7](#7-socketio-real-time) | Exchange the LOS access token for a chat session, then use the customer API (`/customer/api/v1`). |

---

## 1. How it fits together

chat_backend is a standalone Express + Socket.io + PostgreSQL service. **LOS stays the identity provider**: chat_backend never sees a password. It checks an LOS-signed token **once**, then issues its own chat session.

```
Customer:  Flutter ─ LOS login ─▶ LOS access token
           Flutter ─ POST /customer/api/v1/auth/session { losToken } ─▶ chat session (1 h) + refresh token (24 h)

Staff:     los_web ─ POST los_backend /admin/chat/handoff-token ─▶ handoff token (2 min)
           los_web ─ postMessage ─▶ chat_web (iframe)
           chat_web ─ POST /agent/api/v1/auth/session { handoffToken } ─▶ chat session (15 min) + refresh token (24 h)

Then:      every chat REST call and the Socket.io connection use the chat session token (never an LOS token)
           POST /auth/refresh renews the session without going back to LOS, until the 24 h limit
```

Rules that apply everywhere:
- LOS tokens are accepted **only** by the two `POST …/auth/session` endpoints.
- Customer and staff are separate audiences. A customer token is rejected on `/agent/...`, and a staff token on `/customer/...`.
- LOS keeps customers and staff in separate tables, so a customer and a staff member can share the same LOS `userId`. chat_backend tells them apart by `type`.

**Machine-readable spec:** `backend/openapi.json` in the chat_system repo (OpenAPI 3.1; auth routes so far), or `<CHAT_API>/docs/openapi.json` with Swagger UI at `<CHAT_API>/docs` on non-production servers. Use it to generate typed clients. If it disagrees with this document, tell the chat team.

**Base URL:** `<CHAT_API>`. Local development is `http://localhost:3000`; ask the chat team for the deployed URL. Health check: `GET <CHAT_API>/health` → `200`.

---

## 2. los_backend: issue a chat handoff token

Why: los_web's own LOS token works on all of LOS for up to an hour. The handoff token can only start a chat session and lasts 2 minutes, so the real LOS token never leaves los_web.

The analytics-dashboard iframe already uses this pattern (`generateDashboardHandoffToken` in `src/shared/utils/jwt.util.ts`, route `POST /api/v1/admin/dashboard-embed/handoff-token`). Chat needs the same thing with a different audience:

1. Let the token function take the audience and token type instead of hard-coding `analytics-dashboard` / `dashboard-handoff`.
2. Add `POST /api/v1/admin/chat/handoff-token`:
   - requires a valid **staff** access token (customers get `403`, as on the dashboard endpoint);
   - rate-limited like the dashboard endpoint;
   - empty body; returns `{ "status": "success", "data": { "token": "<jwt>", "expiresAt": "<ISO time>" } }`.
3. Token contents. chat_backend rejects the token if any of these differ:

   | Field | Value |
   | :--- | :--- |
   | header | `{ "alg": "RS256", "typ": "JWT", "kid": "<access key kid>" }`, signed with the access-token private key |
   | `iss` | `los-backend` |
   | `aud` | `chat` |
   | `tokenType` | `chat-handoff` |
   | `type` | `staff` |
   | `userId` | LOS `User.id`, a positive 32-bit integer |
   | `username` | LOS username (string) |
   | `role` | **one** staff role name, e.g. `ADMIN`, `CREDIT_SUPPORT_OFFICER` |
   | `exp` | 2 minutes after `iat` |

No new keys, tables or JWKS changes: chat_backend verifies with the published JWKS.

**Roles:** chat_backend looks `role` up **by name** in its own `roles` table. LOS's `roleId` is ignored, because the ids differ between the two databases. An unknown role name gets `401` at session exchange. Known staff roles today: `CREDIT_SUPPORT_OFFICER`, `CREDIT_SUPPORT_SUPERVISOR`, `CREDIT_ASSESSMENT`, `CREDIT_SUPERVISOR`, `CREDIT_COMMITTEE`, `ACCOUNTANT_AP`, `ACCOUNTANT_AR`, `ACCOUNTANT_SUPERVISOR`, `COLLECTION_OFFICER`, `COLLECTION_SUPERVISOR`, `OPERATION_SUPERVISOR`, `ADMIN`, `SUPER_ADMIN`, `IT_SUPPORT`. **If LOS adds a role, tell the chat team first.** LOS staff can hold several roles, but chat stores the single `role` in the token. Every staff member may currently use all of chat; roles are stored, not yet enforced.

**Customer access tokens need no change.** chat_backend accepts the normal LOS customer access token if it has `iss=los-backend`, `aud=luyleun`, `type=customer`, `tokenType=access`, a valid `userId` and a `username`. Customers carry no `role`; chat assigns its `CUSTOMER` role itself.

---

## 3. los_web: host the chat iframe

A postMessage handshake, the same shape as the analytics-dashboard embed:

```
chat_web (iframe)                        los_web (parent)                          los_backend
      │ ── { type: 'CHAT_READY' } ────────▶ │                                          │
      │                                    │ ── POST /admin/chat/handoff-token ──────▶ │  (Bearer: los_web's own token)
      │                                    │ ◀──────────── { token, expiresAt } ───── │
      │ ◀── { type: 'CHAT_AUTH_HANDOFF',    │                                          │
      │       token } ─────────────────────│                                          │
      │  POST <CHAT_API>/agent/api/v1/auth/session { handoffToken: token }            │
      │  ... chat_web renews its own session with POST /auth/refresh (§5) ...          │
      │ ── { type: 'CHAT_TOKEN_EXPIRING' } ▶│  only when refresh fails (page reload, 24 h limit, revoked):
      │                                    │  los_web repeats the handoff
      │ ◀── { type: 'CHAT_LOGOUT' } ────────│  when the staff member logs out of los_web
```

| Message | From → to | Meaning |
| :--- | :--- | :--- |
| `{ type: 'CHAT_READY' }` | chat_web → los_web | iframe loaded and has no session; please send a handoff |
| `{ type: 'CHAT_AUTH_HANDOFF', token }` | los_web → chat_web | a fresh handoff token |
| `{ type: 'CHAT_TOKEN_EXPIRING' }` | chat_web → los_web | refresh failed; please send a new handoff |
| `{ type: 'CHAT_LOGOUT' }` | los_web → chat_web | staff member logged out of los_web; end the chat login |

Rules:
- Post with the **exact** chat_web origin as `targetOrigin`, never `'*'`. Check `event.origin` on every message, on both sides.
- Never put a token in the iframe URL, because URLs end up in history and logs.
- chat_web keeps its access and refresh tokens **in memory only** (no localStorage, no cookie: cookies in a cross-site iframe are unreliable). A reload loses them, and chat_web sends `CHAT_READY` again.
- **Logout:** chat sessions renew without LOS, so logging out of los_web doesn't end chat by itself. los_web must send `CHAT_LOGOUT`. chat_web then calls `POST /agent/api/v1/auth/logout { refreshToken }` and clears its tokens. Without that, chat keeps working until the 24 h limit.

---

## 4. Flutter app (customer)

1. When the chat screen opens with no stored refresh token: `POST /customer/api/v1/auth/session` with `{ "losToken": "<the LOS access token the app already has>" }`. If the LOS token has expired, refresh it with LOS first.
2. Keep `accessToken` in memory. Send it as `Authorization: Bearer <accessToken>` on every chat call, and as `auth: { token }` for Socket.io.
3. Store `refreshToken` in secure storage (Keychain / Keystore) and renew as described in §5.
4. On app logout, call `POST /customer/api/v1/auth/logout { refreshToken }` and delete it.
5. Load the thread with `GET /customer/api/v1/chat/conversation`, then the history, then listen for `message:new`.

---

## 5. Sessions and refresh tokens (both apps)

`POST /auth/session` (`201`) and `POST /auth/refresh` (`200`) return the same shape:

```json
{
  "status": "success",
  "data": {
    "accessToken": "<jwt>",
    "expiresIn": "15m",
    "user": { "id": "a034f921-3eb0-4ef5-b91e-41a34bbd9afe", "losUserId": 2, "type": "staff", "username": "admin" },
    "refreshToken": "<opaque string>",
    "refreshExpiresAt": "2026-11-10T07:01:36.393Z"
  }
}
```

| Field | Meaning |
| :--- | :--- |
| `accessToken` | Chat session JWT. Customer `1h`, staff `15m` (`expiresIn`). |
| `user.id` | The person's **chat** id (UUID). It appears as `sender.id`, `customerId` and so on. It is not the LOS id. |
| `user.losUserId` | The LOS `userId`. |
| `user.type` | `"customer"` or `"staff"` (lowercase here). |
| `refreshToken` | Opaque, single-use. Treat it like a password. |
| `refreshExpiresAt` | The login ends at this time (24 h after sign-in). Refreshing does **not** move it. |

| Endpoint (under `/customer/api/v1` or `/agent/api/v1`) | Body | Success |
| :--- | :--- | :--- |
| `POST /auth/session` (customer) | `{ "losToken": "…" }` | `201` + session |
| `POST /auth/session` (staff) | `{ "handoffToken": "…" }` | `201` + session |
| `POST /auth/refresh` | `{ "refreshToken": "…" }` | `200` + new session **and new refresh token** |
| `POST /auth/logout` | `{ "refreshToken": "…" }` | `200` `{ "status": "success", "data": null }`, always, even for an unknown token |
| `GET /auth/me` | header `Authorization: Bearer <accessToken>` | `200` `{ "data": { id, losUserId, type, username } }` |

Client rules:
1. On a `401` from any chat call, or shortly before `expiresIn` runs out, call `/auth/refresh`.
2. **Replace the stored refresh token with the new one** every time. Each refresh token works once.
3. **Send one refresh at a time.** Reusing an already-used refresh token is treated as theft: the whole login ends and both copies get `401 "Refresh token has already been used"`. Queue concurrent `401`s behind a single in-flight refresh. If a refresh response was lost, sign in again instead of retrying.
4. If `/auth/refresh` returns `401`, sign in again: Flutter exchanges its LOS token; chat_web sends `CHAT_TOKEN_EXPIRING`.
5. After every refresh, reconnect Socket.io with the new access token (§7).
6. A refresh token only works on its own audience's `/auth/refresh`.

---

## 6. REST API

All bodies are JSON (`Content-Type: application/json`) except uploads. Every route except `/auth/session`, `/auth/refresh` and `/auth/logout` needs `Authorization: Bearer <accessToken>` for its audience.

### Customer (`/customer/api/v1`)

| Method | Path | Body / query | Success |
| :--- | :--- | :--- | :--- |
| GET | `/chat/conversation` | — | `200` Conversation. Creates the customer's one permanent thread on first call. |
| GET | `/chat/conversation/messages` | `?size=1..100` (default 30), `?before=<message id>` | `200` Message[] newest first + `meta: { size, nextCursor }`. Empty list if no thread yet. |
| POST | `/chat/conversation/messages` | SendMessage | `201` Message (creates the thread if needed) |
| POST | `/chat/attachments` | multipart, see Uploads | `201` Attachment |
| GET | `/chat/attachments/:id` | — | `200` file bytes. Only the customer's own conversation. |

### Staff (`/agent/api/v1`)

Every staff member can read and reply to **every** conversation; there is no assignment.

| Method | Path | Body / query | Success |
| :--- | :--- | :--- | :--- |
| GET | `/chat/conversations` | `?page=1..` (default 1), `?size=1..100` (default 20) | `200` StaffConversation[] by latest activity + `meta: { total, page, size, totalPages }`. Customers who never wrote are left out. |
| GET | `/chat/conversations/:id` | — | `200` StaffConversation, or `404` |
| GET | `/chat/conversations/:id/messages` | `?size`, `?before` (as for customers) | `200` Message[] + `meta: { size, nextCursor }` |
| POST | `/chat/conversations/:id/messages` | SendMessage | `201` Message |
| POST | `/chat/attachments` | multipart | `201` Attachment |
| GET | `/chat/attachments/:id` | — | `200` file bytes (any conversation) |

### Data shapes

**Message**:
```json
{
  "id": "26d80e1a-b7ce-4737-8884-ff4e7b38e1f0",
  "conversationId": "358d0a2f-799d-474c-ab15-f02451db3984",
  "type": "FILE",
  "text": "my ID card",
  "clientMessageId": "c-30465",
  "createdAt": "2026-11-09T07:01:36.761Z",
  "sender": { "id": "03442948-f3d3-4ba7-a1af-4894a1ae531d", "username": "012333333", "type": "CUSTOMER" },
  "attachment": { "id": "5aa6e02c-8918-4a84-a385-2483e5286d07", "mimeType": "application/pdf", "sizeBytes": 13, "fileName": "t.pdf", "durationSec": null }
}
```
- `type`: `TEXT` | `VOICE` | `IMAGE` | `FILE`.
- `sender.type`: `"CUSTOMER"` or `"STAFF"` (**uppercase**). Use it to put the bubble on the correct side.
- `text`: required for `TEXT`; an optional caption otherwise; `null` if absent.
- `attachment`: `null` for `TEXT`.

**Conversation** (customer side):
```json
{ "id": "358d0a2f-…", "customerId": "03442948-…", "lastMessageAt": null, "createdAt": "2026-11-09T07:01:36.656Z" }
```

**StaffConversation**: Conversation plus `customer` and `lastMessage` (a Message, or `null`):
```json
{
  "id": "358d0a2f-…", "customerId": "03442948-…", "lastMessageAt": "2026-11-09T07:01:36.761Z", "createdAt": "…",
  "customer": { "id": "03442948-…", "losUserId": 4245, "username": "012333333" },
  "lastMessage": { "...": "Message" }
}
```

**Attachment**: `{ "id", "mimeType", "sizeBytes", "fileName", "durationSec" }`. `durationSec` is set only for voice.

### Sending a message (SendMessage)

```json
{ "clientMessageId": "<unique per message, 1-64 chars>", "type": "TEXT", "text": "Hello" }
{ "clientMessageId": "<…>", "type": "IMAGE", "attachmentId": "<id from upload>", "text": "optional caption" }
```
- `clientMessageId` is generated by the client (a UUID is fine). **Retries are safe:** sending the same `clientMessageId` again returns the original message and notifies no one a second time.
- `text` is 1–4000 characters. `TEXT` needs `text` and no `attachmentId`; the other types need `attachmentId`.
- The attachment must have been uploaded by the same sender and not sent before. `IMAGE` needs an image file and `VOICE` an audio file; `FILE` accepts any allowed file.

### Uploads

`POST /chat/attachments`, `multipart/form-data`:
- `file` (required, exactly one);
- `durationSec` (optional, 1–3600, voice only).

Max size is 20 MB by default. Allowed MIME types (as declared by the client):

| Category | MIME types |
| :--- | :--- |
| Image | `image/jpeg`, `image/png`, `image/heic`, `image/heif`, `image/webp` |
| Voice | `audio/mp4`, `audio/m4a`, `audio/x-m4a`, `audio/aac`, `audio/mpeg` |
| File | `application/pdf`, `application/msword`, Word `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), `application/vnd.ms-excel`, Excel `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |

The flow is: upload → get `attachment.id` → send a message with `attachmentId`.

Downloads send `Content-Type` plus `Content-Disposition`: `inline` for images and audio, `attachment` for documents. Download with the `Authorization` header, for example by fetching to a blob; a plain `<img src>` can't send it. An id the caller may not read returns `404`, not `403`.

### Paging message history

`nextCursor` is the id of the oldest message returned, or `null` when there are no more. To load older messages, call again with `?before=<nextCursor>`. Order is newest first, by insert order rather than timestamp.

### Errors

Every error has the same shape:
```json
{ "status": "error", "error": { "code": "BAD_REQUEST", "message": "Invalid request body", "details": { "text": ["text is required for TEXT messages"] } } }
```

| HTTP | `code` | Typical cause |
| :--- | :--- | :--- |
| 400 | `BAD_REQUEST` | validation failed (`details` maps field → messages), unknown or already-sent `attachmentId` |
| 401 | `UNAUTHORIZED` | missing, expired or wrong-audience token; bad LOS token; unknown role; refresh token used, expired or revoked |
| 403 | `FORBIDDEN` | reserved for permission checks (not used yet) |
| 404 | `NOT_FOUND` | unknown conversation, attachment or route |
| 409 | `CONFLICT` | duplicate resource |
| 413 | `PAYLOAD_TOO_LARGE` | upload over the size limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | file type not in the list above |
| 500 | `INTERNAL_SERVER_ERROR` | unexpected; retry later |

Outside production, a `401` for a bad token includes `details` naming the failed check, for example `{ "reason": "check_failed", "claim": "aud" }`.

---

## 7. Socket.io (real-time)

```js
const socket = io('<CHAT_API>', { auth: { token: accessToken } }); // either audience's chat session token
```
- A bad or expired token is rejected at connect with `Error("Invalid or expired token")`. Refresh (§5), then reconnect.
- An open socket is **not** closed when the access token expires. Reconnect after each refresh anyway, so the next reconnect uses a valid token.
- All writes go through REST. The server joins clients to their rooms automatically; there are no room-join events.

| Event | Direction | Who receives it | Payload |
| :--- | :--- | :--- | :--- |
| `message:new` | server → client | the conversation's customer + **all** staff | a Message (§6). The sender gets its own message too; deduplicate by `id` or `clientMessageId`. |
| `typing` | customer → server | — | `{ "isTyping": true }` |
| `typing` | staff → server | — | `{ "conversationId": "<id>", "isTyping": true }` |
| `typing` | server → client | customer typing → all staff; staff typing → that customer + other staff | `{ "conversationId", "user": { "id", "username", "type": "customer" \| "staff" }, "isTyping" }`. Here `type` is **lowercase**. |

---

## 8. chat_backend configuration (for the chat team)

| Setting | Production value |
| :--- | :--- |
| `LOS_JWKS_URI` | `https://api.los.delightech.asia/api/v1/guest/.well-known/jwks.json` |
| `LOS_ISSUER` | `los-backend` |
| `LOS_CUSTOMER_AUDIENCE` | `luyleun` |
| `LOS_HANDOFF_AUDIENCE` / `LOS_HANDOFF_TOKEN_TYPE` | `chat` / `chat-handoff` |
| `CHAT_CUSTOMER_SESSION_EXPIRES_IN` / `CHAT_STAFF_SESSION_EXPIRES_IN` | `1h` / `15m` |
| `CHAT_REFRESH_EXPIRES_IN` | `24h` |
| `CORS_ORIGIN` | the chat_web origin (comma-separated list). Empty in production means no browser origin is allowed. |

Until §2 ships, development against LOS dev borrows the analytics-dashboard handoff (`LOS_HANDOFF_AUDIENCE=analytics-dashboard`, `LOS_HANDOFF_TOKEN_TYPE=dashboard-handoff`). chat_backend refuses to start with that in production.

---

## 9. Changelog (breaking changes for clients)

- **2026-11-09**
  - Refresh tokens: sessions now also return `refreshToken` and `refreshExpiresAt`; new `POST /auth/refresh` and `POST /auth/logout` (§5).
  - `kind` renamed to `type`: the user object has `type: "customer" | "staff"`.
  - `senderKind` removed from messages: use `sender.type` (`"CUSTOMER" | "STAFF"`).

## 10. Known limits (accepted for now)

- A revoked LOS token (logout, suspension) can still be exchanged until it expires.
- `/auth/refresh` doesn't ask LOS, so a user blocked in LOS keeps chat access until their 24 h limit or until `/auth/logout`. An LOS revocation check can be added to refresh later.
- Roles and permissions are stored but not enforced; every staff member can do everything.
- Upload MIME types are trusted as declared by the client (no content sniffing).
