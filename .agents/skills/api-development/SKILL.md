---
name: api-development
description: Design and implement REST endpoints in the Express 5 backend (routes, validation, errors, responses). Use when adding or changing anything under /api.
---

# API development

## When to use

New or changed HTTP endpoints, request validation, error responses, CORS/security middleware.

## Required knowledge

Express 5 routers, zod 4, helmet/cors, `AppError` subclasses in `backend/src/shared/errors/AppError.ts`, `validate()` and `error-handler.middleware.ts` in `shared/middleware/`. Response shapes: `docs/api-response-contracts.md`. Only `GET /api/health` exists today; chat traffic is meant to go over WebSocket, so confirm REST is the right channel.

## Workflow

1. Check `docs/chat-logic-design.md` and the protocol for an existing definition; do not invent endpoints.
2. Define zod schemas in `<name>.schema.ts` and apply them with `validate({ params, query, body })` in the routes file.
3. Add `modules/<name>/<name>.routes.ts`, mount it in `src/routes.ts` under `/api`.
4. Controller calls one service function and returns JSON.
5. Test status codes and error shapes; document the endpoint (README or docs).

## Architecture rules

Routes only map paths to controller methods; controllers parse + respond; services/repositories never see `req`/`res`. Authenticated routes use middleware (see `authentication-security`).

## Coding standards

Plural nouns, JSON bodies, camelCase fields matching the protocol DTOs. Responses use the envelopes in `docs/api-response-contracts.md`. Use 400/401/403/404/409/503 meaningfully; 500 never exposes internals.

## Testing requirements

Test routes with HTTP requests against the exported `app` (`src/app.ts` does not listen) and mocked services. No test runner or HTTP test library is installed yet; adding Vitest (+ supertest) is part of the first endpoint PR.

## Common mistakes

Skipping validation, returning Prisma rows directly (map to DTOs), duplicating business rules in controllers, inventing response shapes the frontend does not consume.
