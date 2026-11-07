# Handoff: connect chat_frontend (los_chat_web) to chat_backend

Written 2026-11-06 by the chat_backend session for the agent building this frontend. chat_backend is built and tested against real LOS dev logins. This document is everything you need to call it. **Do not change chat_backend, los_web or los_backend.** If the contract below doesn't cover something you need, stop and ask; the backend session will change the API.

Human-readable version with diagrams: https://claude.ai/artifact/T4GshQpu3C1sxxvxmHgPgP (the "Chat Backend Guide").

---

## 1. What we are building now (step 1)

Plain customer ↔ staff chat:

1. A customer (Flutter app) sends a message.
2. **Every LOS staff member** sees every conversation and all its messages.
3. **Any staff member replies.** There is no assignment, takeover, queue, AI assistant or ticket in step 1.

This frontend is the staff side. It already has a polished UI built against an in-browser mock (`src/shared/api/ws/mock`). The job is to make it talk to chat_backend, keeping the UI, and to hide what step 1 doesn't support.

### Out of scope for step 1 (hide or stub, don't delete)

AI assistant replies and escalation, take over, assign/release, `handoff` states, unread counts and read receipts, delivery status beyond "sent", callback requests, notifications, the applications/loan workspace and the customer context panel's LOS data (name, salary, national id, applications). Put them behind a feature flag (e.g. `shared/config` → `features.step2 = false`) so they can come back.

---

## 2. Constraints

- **Don't touch los_web.** Staff can't come from los_web yet, so this app runs **standalone** during development, with its own sign-in screen (section 3). Embedding inside los_web comes later and only swaps how the handoff token is obtained.
- **The staff password goes only to LOS**, never to chat_backend. Keep all tokens **in memory** (a zustand store), never in `localStorage` or `sessionStorage`.
- Follow this repo's **Feature-Sliced Design** rules (`app → pages → widgets → features → entities → shared`, imports through each slice's `index.ts`) and run `pnpm check` before finishing.
- Keep the mock transport working (`VITE_TRANSPORT=mock`) so UI work can continue offline.

---

## 3. Sign in: "Sign in with LOS"

LOS is the identity provider. chat_backend never sees passwords: it verifies a token signed by LOS, finds or creates the person's chat account, and returns **its own session token**. Every chat request and the socket use that session. LOS tokens are only accepted by `/auth/session`.

### Standalone mode (build this now)

A sign-in screen with LOS staff **username** and **password**, then three calls in a row:

```
1. POST {LOS_API}/admin/auth/login
     body { "username": "...", "password": "..." }
     → 200 { "data": { "accessToken": "<LOS staff token>", "user": { "id", "username", "type", "role", "fullName" } } }

2. POST {LOS_API}/admin/dashboard-embed/handoff-token
     header Authorization: Bearer <LOS staff token>
     body {}
     → 200 { "data": { "token": "<handoff token>", "expiresAt": "<ISO, ~2 min>" } }

3. POST {CHAT_API}/agent/api/v1/auth/session
     body { "handoffToken": "<handoff token>" }
     → 201 { "data": { "accessToken": "<chat session>", "expiresIn": "15m",
                        "user": { "id", "losUserId", "kind": "staff", "username" } } }
```

- Run 2 and 3 back to back; the handoff is valid for 2 minutes and is used once.
- Keep the LOS staff token in memory only to get new handoffs. Never send it to chat_backend.
- **Renewal:** about 60 seconds before the 15-minute chat session expires, and on any `401` from chat_backend, repeat steps 2 and 3, then reconnect the socket with the new session. If step 2 fails (LOS token expired, after about 1 h), send the user back to the sign-in screen.
- The handoff path is a config value: today `/admin/dashboard-embed/handoff-token`; later `/admin/chat/handoff-token` once LOS adds a chat-specific one.

### Embedded mode (later, don't build yet, but keep the seam)

Inside los_web, the handoff arrives by `postMessage` instead of steps 1–2:

```js
window.parent.postMessage({ type: 'CHAT_READY' }, LOS_WEB_ORIGIN);
window.addEventListener('message', (e) => {
  if (e.origin !== LOS_WEB_ORIGIN) return;
  if (e.data?.type === 'CHAT_AUTH_HANDOFF') exchange(e.data.token); // step 3
});
// renewal: window.parent.postMessage({ type: 'CHAT_TOKEN_EXPIRING' }, LOS_WEB_ORIGIN)
```

Design the session code so the "where does the handoff come from" part is one swappable function (`getHandoff(): Promise<string>`), selected by `VITE_AUTH_MODE=standalone|embedded`. Everything from step 3 on is shared.

---

## 4. chat_backend API (staff namespace)

Base: `{CHAT_API}/agent/api/v1`. Every route except `/auth/session` needs `Authorization: Bearer <chat session>`.

| Method | Path | Use |
| :--- | :--- | :--- |
| POST | `/auth/session` | handoff → chat session (section 3) |
| GET | `/auth/me` | `{ id, losUserId, kind: 'staff', username }` |
| GET | `/chat/conversations?page=1&size=20` | Inbox: every conversation with at least one message, latest activity first |
| GET | `/chat/conversations/:id` | One conversation (same row shape as the inbox) |
| GET | `/chat/conversations/:id/messages?size=30&before=<messageId>` | History, **newest first**, cursor paging |
| POST | `/chat/conversations/:id/messages` | Reply. Any staff member, no assignment needed |
| POST | `/chat/attachments` | Upload a file (multipart, field `file`; `durationSec` for voice) |
| GET | `/chat/attachments/:id` | Download (needs the Bearer header) |

### Shapes

```jsonc
// Inbox row (GET /chat/conversations → data[])
{
  "id": "70e766d1-07b2-4487-ba51-df32d61e10a9",
  "customerId": "f560cbed-f677-468a-99b8-a9f1cdcb122c",
  "lastMessageAt": "2026-11-06T06:16:33.960Z",
  "createdAt": "2026-11-06T04:26:53.285Z",
  "customer": { "id": "f560cbed-…", "losUserId": 67, "username": "012999888" },
  "lastMessage": { /* a Message, or null */ }
}
// meta for the inbox: { "total": 12, "page": 1, "size": 20, "totalPages": 1 }

// Message (history items, POST response, and the socket's message:new)
{
  "id": "45a7ccac-2684-40e4-a7cf-2fc8ae7d7a62",
  "conversationId": "70e766d1-…",
  "senderKind": "STAFF",                 // CUSTOMER | STAFF
  "type": "TEXT",                        // TEXT | VOICE | IMAGE | FILE
  "text": "Received your payslip.",      // null allowed for files; caption otherwise
  "clientMessageId": "aa192eeb-3916-46b8-944a-8a4916804961",
  "createdAt": "2026-11-06T06:16:33.960Z",
  "sender": { "id": "a034f921-…", "username": "admin", "kind": "STAFF" },
  "attachment": null                     // or { "id", "mimeType", "sizeBytes", "fileName", "durationSec" }
}
// meta for history: { "size": 30, "nextCursor": "<message id>" | null }   (null = no older messages)

// Send body (POST /chat/conversations/:id/messages)
{ "clientMessageId": "<crypto.randomUUID()>", "type": "TEXT", "text": "…" }
{ "clientMessageId": "<uuid>", "type": "FILE" | "IMAGE" | "VOICE", "attachmentId": "<from upload>", "text": "optional caption" }
// → 201 { "data": <Message> }

// Upload response (POST /chat/attachments)
{ "id": "…", "mimeType": "application/pdf", "sizeBytes": 125, "fileName": "sample.pdf", "durationSec": null }
```

- Envelope: success `{ "status": "success", "data", "meta"? }`; error `{ "status": "error", "error": { "code", "message", "details"? } }`.
- Errors: 400 `BAD_REQUEST` (`details` has field errors), 401 `UNAUTHORIZED` (renew the session, section 3), 404 `NOT_FOUND`, 413 `PAYLOAD_TOO_LARGE` (20 MB), 415 `UNSUPPORTED_MEDIA_TYPE`.
- `clientMessageId`: new UUID per message. **Reuse the same one when retrying** that message; the server returns the original instead of saving a duplicate.
- Allowed uploads: jpg, png, heic/heif, webp; m4a/mp4 audio, aac, mp3; pdf, doc/docx, xls/xlsx.
- Attachments need the Bearer header, so `<img src>` can't load them directly: `fetch` with the header, then `URL.createObjectURL(blob)`.

### Socket.io (not a plain WebSocket)

chat_backend uses **Socket.io**; the current `WsClient` speaks plain WebSocket JSON frames and can't connect to it. Add `socket.io-client` (v4).

```js
import { io } from 'socket.io-client';
const socket = io(CHAT_API, { auth: { token: session.accessToken } }); // same origin as REST, no path change
socket.on('message:new', (message) => { /* Message shape above */ });
socket.on('typing', ({ conversationId, user, isTyping }) => { /* user: { id, username, kind } */ });
socket.emit('typing', { conversationId, isTyping: true });               // staff → customer
```

- Connect **once** after sign-in, not per conversation. The server puts every staff member in a `staff` room automatically, which receives `message:new` for **every** conversation (use it to update the inbox) and the open one (append to the chat view).
- Your own replies also arrive as `message:new`; dedupe by `clientMessageId`.
- After a reconnect, reload the open conversation's latest page: missed events are not replayed.
- On session renewal, disconnect and reconnect with the new token.

There is **no** `sync`, `message.ack`, `message.status`, `conversation.updated`, `conversation.assigned`, `notice` or `notification` event, and **no** client → server `message.send`, `conversation.read`, `conversation.takeover` or `callback.request`. Reads and writes are REST.

---

## 5. How to fit it into this codebase

Suggested shape. Adjust to FSD as you see fit, but keep the UI components unchanged where possible by mapping chat_backend data into the existing DTOs.

| Where | What |
| :--- | :--- |
| `shared/config` | `CHAT_API` (`VITE_CHAT_API_URL`), `LOS_API` (`VITE_LOS_API_URL`), `LOS_HANDOFF_PATH`, `AUTH_MODE` (`VITE_AUTH_MODE`), `TRANSPORT` (`VITE_TRANSPORT=chat-backend\|mock`), `features.step2` |
| `shared/api/los` | `losLogin(username, password)`, `losHandoff(losToken)` |
| `shared/api/chat-backend` | `fetch` wrapper (Bearer, envelope parsing into a typed error, one 401 → renew → retry), typed endpoints from section 4, Socket.io client, **mappers** to the existing `ConversationDto` / `ChatMessageDto` |
| `entities/session` | in-memory session store (chat session, expiry, LOS token, user), renewal timer |
| `features/sign-in` | the sign-in form (standalone mode) and `getHandoff()` |
| `app` | show sign-in until there is a session; then start realtime. Rewrite `app/providers/realtime.ts`: load inbox via REST, connect Socket.io, route `message:new` / `typing` into the existing stores |
| `features/select-conversation` | on select, load history via REST (newest first → reverse), "load older" with `before=nextCursor`; drop `conversation.read` |
| `features/send-message` | REST POST with `clientMessageId` (keep the optimistic message: `status: 'sending'` → replace with the 201 response; `failed` + retry with the same id) |
| `features/share-files` | upload, then send a FILE/IMAGE/VOICE message; show attachments via blob URLs |
| `features/take-over-conversation`, `request-callback`, notifications, applications | hide behind `features.step2` |

### Mapping into the existing DTOs

```ts
// chat_backend inbox row → ConversationDto
id            ← row.id
customerId    ← row.customer.id
name          ← row.customer.username          // LOS username (usually the phone); no real name yet
avatar        ← ""                              // UI should fall back to initials
preview       ← lastMessage?.text ?? attachment label ("Voice message", fileName) ?? ""
lastMessageAt ← row.lastMessageAt
unread 0, urgent false, activity [], summary ""
handoff       ← a value that keeps the composer enabled; hide handoff badges and takeover in step 1
application   ← placeholder; the applications panel is hidden in step 1

// chat_backend Message → ChatMessageDto (extend it with attachment + senderName)
id             ← message.id   (optimistic messages use clientMessageId until the 201 arrives)
conversationId ← message.conversationId
side           ← senderKind === "CUSTOMER" ? "customer" : "agent"
text           ← message.text ?? ""
createdAt      ← message.createdAt
status         ← "sent"
senderId       ← message.sender.id
+ senderName   ← message.sender.username       // show which staff member replied
+ attachment   ← message.attachment
```

---

## 6. Running it locally

1. **chat_backend** (the other repo) runs on `http://localhost:3000` with `pnpm run dev`. Its `.env` already trusts the LOS dev key and borrows the analytics-dashboard handoff. Its CORS allows any origin in development, REST and Socket.io alike.
2. **This app** on `http://localhost:5173` (Vite default). LOS dev already allows this origin (checked: `Access-Control-Allow-Origin: http://localhost:5173`). Keep port 5173.
3. `frontend/.env`:
   ```dotenv
   VITE_TRANSPORT=chat-backend
   VITE_AUTH_MODE=standalone
   VITE_CHAT_API_URL=http://localhost:3000
   VITE_LOS_API_URL=https://api-dev.los.delightech.asia/api/v1
   VITE_LOS_HANDOFF_PATH=/admin/dashboard-embed/handoff-token
   ```
4. **Customer side for testing:** there is no customer UI here. Send messages as a customer with chat_backend's Postman collection (`chat_backend/postman/chat_backend_los_dev.postman_collection.json` → Customer folder: 1. LOS login, 2. Chat session, Send a message), or with curl.

---

## 7. Done when

- [ ] A staff member signs in with LOS dev credentials on the standalone sign-in screen; wrong credentials show LOS's error.
- [ ] The inbox lists conversations from chat_backend, latest activity first, with the customer's username and the last message.
- [ ] Clicking a conversation shows its history (oldest at top); scrolling up loads older pages.
- [ ] Replying posts to chat_backend; the message shows once (no duplicate from the socket echo); a failed send can be retried with the same `clientMessageId`.
- [ ] A customer message sent from Postman appears live in the open chat and moves that conversation to the top of the inbox, without a refresh.
- [ ] Two staff accounts in two browsers both see the conversation and each other's replies live.
- [ ] Files: upload and send a PDF/image; customer files display or download.
- [ ] The session renews silently before 15 minutes and after a `401`; the socket reconnects with the new token.
- [ ] Step-2 features are hidden behind the flag; `VITE_TRANSPORT=mock` still runs the old mock.
- [ ] `pnpm check` passes.

## 8. Open questions for the backend session (ask, don't guess)

- Customer **display name and avatar**: chat_backend only has the LOS username today. Real names and loan data would come from LOS later.
- **Unread counts / read receipts**: not in step 1. If the UI really needs them, ask, and the backend will add an endpoint.
