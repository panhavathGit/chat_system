---
name: code-review
description: Review changes in this repo for correctness, architecture compliance, security and test coverage. Use when reviewing a diff, PR, or your own work before finishing.
---

# Code review

## When to use
Before reporting work complete, and when asked to review a diff or PR.

## Required knowledge
`AGENTS.md`, `FSD.md`, `docs/chat-logic-design.md`, the protocol file, and the schema.

## Workflow
1. Read the full diff and the surrounding code.
2. Walk the checklist below; verify claims by reading code, not by assumption.
3. Run `pnpm check`.
4. Report findings by severity (blocking / should-fix / nit) with file:line and a concrete fix.

## Checklist (architecture rules)
- Frontend: layer direction, `index.ts`-only cross-slice imports, no feature→feature, no direct `wsClient` in components.
- Backend: Routes → Controller → Service → Repository; Prisma only in repositories; transactions in services; `.js` import extensions.
- Contract: protocol, validator, realtime routing, mock server and docs changed together.
- Data: migration present, constraints.sql respected, docs/dbml updated, no invented fields.
- Docs claim only what exists.

## Coding standards
Correctness first (races, idempotency, error paths), then security (validation, authz in services, no secrets/logging of tokens), then simplicity. Skip style nits Prettier/oxlint already enforce.

## Testing requirements
Behaviour changes have tests at the right layer; denied-path and conflict cases covered; tests assert behaviour, not markup.

## Common mistakes
Approving without running checks, flagging pre-existing code as new, suggesting rewrites of working features, missing one half of a two-sided contract change.
