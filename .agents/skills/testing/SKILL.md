---
name: testing
description: Write and run tests for the frontend (Vitest) and backend, and verify changes with the repo's check pipeline. Use when adding tests or validating a change.
---

# Testing

## When to use
Any behaviour change, bug fix, or when asked to verify work.

## Required knowledge
Vitest 5 (frontend `pnpm test`), `pnpm check` = typecheck + oxlint + `check:fsd` + Prettier + tests (CI also runs `pnpm build`). Backend has no test runner, lint or format scripts yet, so `pnpm check` only typechecks it; run `npx prettier --check backend/src` manually.

## Workflow
1. Write/adjust a test that fails for the bug or new behaviour.
2. Implement; run the focused test (`pnpm --filter @chat-dashboard/frontend exec vitest run <path>`), then `pnpm check`.
3. Report real results, including failures; do not claim a pass you did not see.

## Architecture rules
Co-locate tests (`store.test.ts` beside `store.ts`). Frontend: test stores/actions/selectors, mock `wsClient`, reset state in `beforeEach`. Backend: unit-test services with mocked repositories; integration-test repositories on a disposable PostgreSQL database. Existing examples: `entities/*/model/store.test.ts`, `shared/api/ws/protocol.test.ts`, `app/providers/realtime.test.ts`.

## Coding standards
Deterministic (fake timers, no network), one behaviour per test, descriptive names, no snapshot of markup.

## Testing requirements
New protocol events need validator tests; permission/conflict logic needs denied-path tests; bug fixes need a regression test.

## Common mistakes
Testing implementation details/markup, leaking store state between tests, hitting a real DB or Redis in unit tests, deleting tests to get green.
