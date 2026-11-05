# Backend structure

`backend/src/` is organised by domain module. Each module keeps the layering from AGENTS.md
(`routes → controller → service → repository → Prisma`) in one folder.

```
backend/
├── prisma/                  schema.prisma, migrations/, sql/constraints.sql (generated/ is git-ignored)
├── vitest.config.ts         aliases + coverage thresholds
└── src/
    ├── server.ts            http server, websocket attach, graceful shutdown
    ├── app.ts               express app: helmet, cors, request context, pino-http, json, /api, notFound, errorHandler
    ├── routes.ts            mounts every module router under /api
    ├── config/              env.ts (zod-validated env), cors.ts, database.ts (Prisma singleton), redis.ts,
    │                        logger.ts (pino), request-context.ts (AsyncLocalStorage requestId)
    ├── modules/
    │   └── health/          routes, controller, service, repository, types, index.ts, __tests__/  (reference module)
    ├── websocket/           websocket.server.ts (/ws, Redis chat:events fan-out, heartbeat)
    └── shared/
        ├── errors/          AppError.ts (AppError + subclasses)
        └── middleware/      validate, error-handler, not-found, request-context (+ __tests__/)
```

Import with aliases (`@config/*`, `@modules/*`, `@shared/*`, `@lib/*`); `build` runs `tsc && tsc-alias` so they
resolve in `dist/`. Within a module use relative `./` imports. Services are classes that receive their repository
through the constructor; wiring happens in `<name>.routes.ts`.

## Module layout

```
modules/<plural>/                e.g. conversations/
├── <singular>.routes.ts           route definitions: wires middleware, validation, controller
├── <singular>.controller.ts       Express handlers: extract inputs, call service, return JSON
├── <singular>.service.ts          business logic and transactions; no req/res, no Prisma
├── <singular>.repository.ts       Prisma queries only, no business logic; only file importing `@config/database.js`
├── <singular>.schema.ts           zod schemas: source of truth for request shapes and inferred TS types
├── <singular>.openapi.ts          OpenAPI path registrations (see below)
├── <singular>.types.ts            interfaces and type aliases not derived from zod
└── index.ts                       public surface (service + types); other modules import only this
```

Folder names are plural, file prefixes singular (`health` has no plural, so it keeps one name).
Create `schema`, `openapi` and `types` files only when a module needs them.

### OpenAPI (not wired yet)

`<name>.openapi.ts` registers paths with `@asteasolutions/zod-to-openapi`, reusing the zod schemas from
`<name>.schema.ts`. That package is not installed and no docs endpoint exists. When adopting it, add the dependency
(check zod 4 support), create a shared registry in `shared/openapi/`, and document how the spec is served, in one change.
Until then, do not add `.openapi.ts` files.

Rules: no `req`/`res` below controllers; a module never imports another module's repository; add a
`shared/<folder>` only when a second module needs it.

## Planned modules (map to existing Prisma models; create when the behaviour is designed)

| Module          | Prisma models                                         | Notes                                                                 |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| `users`         | `User`                                                | profile data only; credentials are owned by the external auth service |
| `agents`        | `Agent`                                               |                                                                       |
| `customers`     | `Customer`, `Application`, `ApplicationStatusHistory` |                                                                       |
| `conversations` | `Conversation`, `ConversationRead`                    | read state lives here until it grows                                  |
| `messages`      | `Message`                                             | delivery status transitions                                           |
| `assignments`   | `AgentConversation`                                   |                                                                       |
| `attachments`   | `SharedFile`                                          |                                                                       |
| `notifications` | `Notification`                                        |                                                                       |
| `settings`      | `Setting`                                             |                                                                       |
| `activity`      | `Activity`                                            |                                                                       |
| `ai-handoff`    | `Conversation` (`HandoffStatus`)                      | AI worker integration, designed in `chat-logic-design.md`             |

`auth` is **not** a module that issues tokens (external service, contract unknown); once the contract
is known it becomes a verifier middleware plus an `AuthClient`. Presence, receipts, internal notes,
tags, canned responses, automations, callbacks, calls, moderation and analytics have **no schema or
design yet**: propose them and update the schema, protocol and docs first.

## Websocket

`websocket.server.ts` is the transport. When handlers are added, split into
`websocket.auth.ts` (connection auth), `websocket.handler.ts` (dispatch: ws event → service),
`websocket.events.ts` and `websocket.rooms.ts`, and keep the contract in sync with
`frontend/src/shared/api/ws/protocol.ts`.
