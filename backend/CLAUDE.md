# CLAUDE.md

Express 5 + TypeScript + Prisma 7 (PostgreSQL) + Socket.io chat service for the LOS system. Customers chat from the Flutter app; **every LOS staff member** reads and answers every conversation from `chat_web`, an iframe inside `los_web`. There are no tickets or assignment (removed 2026-11-06; the parked design is in [docs/backend/features/parked/tickets.md](../docs/backend/features/parked/tickets.md)). **LOS owns identity**: this service stores no passwords and verifies LOS RS256 tokens with the LOS public key. Package manager is **pnpm**, never npm or yarn.

Full rules and the reasons behind them: [docs/backend/backend_project_guidelines.md](../docs/backend/backend_project_guidelines.md). Current design (diagrams, tables): [docs/backend/features/milestone_1.md](../docs/backend/features/milestone_1.md). Setup and API usage: [README.md](README.md). [docs/backend/architecture.md](../docs/backend/architecture.md) and `docs/mobile/` describe the **other** systems (LOS backend, Flutter app), not this repo.

## Commands

```bash
pnpm run dev            # tsx watch src/index.ts
pnpm run typecheck      # tsc (noEmit)
pnpm exec prisma migrate dev --name <change>   # create + apply a migration
pnpm exec prisma generate                      # regenerate the client (migrate dev does NOT do this in Prisma 7)
pnpm run dev:keys       # dev RSA key pair standing in for LOS (keys/, git-ignored)
pnpm run dev:token customer|handoff [--user N --name X --role R --expired --aud A --type T]
pnpm run smoke:socket   # Socket.io end-to-end checks (server must be running)
pnpm run openapi        # regenerate backend/openapi.json (commit it: other repos read it)
```

API docs: Swagger UI at `http://localhost:3000/docs` and the spec at `/docs/openapi.json`, **outside production only** (`zod-openapi` and `swagger-ui-express` are dev dependencies, loaded by a dynamic import in `app.ts`). Covered so far: the auth module.

- Use `pnpm exec <bin>` for local binaries. `pnpm dlx tsc` runs the wrong package.
- `prisma`, `@prisma/client` and `@prisma/adapter-pg` are pinned to **7.10.1**. Don't upgrade (plain `pnpm add prisma` pulls the 8.x RC).
- Verify a change with `pnpm run typecheck`, `pnpm run smoke:socket` (10 checks, needs the dev key `LOS_PUBLIC_KEY_PATH=keys/dev-los-public.pem`), and the LOS dev Postman collection `postman/chat_backend_los_dev.postman_collection.json` (real LOS dev logins). Target another port with `API_BASE_URL=http://localhost:3100`.
- `prisma migrate dev` refuses to run in a non-interactive shell. There, write the SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql` and apply it with `prisma migrate deploy`.

## Architecture

```
src/
├── index.ts        # starts HTTP, attaches Socket.io (io.attach), registers socket handlers, graceful shutdown
├── app.ts          # helmet, cors, pino-http, json, /health, /customer/api/v1, /agent/api/v1, error handlers
├── routes/v1.ts    # customerV1Router (/auth, /chat) and agentV1Router (/auth, /chat)
├── config/         # env (Zod), database (Prisma + PrismaPg, DbClient), los-keys (JWKS/PEM), socket (io), logger
├── shared/         # errors/AppError.ts, middleware (auth, validate, upload, error), storage/, types/express.d.ts
└── modules/
    ├── auth/       # LOS token verification, staff handoff → chat session; exports authService + authenticate* middleware
    └── chat/
        ├── shared/         # conversation/attachment repositories, MessageService, AttachmentService, chat-events, chat.schema
        ├── customer-chat/  # /customer/api/v1/chat
        ├── staff-chat/     # /agent/api/v1/chat
        └── realtime/       # Socket.io handshake + typing (chat-socket.routes.ts is its composition root)
```

Each module is layered: **routes → controller → service → repository**.

| File | Responsibility |
| :--- | :--- |
| `<name>.schema.ts` | Zod schemas for body / query / params |
| `<name>.repository.ts` | `class XRepository { constructor(db) }`: Prisma queries only, each with a `select` whitelist. No business rules, no throwing. |
| `<name>.service.ts` | `class XService { constructor(repository, ...) }`: business rules; throws `AppError` subclasses; never touches `req`/`res`. |
| `<name>.controller.ts` | `class XController { constructor(service) }`: reads `req`, calls the service, sends the response. |
| `<name>.routes.ts` | The **composition root**: creates the instances and wires middleware → handler. |
| `index.ts` | Exports only the routers, plus any instance outside code needs (e.g. `authService`, `authenticateCustomer`). |
| `<name>.openapi.ts` | Optional, documentation only: exports `<name>OpenApiPaths` (zod-openapi). Request bodies reuse `<name>.schema.ts`; response schemas are written here with `.meta({ id })` and the helpers in `@shared/openapi/openapi.common.ts`. Mark public routes `security: []`. Spread it into `src/docs/openapi.ts`, imported directly (not via `index.ts`, which would start Prisma). Never imported by runtime code. |

### Dependency injection rules

```typescript
// <name>.routes.ts — the only place `new` appears
const attachmentService = new AttachmentService(new AttachmentRepository(prisma), new LocalDiskDriver(env.UPLOAD_DIR));
const messageService = new MessageService(conversationRepository, attachmentService, new SocketChatEventPublisher(io));
const staffChatController = new StaffChatController(new StaffChatService(conversationRepository, messageService));
```

1. Every dependency comes in through the constructor, **with no default values** (`= new X()` is forbidden).
2. Repositories receive `DatabaseClient` (`constructor(private readonly db: DatabaseClient)`). They never import `prisma` directly.
3. `new` only appears in `*.routes.ts` (including `realtime/chat-socket.routes.ts`). Services and controllers import the layer below with `import type`.
4. Dependencies are `private readonly`.
5. Controller handlers are **arrow-function properties** (`create = async (req, res) => {…}`) so `this` stays bound when passed to the router.
6. Code outside a module talks to its service through the instance exported from `index.ts`, never to its repository.
7. **Transactions:** a repository exposes `transaction(fn)`, and its methods that may run inside one take an optional last argument `tx: DbClient = this.db`. Services pass `tx` through; they never import Prisma.
8. **Side effects behind interfaces:** services publish real-time events through `ChatEventPublisher` and store files through `StorageDriver`; the routes file picks the implementation (`SocketChatEventPublisher`, `LocalDiskDriver`).
9. Middleware that needs a service is built by a factory (`createAuthMiddleware(authService)`) inside the owning module's routes file, which avoids circular imports.

### Folder layout

- One audience → a flat module folder (`auth/auth.*.ts`).
- Two or more audiences → `<audience>-<module>/` sub-folders plus `shared/`. Audiences: `customer` (`/customer/api/v1`, Flutter app), `agent` (`/agent/api/v1`, chat_web staff; the folder is named `staff-<module>`), `guest` (no login). Each sub-folder's `routes.ts` is its own composition root.
- Tests go in `__tests__/` next to the code they test. Dev-only scripts go in `scripts/`.

## Auth

"Sign in with LOS": LOS is the identity provider (it alone checks passwords); chat_backend verifies an LOS-signed token, maps the person to `chat_users` (find-or-create by `(los_user_id, type)`), and issues **its own session**. LOS tokens are accepted **only** by the two `/auth/session` endpoints. Spec for the LOS team and the apps: [docs/backend/features/auth/los-chat-handoff.md](../docs/backend/features/auth/los-chat-handoff.md).

- **Customer:** `POST /customer/api/v1/auth/session { losToken }`. `exchangeCustomerToken` checks RS256 signature, `exp`, `iss=LOS_ISSUER`, `aud=LOS_CUSTOMER_AUDIENCE`, `type==='customer'`, `tokenType==='access'` and a 32-bit `userId`, then upserts and returns a customer session (`CHAT_CUSTOMER_SESSION_EXPIRES_IN`).
- **Staff:** `POST /agent/api/v1/auth/session { handoffToken }`. `exchangeHandoff` checks the chat-only LOS handoff (`aud=LOS_HANDOFF_AUDIENCE`, `tokenType=LOS_HANDOFF_TOKEN_TYPE`, `type==='staff'`); the token's `role` claim is validated against the `roles` table (`type=STAFF`) — unknown or customer roles are rejected with 401. Any known LOS staff role is allowed. `role_id` is stored on `chat_users` as a FK. los_web passes the handoff to the iframe by postMessage; the real LOS staff token never leaves los_web.
- **Sessions:** HS256 with `CHAT_SESSION_SECRET`, `iss=chat-backend`, one audience per type (`chat-customer` / `chat-staff`), so a customer session is rejected on staff routes and vice versa. Stateless: `verifySession(token, type)` rebuilds `req.user` from the claims without a database call.
- **Refresh tokens** (`refresh_tokens`, both types): `/auth/session` also returns an opaque `refreshToken` (only its SHA-256 is stored) and `refreshExpiresAt`. `POST /auth/refresh { refreshToken }` rotates it (old one revoked, new one in the same `family_id`, same absolute `expires_at`, `CHAT_REFRESH_EXPIRES_IN` = 24h) and returns a new access token; reusing a revoked token revokes the whole family. `POST /auth/logout { refreshToken }` revokes the family (idempotent). A refresh token only works on its own audience's endpoint. Refresh does not consult LOS. Expired rows are deleted on the user's next login.
- Middleware: `authenticateCustomer`, `authenticateStaff` (from `@modules/auth/index.js`). Read the user with `getAuthUser(req)`: `{ id (ChatUser.id), losUserId, type: 'customer'|'staff', username }`. The socket handshake accepts a chat session of either type. `chat_users.type` copies `roles.type` (kept for the unique key, because LOS customers and staff are separate ID spaces) and the FK `(role_id, type) → roles(id, type)` stops them disagreeing. Messages have no sender type column: read `sender.type`.
- LOS facts: tokens are RS256; access tokens carry no `kid`; JWKS is `https://api.los.delightech.asia/api/v1/guest/.well-known/jwks.json`; LOS ids are MySQL `INT`. The LOS team still has to add `POST /admin/chat/handoff-token` (`aud:'chat'`).
- Not done yet: LOS revocation checks (LOS Redis). A revoked LOS token works until it expires, and a refresh token until its 24h limit.
- **Current development mode: real LOS dev** (`LOS_JWKS_URI` = the LOS dev JWKS, key `kid 68abf7cb51cb96d1`). Until LOS issues `aud:'chat'`, dev borrows the analytics-dashboard handoff (`LOS_HANDOFF_AUDIENCE=analytics-dashboard`, `LOS_HANDOFF_TOKEN_TYPE=dashboard-handoff`); `env.ts` refuses that in production. Manual tests: `postman/chat_backend_los_dev.postman_collection.json` (real logins; the only Postman collection). Customer folder: 1. LOS login → 2. Chat session; Staff folder: 1. LOS login → 2. LOS handoff → 3. Chat session, run by hand (the user wants to see the flow). Each step saves its token on success and clears it and later ones on failure; chat requests inherit `Bearer {{customerToken}}` / `{{staffToken}}` from their folder. The generator lives outside the repo, so edit the JSON directly if needed. `smoke:socket` needs `LOS_PUBLIC_KEY_PATH` instead.

## Chat rules

- One permanent `conversations` row per customer, created on first open (`upsertForCustomer`); `last_message_at` drives the staff inbox order.
- Every staff member can list (`GET /chat/conversations`), read and reply to (`POST /chat/conversations/:id/messages`) every conversation. No assignment, no status.
- Sending is shared by both audiences in `MessageService.send(user, resolveConversation, input)`: idempotency by `(sender_id, client_message_id)`, attachment check, insert, `touch`, then `message:new`. The customer side resolves the conversation by upsert, the staff side by id (404 if unknown).

## Requests, responses, errors

- **Validation:** every route with input uses `validate({ body?, query?, params? })` with a Zod schema. `validate()` replaces `req.body` / `req.query` / `req.params` with the parsed values. For multipart routes, `uploadSingle('file')` runs **before** `validate`.
- **Request DTOs are paused.** Schema files export no `z.infer` types; handlers pass `req.body` / `req.query` through and services take `input: any`. Route ids are read as `req.params.id as string`. Don't re-add `z.infer` types unless asked; if asked, mark each with `// dto`.
- **Response DTOs are deferred.** Each repository's `select` constant (`messageSelect`, `conversationSelect`, `staffConversationSelect`, `chatUserSelect`, …) is the response contract. Never return a model without a `select`. `storageKey` and other internal fields stay out of response selects.
- **Response envelope:**
  ```typescript
  res.status(200).json({ status: 'success', data });
  res.status(200).json({ status: 'success', data: items, meta: { total, page, size, totalPages } }); // paged lists
  res.status(200).json({ status: 'success', data: messages, meta: { size, nextCursor } });       // message history (cursor)
  res.status(201).json({ status: 'success', data: created });
  ```
- **Messages:** history is ordered by `messages.seq` (not `created_at`: rows written in one transaction share a timestamp), newest first; `?before=<message id>` pages backwards. `clientMessageId` makes sends idempotent per sender.
- **Errors:** throw an `AppError` subclass (`BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `PayloadTooLargeError` 413, `UnsupportedMediaTypeError` 415) from `@shared/errors/AppError.js`, mostly from services. Never `res.status(4xx).json(...)`, and don't try/catch just to reformat; Express 5 forwards async errors. The global handler returns `{ status: 'error', error: { code, message, details? } }`, maps Prisma `P2002` → 409 and `P2025` → 404, and turns anything else into a logged 500. New status → new subclass in `AppError.ts`.

## Real-time

- `io` is created in `@config/socket.js` and attached in `index.ts`; services never touch it directly (they get a `ChatEventPublisher`).
- Rooms: `user:<chatUserId>` for everyone, `staff` for all staff. No client-side room joins.
- Events: `message:new` (to the customer's room + `staff`) and `typing` (both ways; the only client → server event). All writes go through REST.

## Code conventions

- Import with path aliases (`@config/*`, `@shared/*`, `@modules/*`) and **`.js` extensions** (`nodenext`). Use `import type` for type-only imports (`verbatimModuleSyntax`).
- Read config from `env` in `@config/env.js`, never `process.env` (new variables go in the Zod schema there and in `.env.example`). `scripts/` may read `process.env`.
- Log with the Pino `logger`, never `console.log`.
- Comments only where they explain *why*, using the `// * ` style already in the code.
- Prisma Client is generated into `generated/prisma` (git-ignored); import it via `@config/database.js`.
- Schema changes: edit `prisma/schema.prisma` (snake_case columns via `@map` / `@@map`, UUID ids), no Postgres enums (a `text` column + a CHECK constraint in the migration, with the allowed values in `src/shared/types/chat-types.ts`) → migration → `generate`. Never edit an applied migration.

## Constraints

- The user manages Postgres and `.env` themselves (local Homebrew Postgres 17, `postgres` superuser, DBeaver as the UI). Don't create DB users, don't edit `.env`, and never print `CHAT_SESSION_SECRET`, the DB password or private keys. Never commit `.env` or `keys/`. To run the server with settings `.env` lacks, pass them on the command line.
- No Docker, no Prisma Studio.
- Commit or push only when asked.

## Known issues

- Response/error shape vs the LOS API is an open decision; don't change the envelope without asking.
- Attachment MIME types are the client-declared ones (no content sniffing yet).
