# chat_backend guide

_Last updated: 2026-11-07_

---

## Status

**Working** (tested 6 Nov 2026 on LOS dev)

- Customer and staff sign-in with real LOS dev accounts
- Customer sends a message; staff inbox lists it
- Any staff member replies; the customer receives it
- Files (PDF, image, voice) both ways; live updates over Socket.io [Please double check , it has endpoint and function but not fully working yet]
- Role/permission tables seeded; both token exchanges validate the `role` claim against chat_backend's own `roles` table

**Still to do outside chat_backend**

- `los_backend`: add a chat handoff endpoint (`aud: "chat"`). Dev borrows the analytics-dashboard handoff for now.
- `los_web`: implement the postMessage handshake with the chat iframe
- `los_chat_web` and the Flutter app: call the endpoints below

---

## The pieces

`chat_backend` is a new, standalone Express + Socket.io service. It sits beside the existing production systems and talks to none of them at runtime except LOS (to download its public key once at startup).

```
Existing
  los_backend   identity, JWKS, staff passwords
  los_web       operations dashboard (React)
  Flutter app   customer mobile app

New
  chat_backend  this repo — Express 5 + Socket.io + PostgreSQL
  los_chat_web  React iframe embedded in los_web (separate repo)
```

**Data flows at a glance**

| Actor | Signs in via | Then talks to |
| :--- | :--- | :--- |
| Flutter customer | LOS login → LOS access token → `POST /customer/api/v1/auth/session` | chat_backend REST + Socket.io |
| LOS staff | los_web → los_backend handoff token → postMessage → `POST /agent/api/v1/auth/session` | chat_backend REST + Socket.io |

chat_backend downloads the LOS RS256 public key from the LOS JWKS once and caches it. After that it is fully independent.

---

## Sign in with LOS

LOS is the only identity provider — it alone stores passwords. chat_backend never sees a password. The two `/auth/session` endpoints are the **only** place an LOS token is accepted. Everything else uses chat_backend's own session token.

### Customer (Flutter app)

```
Flutter app  ──POST /customer/api/v1/auth/session { losToken }──▶  chat_backend
```

The app passes the LOS access token it already holds. chat_backend checks RS256 signature, `exp`, `iss`, `aud=LOS_CUSTOMER_AUDIENCE`, `type==='customer'`, `tokenType==='access'`, and a valid 32-bit `userId`. It then validates the token's `role` claim against the local `roles` table (kind must be `CUSTOMER`). On success it upserts a `chat_users` row and returns a **1-hour chat session** (HS256).

### Staff (los_chat_web iframe)

```
los_web  ──request handoff──▶  los_backend  ──postMessage handoff token──▶  los_chat_web
los_chat_web  ──POST /agent/api/v1/auth/session { handoffToken }──▶  chat_backend
```

The real LOS staff token never leaves los_web. los_backend issues a narrow 2-minute handoff token (`aud='chat'`, `tokenType='chat-handoff'`). chat_backend checks it the same way, with `type==='staff'`, then validates the `role` claim against the `roles` table (kind must be `STAFF`). Any LOS staff role is allowed. Returns a **15-minute chat session**.

### Role validation (added 6 Nov 2026)

Both exchanges look up the `role` claim in chat_backend's own `roles` table. A token whose role is unknown to this service, or whose role kind doesn't match the endpoint (`CUSTOMER` vs `STAFF`), is rejected with 401. This is the only identity-time check; no per-request permission enforcement is wired yet.

### Who may chat

| Kind | LOS roles allowed |
| :--- | :--- |
| Customer | `CUSTOMER` |
| Staff | Any staff role seeded in `roles` (14 roles) |

### Sessions

HS256, `iss=chat-backend`. Audience is `chat-customer` or `chat-staff` — a customer session is rejected on staff routes and vice versa. Stateless: `verifySession` rebuilds `req.user` from the JWT claims, no DB call per request. Clients exchange again when a session expires.

---

## los_chat_web integration (staff)

los_chat_web is a React iframe embedded inside los_web. Full sign-in and usage flow:

1. **Staff logs in to los_web** using their LOS credentials (los_backend issues a normal LOS access token).
2. **los_web requests a chat handoff token** from los_backend: `POST /admin/chat/handoff-token`. los_backend returns a 2-minute RS256 token with `aud='chat'`, `type='staff'`, `tokenType='chat-handoff'`, `userId`, `username`, `role`.
3. **los_web postMessages** the handoff token into the los_chat_web iframe.
4. **los_chat_web exchanges it**: `POST /agent/api/v1/auth/session { handoffToken }` → receives a 15-minute chat session token.
5. **Staff lists conversations**: `GET /agent/api/v1/chat/conversations?page=1&size=20` — ordered by `last_message_at` desc.
6. **Staff opens a conversation**: `GET /agent/api/v1/chat/conversations/:id/messages?size=30` — history newest first.
7. **Staff replies**: `POST /agent/api/v1/chat/conversations/:id/messages { clientMessageId, type, text }`.
8. **Live updates**: Socket.io — connect with the chat session token; server pushes `message:new` to the `staff` room (all staff members see every new message regardless of which conversation is open).

**Re-auth**: the 15-minute session expires; los_chat_web must request a new handoff and re-exchange. los_web must keep the iframe alive to deliver the new postMessage.

**Dev note**: los_backend has not yet added the handoff endpoint. Dev uses the existing analytics-dashboard handoff (`aud='analytics-dashboard'`, `tokenType='dashboard-handoff'`) with `LOS_HANDOFF_AUDIENCE` and `LOS_HANDOFF_TOKEN_TYPE` overridden in `.env`. `env.ts` refuses those values in production.

---

## Flutter app integration (customer)

The Flutter app already holds an LOS access token from its own login. chat_backend accepts it directly — no second login screen.

**Sign-in**

```
POST /customer/api/v1/auth/session
Body: { "losToken": "<LOS access token>" }
Response: { "status": "success", "data": { "accessToken": "...", "expiresIn": "1h", "user": { ... } } }
```

Store the returned `accessToken` and pass it as `Authorization: Bearer <token>` on every subsequent request.

**Endpoints**

| Method | Path | What it does |
| :--- | :--- | :--- |
| POST | `/customer/api/v1/auth/session` | Exchange LOS token → 1h chat session |
| GET | `/customer/api/v1/auth/me` | Current user info |
| GET | `/customer/api/v1/chat/conversation` | The customer's thread (created on first call) |
| GET | `/customer/api/v1/chat/conversation/messages` | History newest first; `?before=<id>&size=` |
| POST | `/customer/api/v1/chat/conversation/messages` | Send a message |
| POST | `/customer/api/v1/chat/attachments` | Upload a file (multipart `file`, optional `durationSec` for voice) |
| GET | `/customer/api/v1/chat/attachments/:id` | Download a file |

**Sending a message**

```json
POST /customer/api/v1/chat/conversation/messages
{
  "clientMessageId": "<uuid the app generates>",
  "type": "TEXT",
  "text": "Hello"
}
```

For a file: upload first (`POST /attachments` → get `attachmentId`), then send `{ type: "IMAGE", attachmentId }`. `clientMessageId` makes retries idempotent — a duplicate send returns the original message.

**Socket.io**

Connect with `Authorization: Bearer <chat session token>`. The server emits `message:new` to the customer's room when a staff member replies. The app can also emit `typing` to show the staff a typing indicator.

---

## API reference

### Customer routes (`/customer/api/v1`)

| Method | Path | Auth | Body / query | Response |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/session` | — | `{ losToken }` | `{ accessToken, expiresIn, user }` |
| GET | `/auth/me` | customer | — | `{ user }` |
| GET | `/chat/conversation` | customer | — | conversation (created on first call) |
| GET | `/chat/conversation/messages` | customer | `?before=<id>&size=` | `{ data: messages[], meta: { size, nextCursor } }` |
| POST | `/chat/conversation/messages` | customer | `{ clientMessageId, type, text?, attachmentId? }` | 201 message |
| POST | `/chat/attachments` | customer | multipart `file`, optional `durationSec` | 201 attachment |
| GET | `/chat/attachments/:id` | customer | — | file download |

### Staff routes (`/agent/api/v1`)

| Method | Path | Auth | Body / query | Response |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/session` | — | `{ handoffToken }` | `{ accessToken, expiresIn, user }` |
| GET | `/auth/me` | staff | — | `{ user }` |
| GET | `/chat/conversations` | staff | `?page=&size=` | paged list with `customer` and `lastMessage` |
| GET | `/chat/conversations/:id` | staff | — | one conversation with `customer` and `lastMessage` |
| GET | `/chat/conversations/:id/messages` | staff | `?before=<id>&size=` | `{ data: messages[], meta: { size, nextCursor } }` |
| POST | `/chat/conversations/:id/messages` | staff | `{ clientMessageId, type, text?, attachmentId? }` | 201 message |
| POST | `/chat/attachments` | staff | multipart `file`, optional `durationSec` | 201 attachment |
| GET | `/chat/attachments/:id` | staff | — | file download |

### Response envelope

```json
{ "status": "success", "data": { ... } }
{ "status": "success", "data": [...], "meta": { "total", "page", "size", "totalPages" } }
{ "status": "success", "data": [...], "meta": { "size", "nextCursor" } }
{ "status": "error", "error": { "code", "message", "details"? } }
```

### Socket.io events

| Event | Direction | Room | Payload |
| :--- | :--- | :--- | :--- |
| `message:new` | server → client | `user:<customerId>` + `staff` | message object |
| `typing` | client → server | — | `{ conversationId }` |
| `typing` | server → client | customer room or `staff` | `{ conversationId, senderId, senderKind }` |

Connect: `io('https://…', { auth: { token: '<chat session token>' } })`. Both customer and staff sessions are accepted at the socket handshake.

---

## Database tables

All ids are UUIDs (except `roles`, `permissions`, `role_permissions` which use int PKs). All timestamps are `timestamptz`. Chat history is permanent — every FK is `ON DELETE RESTRICT`.

### Enums

| Enum | Values |
| :--- | :--- |
| `chat_user_kind` | `CUSTOMER`, `STAFF` |
| `sender_kind` | `CUSTOMER`, `STAFF` |
| `message_type` | `TEXT`, `VOICE`, `IMAGE`, `FILE` |

### `roles`

Seeded at migration time. Mirrors LOS role names exactly.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | no | PK, autoincrement | |
| `name` | varchar | no | unique | mirrors LOS role name (e.g. `CREDIT_ASSESSMENT`) |
| `kind` | chat_user_kind | no | | `CUSTOMER` or `STAFF` |
| `description` | varchar | yes | | |
| `created_at` | timestamptz | no | | |

### `permissions`

Static permission pairs. Seeded, never managed via API.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | no | PK, autoincrement | |
| `module` | varchar | no | unique with `action` | e.g. `CONVERSATION`, `MESSAGE`, `ATTACHMENT` |
| `action` | varchar | no | unique with `module` | e.g. `View All`, `Send`, `Download` |
| `created_at` | timestamptz | no | | |

**Seeded permissions**

| Module | Action | Customer | Staff |
| :--- | :--- | :---: | :---: |
| `CONVERSATION` | `View All` | — | ✓ |
| `CONVERSATION` | `View` | ✓ | ✓ |
| `MESSAGE` | `View History` | ✓ | ✓ |
| `MESSAGE` | `Send` | ✓ | ✓ |
| `ATTACHMENT` | `Upload` | ✓ | ✓ |
| `ATTACHMENT` | `Download` | ✓ | ✓ |

### `role_permissions`

| Column | Type | Null | Constraint |
| :--- | :--- | :--- | :--- |
| `id` | int | no | PK |
| `role_id` | int | no | FK → `roles.id`, unique with `permission_id` |
| `permission_id` | int | no | FK → `permissions.id`, unique with `role_id` |

### `chat_users`

Everyone who has used chat, keyed by their LOS identity.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `los_user_id` | int | no | unique with `kind` | `userId` from the LOS token |
| `kind` | chat_user_kind | no | unique with `los_user_id` | |
| `username` | varchar | no | | copied from token, refreshed on each sign-in |
| `role_id` | int | no | FK → `roles.id` | resolved and validated at session exchange |
| `last_seen_at` | timestamptz | no | | |
| `created_at` / `updated_at` | timestamptz | no | | |

### `conversations`

One permanent thread per customer.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `customer_id` | uuid | no | FK → `chat_users.id`, **unique** | one conversation per customer |
| `last_message_at` | timestamptz | yes | index | staff inbox order; null until first message |
| `created_at` | timestamptz | no | | |

### `messages`

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | also the cursor for `?before=` |
| `seq` | int | no | unique, auto-increment | insert order; history sorted by this |
| `conversation_id` | uuid | no | FK → `conversations.id`, index with `seq` | |
| `sender_id` | uuid | no | FK → `chat_users.id` | |
| `sender_kind` | sender_kind | no | | |
| `type` | message_type | no | | |
| `text` | text | yes | | required for TEXT; optional caption on files |
| `attachment_id` | uuid | yes | FK → `attachments.id`, **unique** | required for VOICE, IMAGE, FILE |
| `client_message_id` | varchar | yes | unique with `sender_id` | retried send returns original |
| `created_at` | timestamptz | no | | |

### `attachments`

Uploaded first, then referenced by a message.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `uploader_id` | uuid | no | FK → `chat_users.id` | only the uploader can send it, once |
| `storage_key` | varchar | no | unique | path on disk; never sent to clients |
| `mime_type` | varchar | no | | client-declared (no sniffing yet) |
| `size_bytes` | int | no | | up to 20 MB default |
| `file_name` | varchar | no | | original filename |
| `duration_sec` | int | yes | | voice only |
| `created_at` | timestamptz | no | | |
