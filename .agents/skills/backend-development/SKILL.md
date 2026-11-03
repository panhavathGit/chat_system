---
name: backend-development
description: Build or change the Express 5 / TypeScript backend in backend/ using the Routes → Controller → Service → Repository → Prisma layering. Use for any server-side feature, service, repository or config work.
---

# Backend development

## When to use
Adding or changing anything under `backend/src/` (HTTP, services, repositories, config, Redis, jobs).

## Required knowledge
Express 5, TypeScript ESM (`NodeNext`), Prisma 7 with `@prisma/adapter-pg`, zod, ioredis. Read `docs/chat-logic-design.md` for intended behaviour. `src/*/health.*` is the reference slice.

## Workflow
1. Confirm the behaviour exists in `docs/chat-logic-design.md` / schema; if not, propose and document it first.
2. Add the layers bottom-up: repository → service → controller → route, registered in `routes/index.ts`.
3. Validate input with zod at the edge; map domain errors via `HttpError`/`middleware/error.ts`.
4. Add env vars to `config/env.ts` and `backend/.env.example` (placeholders only).
5. Run `pnpm --filter @chat-dashboard/backend build` and `npx prettier --check backend/src` (the backend has no lint/format scripts yet), plus `pnpm check`.

## Architecture rules
- `Routes → Controller → Service → Repository → Prisma`. Only repositories import `prisma/client.ts` (exception: `server.ts` disconnects it on shutdown).
- Services hold business rules and open transactions (`prisma.$transaction`); controllers hold no rules.
- One service function per use case. Services return data/events; they do not touch `res` or sockets.
- Export singletons/objects the way `health.*` does; relative imports end in `.js`.

## Coding standards
`strict` + `noUncheckedIndexedAccess`, no `any`, no `console.log` for flow control, async handlers without manual `try/catch` (Express 5 forwards rejections), typed DTOs derived from the protocol/schema.

## Testing requirements
Unit-test services with mocked repositories; test repositories/transactions against a real PostgreSQL test database. No backend test runner is configured yet — adding one (Vitest, matching the frontend) is part of the first backend feature PR.

## Common mistakes
- Calling Prisma from services/controllers.
- Forgetting `.js` extensions or editing `prisma/generated/`.
- Race-prone read-then-write instead of conditional `updateMany` in a transaction (see takeover flow, §5.4).
- Leaking internal errors or secrets in responses.
