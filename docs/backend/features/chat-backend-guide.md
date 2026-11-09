# chat_backend guide

_Last updated: 2026-11-09_

An overview of chat_backend for the team: what it is, what works, how sign-in works, and the database.

> **Connecting another repo** (los_backend, los_web, chat_web, the Flutter app)? Use **[auth/los-chat-handoff.md](auth/los-chat-handoff.md)**. It is the integration contract, with every endpoint, payload, error and socket event. This guide doesn't repeat it, so the two can't drift apart.

---

## Status

**Working**
- Customer and staff sign-in with real LOS dev accounts (tested 6 Nov 2026).
- Refresh tokens: 24 h logins with rotation, reuse detection and logout, for both audiences (tested 9 Nov 2026).
- Customer sends a message; the staff inbox lists it; any staff member replies; the customer receives it.
- Files: upload, send and download, tested over REST with a PDF on 9 Nov 2026. Images and voice use the same code path but haven't been tested from the real apps yet.
- Live updates over Socket.io: `message:new` and `typing` both ways (socket smoke test passes 10/10, 9 Nov 2026).
- Roles and permissions are seeded. The staff handoff's `role` is checked against chat_backend's `roles` table. Permissions aren't enforced yet.

**Still to do outside chat_backend**
- `los_backend`: add the chat handoff endpoint (`aud: "chat"`). Dev borrows the analytics-dashboard handoff for now.
- `los_web`: the postMessage handshake with the chat iframe, including `CHAT_LOGOUT`.
- `chat_web`: switch from re-handoff to `POST /auth/refresh`; use `type` / `sender.type`.
- Flutter app: integrate the customer API, refresh tokens and Socket.io; use `type` / `sender.type`.

---

## The pieces

chat_backend is a standalone Express 5 + Socket.io + PostgreSQL service. At runtime it talks to nothing else except LOS, whose public key (JWKS) it downloads and caches.

```
Existing
  los_backend   identity provider: passwords, LOS tokens, JWKS
  los_web       operations dashboard (React); hosts the chat iframe
  Flutter app   customer mobile app

New
  chat_backend  this service: Express 5 + Socket.io + PostgreSQL
  chat_web      staff chat UI (React), embedded in los_web as an iframe
```

| Actor | Signs in via | Then talks to |
| :--- | :--- | :--- |
| Customer (Flutter) | LOS login → LOS access token → `POST /customer/api/v1/auth/session` | chat_backend REST + Socket.io |
| Staff (chat_web) | los_web → los_backend handoff token → postMessage → `POST /agent/api/v1/auth/session` | chat_backend REST + Socket.io |

---

## Sign in with LOS

LOS is the only identity provider, and chat_backend never sees a password. The two `/auth/session` endpoints are the **only** place an LOS token is accepted. Everything else uses chat_backend's own session token.

**Customer.** The app sends the LOS access token it already holds. chat_backend checks the RS256 signature, `exp`, `iss=los-backend`, `aud=luyleun`, `type==='customer'`, `tokenType==='access'`, a 32-bit `userId` and a `username`. LOS customer tokens carry **no role**, so chat assigns its seeded `CUSTOMER` role. Result: a **1 h** chat session plus a 24 h refresh token.

**Staff.** los_web gets a 2-minute handoff token from los_backend (`aud='chat'`, `tokenType='chat-handoff'`) and passes it into the iframe; the real LOS staff token never leaves los_web. chat_backend checks it the same way (`type==='staff'`), then looks up the `role` claim **by name** in its `roles` table. The role must exist and have `type = STAFF`, otherwise the response is `401`. Any known staff role may chat. Result: a **15 min** chat session plus a 24 h refresh token.

**Sessions.** HS256 JWTs with `iss=chat-backend` and one audience per type (`chat-customer` / `chat-staff`), so a customer session is rejected on staff routes and vice versa. They're stateless: each request rebuilds the user from the token, with no database call.

**Refresh tokens** (`refresh_tokens` table). `/auth/session` also returns an opaque refresh token; only its SHA-256 is stored. `POST /auth/refresh` swaps it for a new access token **and** a new refresh token (rotation). Reusing an old one ends the whole login (theft detection). `POST /auth/logout` ends the login. A login lasts at most 24 h (`CHAT_REFRESH_EXPIRES_IN`) from sign-in, however often it refreshes. Refresh doesn't ask LOS, so a user blocked in LOS keeps chat until that limit.

**Roles vs type.**
- A user's **type** (`CUSTOMER` / `STAFF`) says which LOS account table they come from. LOS customers and staff can share a `userId`, so `chat_users` is unique on `(los_user_id, type)`.
- A **role** is the staff member's job. The token carries one role; LOS staff can have several, but chat stores the one in the token.

| Type | Roles allowed to chat |
| :--- | :--- |
| Customer | `CUSTOMER` (assigned by chat) |
| Staff | any of the 14 seeded staff roles |

---

## Database tables

All ids are UUIDs, except `roles`, `permissions` and `role_permissions`, which use int PKs. All timestamps are `timestamptz`. Chat history is permanent, so foreign keys are `ON DELETE RESTRICT`, except `refresh_tokens`, which are removed with their user.

### Allowed values

There are no database enums. These columns are `text`; the allowed values are defined in code (`backend/src/shared/types/chat-types.ts`) and enforced in the database by CHECK constraints.

| Column | Values | Enforced by |
| :--- | :--- | :--- |
| `roles.type` | `CUSTOMER`, `STAFF` | `roles_type_check` |
| `chat_users.type` | same as its role | FK `(role_id, type)` → `roles(id, type)` |
| `messages.type` | `TEXT`, `VOICE`, `IMAGE`, `FILE` | `messages_type_check` |

To add a value, change `chat-types.ts` and write a migration that re-creates the CHECK.

### `roles`

Seeded by migration. Names mirror LOS role names exactly.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | no | PK, autoincrement | not the same as the LOS role id |
| `name` | varchar | no | unique | LOS role name, e.g. `CREDIT_ASSESSMENT` |
| `type` | text | no | CHECK; unique with `id` | `CUSTOMER` or `STAFF`; source of truth for user type |
| `description` | varchar | yes | | |
| `created_at` | timestamptz | no | | |

### `permissions`

Static permission pairs. Seeded, never managed via the API, not enforced yet.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | no | PK, autoincrement | |
| `module` | varchar | no | unique with `action` | `CONVERSATION`, `MESSAGE`, `ATTACHMENT` |
| `action` | varchar | no | unique with `module` | e.g. `View All`, `Send`, `Download` |
| `created_at` | timestamptz | no | | |

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
| `id` | uuid | no | PK | the chat id clients see as `user.id` / `sender.id` |
| `los_user_id` | int | no | unique with `type` | `userId` from the LOS token |
| `type` | text | no | unique with `los_user_id` | copy of the role's type, kept for the unique key |
| `username` | text | no | | copied from the token, refreshed on each sign-in |
| `role_id` | int | no | FK `(role_id, type)` → `roles(id, type)` | so `type` always matches the role |
| `last_seen_at` | timestamptz | no | | updated on each sign-in |
| `created_at` / `updated_at` | timestamptz | no | | |

### `refresh_tokens`

One row per issued refresh token. A login starts a family, and each refresh adds a row to it.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `user_id` | uuid | no | FK → `chat_users.id` (cascade), index | |
| `family_id` | uuid | no | index | one per login; reuse revokes the whole family |
| `token_hash` | text | no | unique | SHA-256 of the token; the raw value is never stored |
| `expires_at` | timestamptz | no | index | absolute; copied unchanged on rotation |
| `revoked_at` | timestamptz | yes | | set on rotation, logout or reuse |
| `replaced_by_id` | uuid | yes | unique | the token that replaced this one |
| `user_agent` | text | yes | | |
| `created_at` | timestamptz | no | | |

Expired rows are deleted when the user next signs in.

### `conversations`

One permanent thread per customer.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `customer_id` | uuid | no | FK → `chat_users.id`, **unique** | one conversation per customer |
| `last_message_at` | timestamptz | yes | index | staff inbox order; null until the first message |
| `created_at` | timestamptz | no | | |

### `messages`

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | also the `?before=` cursor |
| `seq` | int | no | unique, autoincrement | insert order; history is sorted by this |
| `conversation_id` | uuid | no | FK → `conversations.id`, index with `seq` | |
| `sender_id` | uuid | no | FK → `chat_users.id` | the sender's type comes from `chat_users.type` |
| `type` | text | no | CHECK | `TEXT`, `VOICE`, `IMAGE`, `FILE` |
| `text` | text | yes | | required for TEXT; optional caption on files |
| `attachment_id` | uuid | yes | FK → `attachments.id`, **unique** | required for VOICE, IMAGE, FILE |
| `client_message_id` | text | yes | unique with `sender_id` | a retried send returns the original |
| `created_at` | timestamptz | no | | |

### `attachments`

Uploaded first, then referenced by a message.

| Column | Type | Null | Constraint | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | PK | |
| `uploader_id` | uuid | no | FK → `chat_users.id` | only the uploader can send it, once |
| `storage_key` | text | no | unique | path on disk; never sent to clients |
| `mime_type` | text | no | | client-declared (no sniffing yet) |
| `size_bytes` | int | no | | up to 20 MB by default |
| `file_name` | text | no | | original file name |
| `duration_sec` | int | yes | | voice only |
| `created_at` | timestamptz | no | | |
