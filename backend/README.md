# Chat Backend

Standalone chat service for the LOS system, built with **Express 5**, **Socket.io**, **Prisma ORM 7**, **TypeScript** and **PostgreSQL**, using **pnpm** as the package manager.

It serves two clients:

- the **Flutter app**: customers chat with support;
- **chat_web**: a separate frontend, embedded as an iframe inside `los_web`, where LOS staff read and answer customers.

`chat_backend` stores **no passwords**. Identity comes from `los_backend`: customers send their LOS access token, and staff swap an LOS handoff token for a short chat session. Both are verified with the LOS public key.

This README covers **local development only**. Docker is not used: PostgreSQL runs locally via Homebrew, and DBeaver is used as the database GUI. The milestone-1 design (diagrams, tables, decisions) is in [docs/features/milestone_1.md](docs/features/milestone_1.md).

**Contents**

- [Prerequisites](#prerequisites)
- [Getting Started (cloning this repo)](#getting-started-cloning-this-repo)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [How authentication works](#how-authentication-works)
- [How chat works](#how-chat-works)
- [API](#api)
- [Real-time (Socket.io)](#real-time-socketio)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Adding a New Feature Module](#adding-a-new-feature-module)
- [Scripts & Command Reference](#scripts--command-reference)
- [Troubleshooting](#troubleshooting)
- [How This Project Was Created (from scratch)](#how-this-project-was-created-from-scratch)

---

## Prerequisites

| Tool | Version used | Install |
| :--- | :--- | :--- |
| Node.js | 22 (20+ works) | [nodejs.org](https://nodejs.org/) |
| pnpm | 10 | `corepack enable` or [pnpm.io/installation](https://pnpm.io/installation) |
| PostgreSQL | 17 (Homebrew) | `brew install postgresql@17` |
| DBeaver | any | [dbeaver.io](https://dbeaver.io/) (optional, for browsing data) |

Use **pnpm only**; do not use npm or yarn in this repo.

---

## Getting Started (cloning this repo)

### 1. Start PostgreSQL

```bash
brew services start postgresql@17
```

### 2. Create the database

We use the existing `postgres` superuser; no separate database user is needed. Create an empty database called `chat_backend` using **either** option:

**Terminal:**

```bash
psql -U postgres -c "CREATE DATABASE chat_backend;"
```

**DBeaver:** open your `postgres` connection → SQL Editor (make sure the commit mode in the toolbar is **Auto**) → run:

```sql
CREATE DATABASE chat_backend;
```

Then right-click **Databases** → **Refresh**.

### 3. Install dependencies

```bash
pnpm install
```

Prisma's install scripts are already approved in `pnpm-workspace.yaml`, so no `pnpm approve-builds` prompt is needed.

### 4. Create a dev key pair (stands in for LOS)

```bash
pnpm run dev:keys      # writes keys/dev-los-private.pem and keys/dev-los-public.pem (git-ignored)
```

Locally, `chat_backend` verifies tokens with this public key instead of the real LOS one, and `pnpm run dev:token` signs LOS-shaped test tokens with the private key.

### 5. Create your `.env`

```bash
cp .env.example .env
openssl rand -base64 48        # copy the output into CHAT_SESSION_SECRET
```

The defaults in `.env.example` already point at the dev key (`LOS_PUBLIC_KEY_PATH=keys/dev-los-public.pem`). See [Environment Variables](#environment-variables).

### 6. Create the tables and generate the Prisma Client

```bash
pnpm exec prisma migrate dev     # applies every migration in prisma/migrations
pnpm exec prisma generate        # writes the typed client into generated/prisma/
```

Run **both**. In Prisma 7, `migrate dev` no longer runs `generate` for you, and `generated/` is git-ignored, so a fresh clone has no client until you generate it.

### 7. Start the server

```bash
pnpm run dev
```

### 8. Check it works

```bash
curl http://localhost:3000/health
pnpm run smoke:socket    # the real-time checks (needs the dev key from step 4)
```

In DBeaver, refresh `chat_backend` → **Schemas → public → Tables**. You should see `chat_users`, `conversations`, `messages`, `attachments` and `_prisma_migrations`.

---

## Environment Variables

All variables live in `.env` (git-ignored; never commit it). `.env.example` is the template and **is** committed: when you add a variable, add it to both `.env.example` and `src/config/env.ts`.

Every value is validated at startup by `src/config/env.ts` using Zod. If something is missing or invalid, the server prints what's wrong and refuses to start.

| Variable | Example | What it is |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | `development`, `test` or `production`. Development enables pretty logs. |
| `PORT` | `3000` | Port for REST and Socket.io. |
| `DATABASE_URL` | `postgresql://postgres@localhost:5432/chat_backend?schema=public` | How the app and the Prisma CLI connect to Postgres. |
| `CORS_ORIGIN` | `https://chat.example.com` | Comma-separated origins allowed from a browser (REST and Socket.io). Empty = allow all in development, none in production. |
| `LOS_JWKS_URI` | `https://api.los.delightech.asia/api/v1/guest/.well-known/jwks.json` | **Production.** The LOS public key set. Downloaded once and cached. |
| `LOS_PUBLIC_KEY_PATH` | `keys/dev-los-public.pem` | **Local development.** A PEM public key file, used when `LOS_JWKS_URI` is not set. One of the two is required. |
| `LOS_ISSUER` | `los-backend` | Expected `iss` of every LOS token. |
| `LOS_CUSTOMER_AUDIENCE` | `luyleun` | Expected `aud` of customer access tokens (the Flutter app). |
| `LOS_HANDOFF_AUDIENCE` | `chat` | Expected `aud` of the staff handoff token. |
| `LOS_HANDOFF_TOKEN_TYPE` | `chat-handoff` | Expected `tokenType` of the staff handoff token. |
| `CHAT_SESSION_SECRET` | output of `openssl rand -base64 48` | Signs chat_backend's own session tokens (customers and staff). At least 32 characters. Changing it ends every chat session; clients just exchange again. |
| `CHAT_CUSTOMER_SESSION_EXPIRES_IN` | `1h` | Customer session lifetime; the app exchanges its LOS token again when it runs out. |
| `CHAT_STAFF_SESSION_EXPIRES_IN` | `15m` | Staff session lifetime; los_chat_web asks los_web for a new handoff before it runs out. |
| `UPLOAD_DIR` | `uploads` | Where the local-disk driver stores attachments (git-ignored). |
| `UPLOAD_MAX_BYTES` | `20971520` | Maximum attachment size (20 MB). Larger uploads get `413`. |

---

## Database & Migrations

`prisma/schema.prisma` is the single source of truth for the database. Two commands read it:

```
                     ┌── prisma migrate dev ──▶ creates/changes TABLES in Postgres (and writes a SQL migration file)
prisma/schema.prisma ┤
                     └── prisma generate ─────▶ writes the TypeScript CLIENT into generated/prisma/
```

### Tables

| Table | What it holds |
| :--- | :--- |
| `chat_users` | Everyone who has used chat (customers and staff), keyed by `(los_user_id, kind)`. LOS owns the accounts. |
| `conversations` | One permanent thread per customer; every staff member can read and reply to it. |
| `messages` | Every message in a conversation, from the customer or any staff member. Ordered by `seq`. |
| `attachments` | Uploaded files (voice, images, documents), uploaded first and then sent in a message. |

### Changing the schema (adding a model, field, index…)

1. Edit `prisma/schema.prisma`.
2. Create and apply a migration with a short descriptive name:
   ```bash
   pnpm exec prisma migrate dev --name add-read-receipts
   ```
3. **Check the generated SQL** before applying it, especially anything that drops data.
4. Regenerate the client:
   ```bash
   pnpm exec prisma generate
   ```
5. **Commit the new folder in `prisma/migrations/`** together with the schema change.

### Rules

- Never change tables by hand in DBeaver; every schema change goes through a migration.
- Never edit or delete a migration that has already been applied or committed. Create a new one instead.
- Tables and columns use snake_case in the database via `@map` / `@@map`, while TypeScript fields stay camelCase. Ids are UUIDs.
- Application code imports `prisma` from `@config/database.js`. Never create a new `PrismaClient`, and never import from `@prisma/client`.

### Current migrations

| Migration | What it does |
| :--- | :--- |
| `20261103094112_init_user_post` | (Old) creates `users` and `posts` |
| `20261105090000_chat_core` | Drops `users`/`posts`; creates the chat tables, enums and the one-open-ticket partial index |
| `20261105100000_message_seq` | Adds `messages.seq` so messages written in one transaction keep their order |
| `20261106090000_remove_tickets` | Drops `tickets`, `ticket_events`, `messages.ticket_id`, `chat_users.staff_role` and the ticket SYSTEM messages; every staff member now replies directly |

### Useful commands

| Task | Command |
| :--- | :--- |
| See which migrations are applied | `pnpm exec prisma migrate status` |
| Reset local DB (**deletes all data**, re-applies all migrations) | `pnpm exec prisma migrate reset` |
| Check / format the schema | `pnpm exec prisma validate` / `pnpm exec prisma format` |

### Connecting with DBeaver

| Field | Value |
| :--- | :--- |
| Host | `localhost` |
| Port | `5432` |
| Database | `chat_backend` |
| Username | `postgres` |
| Password | *(empty, unless you set one)* |

---

## How authentication works

**"Sign in with LOS"**, the same idea as "Sign in with Google":

1. **Proof.** LOS is the identity provider: it alone checks passwords, and it signs tokens with an RSA private key (RS256) that only it has. The matching public key is published at its JWKS URL.
2. **Check.** chat_backend downloads that public key once and verifies token signatures locally. It never sees a password and never calls LOS per request.
3. **Mapping.** chat_backend finds or creates the person's `chat_users` row by LOS user id, so every LOS customer, and every LOS staff member, can use chat without being registered.
4. **Session.** chat_backend returns **its own session token**. LOS tokens are accepted **only** by the two `/auth/session` endpoints; every other request and the socket need the chat session.

```
Customer (Flutter)
  LOS app login ──▶ LOS access token (aud 'luyleun', type 'customer', tokenType 'access')
  POST /customer/api/v1/auth/session { losToken } ──▶ { accessToken, expiresIn: '1h', user }
  every chat REST call:  Authorization: Bearer <chat session>      Socket.io: io(url, { auth: { token: <chat session> } })

Staff (los_chat_web iframe inside los_web)
  los_web ──▶ LOS: chat handoff token (2 min, aud 'chat', tokenType 'chat-handoff', role) ──postMessage──▶ los_chat_web
  POST /agent/api/v1/auth/session { handoffToken } ──▶ { accessToken, expiresIn: '15m', user }   (any LOS staff role)
  every chat REST call and the socket use the chat session; before it expires, los_chat_web asks los_web for a new handoff
```

- **Why the handoff for staff:** los_web's own LOS token works on all of LOS. The handoff token only starts a chat session, for 2 minutes, so the real staff token never leaves los_web.
- **Session tokens:** HS256 with `CHAT_SESSION_SECRET`, with one audience per kind, so a customer session is rejected on staff routes and the other way round. They are stateless; clients exchange again when one expires.
- **Needs an LOS change:** a `POST /api/v1/admin/chat/handoff-token` endpoint. The full spec for los_backend, los_web and the Flutter app is in [docs/features/auth/los-chat-handoff.md](docs/features/auth/los-chat-handoff.md).
- **Not checked yet:** LOS logout or suspension (LOS tracks those in its own Redis). A revoked LOS token can still be exchanged until it expires.
- **Code:** `src/config/los-keys.ts` (key loading), `src/modules/auth/auth.service.ts` (`exchangeCustomerToken`, `exchangeHandoff`, `verifySession`), `src/shared/middleware/auth.middleware.ts` (`authenticateCustomer`, `authenticateStaff`).

---

## How chat works

```
Customer (Flutter)                     chat_backend                          Every LOS staff member (los_chat_web)
  sends a message ───────────────▶ saved in the customer's conversation ──▶ message:new (live) + inbox updated
  sees the reply live ◀─────────── saved, message:new ◀──────────────────── any staff member replies
```

- **One conversation per customer**, created when the customer first opens chat. It never closes, so the full history is always there.
- **Every LOS staff member** sees every conversation (`GET /chat/conversations`, latest activity first, with the last message) and can reply to any of them. Nobody assigns or picks up a conversation.
- **Messages** are text, voice, images and files. Links are just text.
- Replies from different staff members appear in the same conversation, each with its sender's name.

---

## API

Two namespaces, one per audience. Every route with input is validated with Zod.

### Customer: `/customer/api/v1` (chat customer session)

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/auth/session` | `{ losToken }` (the LOS access token) → `{ accessToken, expiresIn, user }`. The only route that takes an LOS token. |
| GET | `/auth/me` | The current customer |
| GET | `/chat/conversation` | Gets or creates the customer's thread |
| GET | `/chat/conversation/messages?before=&size=30` | History, newest first (cursor paging) |
| POST | `/chat/conversation/messages` | Send `{ clientMessageId, type: TEXT\|VOICE\|IMAGE\|FILE, text?, attachmentId? }` |
| POST | `/chat/attachments` | Multipart upload: `file` (+ `durationSec` for voice) |
| GET | `/chat/attachments/:id` | Download (own conversation only) |

### Staff: `/agent/api/v1` (chat staff session)

| Method | Path | Who | Description |
| :--- | :--- | :--- | :--- |
| POST | `/auth/session` | anyone with a handoff | `{ handoffToken }` → `{ accessToken, expiresIn, user }` |
| GET | `/auth/me` | staff | The current staff user |
| GET | `/chat/conversations?page=&size=` | staff | Every customer's conversation, latest activity first, with `customer` and `lastMessage` (paged) |
| GET | `/chat/conversations/:id` | staff | One conversation with its customer and last message |
| GET | `/chat/conversations/:id/messages?before=&size=` | staff | The full history (cursor paging) |
| POST | `/chat/conversations/:id/messages` | staff | Reply (same body as the customer's); any staff member, no assignment |
| POST | `/chat/attachments`, GET `/chat/attachments/:id` | staff | Upload / download |

### Response shapes

```jsonc
// success
{ "status": "success", "data": { ... } }
// paged list (staff conversation list)
{ "status": "success", "data": [ ... ], "meta": { "total": 1, "page": 1, "size": 20, "totalPages": 1 } }
// message history (cursor: pass meta.nextCursor as ?before= to load older messages; null = no more)
{ "status": "success", "data": [ ... ], "meta": { "size": 30, "nextCursor": "<message id>" } }
// error
{ "status": "error", "error": { "code": "NOT_FOUND", "message": "Conversation not found", "details": { ... } } }
```

### Sending messages and files

- `clientMessageId` is made by the client (e.g. a UUID) for each message. Sending the same one again returns the original message instead of a duplicate, so retries on a bad network are safe.
- Files are two steps: `POST /chat/attachments` → `{ id }`, then send a `VOICE`, `IMAGE` or `FILE` message with that `attachmentId`. A `VOICE` message needs an audio file, `IMAGE` an image. An attachment can be sent once, only by its uploader.
- Allowed types: jpg, png, heic/heif, webp; m4a/mp4 audio, aac, mp3; pdf, doc/docx, xls/xlsx. Others get `415`. Links are just text.
- Downloads: images and audio are served inline; documents always as a download.

### Example with curl

```bash
pnpm run dev:keys    # once
BASE=http://localhost:3000

CUSTOMER=$(curl -s -X POST $BASE/customer/api/v1/auth/session -H 'Content-Type: application/json' \
  -d "{\"losToken\":\"$(pnpm -s run dev:token customer --user 101 --name sokha)\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')
SUP=$(curl -s -X POST $BASE/agent/api/v1/auth/session -H 'Content-Type: application/json' \
  -d "{\"handoffToken\":\"$(pnpm -s run dev:token handoff --user 301 --name sophea --role CREDIT_SUPPORT_OFFICER)\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')

# Customer sends a message → it appears in every staff member's conversation list
curl -s -X POST $BASE/customer/api/v1/chat/conversation/messages -H "Authorization: Bearer $CUSTOMER" \
  -H 'Content-Type: application/json' -d '{"clientMessageId":"m1","type":"TEXT","text":"Hello"}'
curl -s "$BASE/agent/api/v1/chat/conversations" -H "Authorization: Bearer $SUP"
```

---

## Real-time (Socket.io)

Socket.io runs on the same port. Connect with the same chat session token as REST (an LOS token is rejected):

```js
const socket = io('http://localhost:3000', { auth: { token: chatSession.accessToken } });
```

Writes always go through REST; the socket only delivers events. Rooms are joined automatically: each user is in `user:<chatUserId>`, and all staff are also in `staff`.

| Event (server → client) | Who receives it | Payload |
| :--- | :--- | :--- |
| `message:new` | the customer + all staff | the message (same shape as REST) |
| `typing` | the other side | `{ conversationId, user, isTyping }` |

| Event (client → server) | Payload |
| :--- | :--- |
| `typing` | customer: `{ isTyping }`; staff: `{ conversationId, isTyping }` |

- A token is checked once, when the socket connects. When the token is refreshed, reconnect with the new one.
- After a reconnect, re-fetch the message history: missed events are not replayed.
- Single instance for now; running several instances needs the Socket.io Redis adapter.

---

## Testing

Testing is done in Postman against **real LOS dev logins** (next section). One automated check remains for the real-time side, and it uses the local dev key, so start the server with `LOS_PUBLIC_KEY_PATH=keys/dev-los-public.pem` for it:

```bash
pnpm run smoke:socket    # 10 Socket.io checks
```

### Developing against LOS dev (real logins)

Use this to work with real LOS dev accounts instead of dev tokens. `pnpm run smoke:socket` only works with the local dev key, so switch back to it to run that check.

1. **`.env`** (restart the server after editing):
   ```dotenv
   # LOS_PUBLIC_KEY_PATH=keys/dev-los-public.pem
   LOS_JWKS_URI=https://<los-dev-host>/api/v1/guest/.well-known/jwks.json
   # Temporary, development only: borrow the analytics-dashboard handoff until LOS can issue aud 'chat'.
   # The server refuses to start with this in production.
   LOS_HANDOFF_AUDIENCE=analytics-dashboard
   LOS_HANDOFF_TOKEN_TYPE=dashboard-handoff
   ```
2. **Postman:** import [postman/chat_backend_los_dev.postman_collection.json](postman/chat_backend_los_dev.postman_collection.json) and [postman/los-dev.postman_environment.template.json](postman/los-dev.postman_environment.template.json), and select the **chat_backend LOS dev** environment. Fill in, inside Postman only (never commit credentials):
   - `losUrl`: the LOS dev **API** host with `/api/v1`, e.g. `https://api-dev.los.delightech.asia/api/v1` (not the los_web site)
   - `customerUsername` / `customerPin`: a LOS dev customer (phone + 4-digit PIN)
   - `staffUsername` / `staffPassword`: any LOS dev staff account
3. **Sign in by hand, step by step.** Each folder starts with the numbered sign-in steps, so you can see the flow. Every step saves the token the next one needs:

   | Folder | Step | What it does | Saves |
   | :--- | :--- | :--- | :--- |
   | Customer | 1. LOS login | LOS checks phone + PIN | `losCustomerToken` (LOS token, only for step 2) |
   | Customer | 2. Chat session | chat_backend verifies it and returns its own session | `customerToken` (1 h) |
   | Staff | 1. LOS login | LOS checks username + password | `losStaffToken` (LOS token, only for step 2) |
   | Staff | 2. LOS handoff | LOS issues a chat-only pass (2 min) | `staffHandoff` (only for step 3) |
   | Staff | 3. Chat session | chat_backend verifies it and returns its own session | `staffToken` (15 min) |

   Run the staff steps back to back (the handoff lasts 2 minutes). Then send any chat request in that folder: they inherit `Bearer {{customerToken}}` / `Bearer {{staffToken}}`, so leave their **Authorization** on *Inherit auth from parent*. Only these two tokens work on chat requests.
4. **When something fails**, the failing step shows a test named `reason: …` with LOS's or chat_backend's error, and it clears its own token and every later one, so nothing stale is sent. A chat request sent before its folder's chat session exists fails with **"No chat session yet: run … first"**. Repeat the steps when a session expires.

When the LOS team ships the chat handoff, set `LOS_HANDOFF_AUDIENCE=chat` and `LOS_HANDOFF_TOKEN_TYPE=chat-handoff` in `.env`, and `losHandoffPath` to `/admin/chat/handoff-token` in the Postman environment.

**Socket.io in Postman:** New → **Socket.IO**, URL `http://localhost:3000`, add the header `Authorization: Bearer <chat session>` (the `accessToken` from a customer or staff `/auth/session` response), and listen for `message:new` and `typing`. Apps should send the token in `auth.token` instead; the header is accepted for tools like Postman.

---

## Project Structure

```
.
├── docs/
│   ├── PROJECT_GUIDELINE_IMPROVEMENTS.md   # Module rules and design decisions — read before contributing
│   └── features/milestone_1.md             # Milestone 1 design: diagrams, tables, decisions
├── prisma/
│   ├── schema.prisma                       # Database models
│   └── migrations/                         # SQL migrations (committed)
├── generated/prisma/                       # Generated Prisma Client (git-ignored)
├── postman/                                # LOS dev collection, its environment template, sample.pdf
├── scripts/                                # dev-keys, dev-token, socket-smoke (dev only)
├── src/
│   ├── config/
│   │   ├── env.ts                          # Loads + validates .env (Zod)
│   │   ├── database.ts                     # Prisma Client singleton (PrismaPg adapter)
│   │   ├── los-keys.ts                     # LOS public key (JWKS or PEM)
│   │   ├── socket.ts                       # Socket.io server (attached in index.ts)
│   │   └── logger.ts                       # Pino logger
│   ├── shared/
│   │   ├── errors/AppError.ts              # AppError + 400/401/403/404/409/413/415 subclasses
│   │   ├── middleware/                     # auth, validate, upload (multer), error handlers
│   │   ├── storage/                        # StorageDriver interface + LocalDiskDriver, allowed media types
│   │   └── types/express.d.ts              # Types req.user
│   ├── modules/
│   │   ├── auth/                           # LOS token verification, staff session exchange
│   │   └── chat/
│   │       ├── shared/                     # repositories, attachment service, events, shared schemas
│   │       ├── customer-chat/              # /customer/api/v1/chat
│   │       ├── staff-chat/                 # /agent/api/v1/chat
│   │       └── realtime/                   # Socket.io handshake + typing
│   ├── routes/v1.ts                        # customerV1Router + agentV1Router
│   ├── app.ts                              # Express app + middleware chain
│   └── index.ts                            # Starts HTTP + Socket.io, graceful shutdown
├── prisma.config.ts
├── tsconfig.json
├── .env.example                            # Template for .env (committed)
└── .env                                    # Your local values (git-ignored)
```

### Request flow

```
Request → helmet → cors → pino-http (log) → express.json
        → route: authenticateCustomer / authenticateStaff → validate (Zod)
        → controller → service → repository → Prisma
        → service publishes the event → Socket.io rooms
        → errorHandler (turns any thrown AppError / Prisma error into the JSON error shape)
```

---

## Adding a New Feature Module

Each module is layered **routes → controller → service → repository**:

| File | Responsibility |
| :--- | :--- |
| `<name>.schema.ts` | Zod schemas for body/query/params (no exported types; request DTOs are paused) |
| `<name>.repository.ts` | `class XRepository { constructor(db) }`: Prisma queries only, each with a `select` whitelist; no business rules, no throwing |
| `<name>.service.ts` | `class XService { constructor(repository, ...) }`: business rules; throws `AppError` subclasses; no `req`/`res` |
| `<name>.controller.ts` | `class XController { constructor(service) }`: reads `req`, calls the service, sends the envelope. Handlers are arrow-function properties. |
| `<name>.routes.ts` | **Composition root**: creates repository → service → controller once, then wires middleware → handler |
| `index.ts` | Exports the routers (and any instance other code needs, e.g. `authService`) |

A module with two audiences (like `chat`) has a `shared/` folder for repositories plus one `<audience>-<module>/` folder per audience, each with its own `routes.ts`. Repository methods that take part in a transaction accept an optional `tx` (`DbClient`) argument; services start the transaction with the repository's `transaction()` method.

See [docs/PROJECT_GUIDELINE_IMPROVEMENTS.md](docs/PROJECT_GUIDELINE_IMPROVEMENTS.md) for the rules and why.

Conventions:

- Import with path aliases (`@config/...`, `@shared/...`, `@modules/...`) and `.js` extensions.
- Use the logger, never `console.log`.
- Read config from `@config/env.js`, never `process.env` directly.

---

## Scripts & Command Reference

| Task | Command |
| :--- | :--- |
| Start dev server (auto-restart on change) | `pnpm run dev` |
| Start server (no watch) | `pnpm start` |
| Type check | `pnpm run typecheck` |
| Create the dev LOS key pair | `pnpm run dev:keys` |
| Print a dev LOS token | `pnpm run dev:token customer --user 101 --name sokha` / `pnpm run dev:token handoff --user 201 --name dara --role CREDIT_SUPPORT_OFFICER` (`--expired`, `--aud`, `--type` to test failures) |
| Socket.io checks | `pnpm run smoke:socket` |
| Create + apply a migration | `pnpm exec prisma migrate dev --name <name>` |
| Generate Prisma Client | `pnpm exec prisma generate` |
| Migration status | `pnpm exec prisma migrate status` |
| Reset local database | `pnpm exec prisma migrate reset` |
| Start / stop PostgreSQL | `brew services start postgresql@17` / `brew services stop postgresql@17` |

---

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `Invalid environment variables:` on startup | A value in `.env` is missing or wrong; the message says which. Compare with `.env.example`. |
| `ENOENT ... keys/dev-los-public.pem` on startup | Run `pnpm run dev:keys`, or set `LOS_JWKS_URI`. |
| Every request is `401 Invalid token` | The token was signed with a different key than the server checks with (e.g. dev tokens against `LOS_JWKS_URI`, or keys regenerated with `--force` while the server was running). |
| `Cannot find module '.../generated/prisma/client.js'` | Run `pnpm exec prisma generate`. |
| `prisma migrate dev` says the environment is non-interactive | Run it in a normal terminal. In scripts, generate the SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration folder and apply it with `prisma migrate deploy`. |
| `P1001: Can't reach database server` | PostgreSQL isn't running: `brew services start postgresql@17`. |
| `P1003: Database chat_backend does not exist` | Create it (see [Getting Started](#2-create-the-database)). |
| `pnpm dlx tsc` prints "This is not the tsc command you are looking for" | Use `pnpm exec tsc`; `dlx` downloads an unrelated package named `tsc`. |
| Prisma CLI is version 8.x | `pnpm add prisma` without a version installs the Prisma 8 release candidate. Keep `prisma`, `@prisma/client` and `@prisma/adapter-pg` pinned to the **same** 7.x version (currently `7.10.1`). |

---

## How This Project Was Created (from scratch)

For reference, or to start a similar project. You do **not** need these steps to work on this repo; use [Getting Started](#getting-started-cloning-this-repo).

### 1. Initialize the project

```bash
pnpm init
```

Set `"type": "module"` in `package.json` to use ES Modules.

### 2. TypeScript & tooling

```bash
pnpm add -D typescript tsx @types/node
pnpm exec tsc --init
```

Replace the generated `tsconfig.json` with the one in this repo. Key points:

- `"module"` / `"moduleResolution"`: `"nodenext"`. Imports need `.js` extensions.
- `"types": ["node"]`. The generated default `[]` hides Node types (`process.env` becomes an error).
- `"paths"` defines the `@config/*`, `@shared/*` and `@modules/*` aliases; `tsx` resolves them at runtime.
- `"noEmit": true`. `tsx` runs TypeScript directly; `tsc` is only used for type checking.

### 3. Prisma

Pin the CLI, client and adapter to the **same version**:

```bash
pnpm add -D prisma@7.10.1 @types/pg
pnpm add @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 dotenv
pnpm approve-builds        # select @prisma/engines and prisma → saved in pnpm-workspace.yaml
pnpm exec prisma init --datasource-provider postgresql
```

- In Prisma 7 the database URL lives in `prisma.config.ts` (`datasource.url`), **not** in the schema's `datasource` block.
- The schema uses the new `prisma-client` generator with `output = "../generated/prisma"`.
- Delete any AI skill folders `prisma init` created (`.agents/`, `.windsurf/`, `skills-lock.json`).

### 4. Express, auth, real-time & middleware

```bash
pnpm add express cors helmet jose socket.io multer zod pino pino-http
pnpm add -D @types/express @types/cors @types/multer socket.io-client pino-pretty
```

| Package | Used for |
| :--- | :--- |
| `express` | HTTP server and routing (v5) |
| `jose` | Verifying LOS RS256 tokens (JWKS or PEM) and signing chat session tokens |
| `socket.io` | Real-time events on the same port |
| `multer` | Multipart attachment uploads |
| `zod` | Request and environment validation (v4) |
| `helmet`, `cors` | Security headers and cross-origin access |
| `pino`, `pino-http`, `pino-pretty` | Structured logging (pretty output in development) |
| `socket.io-client` (dev) | The Socket.io smoke test |

The first version used Passport + bcrypt + jsonwebtoken for local email/password login; those were removed when identity moved to LOS.
