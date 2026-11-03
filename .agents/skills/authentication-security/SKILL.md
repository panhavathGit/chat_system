---
name: authentication-security
description: Implement or review authentication, session handling, authorization, input validation and secret handling. Use for login/session work, permission checks, and any security-sensitive change.
---

# Authentication & security

## When to use
Auth handshake, sessions, role/permission checks, password handling, CORS/helmet, env/secrets, security review.

## Required knowledge
Design in `docs/chat-logic-design.md` §3 and §6; models `User`, `Session`, `UserRole` (`CUSTOMER`, `AGENT`, `SUPERVISOR`, `ADMIN`). **Authentication is owned by a separate service/repo.** This backend is only a consumer: it never issues tokens, hashes passwords or serves login. The external API contract is **not yet provided**; ask the user for it and do not guess.

## External auth contract (TBD, fill in when received)
Needed from the auth team: base URL; how tokens are verified (JWT + JWKS/shared secret, or an introspection endpoint); token claims (user id, role, expiry); whether roles match `UserRole`; how users map to local `User`/`Agent` rows (shared id?); logout/revocation behaviour; error codes; dev/test credentials.
Config goes in `config/env.ts` and `backend/.env.example` (names only, no values).

## Workflow
1. Re-read §3 (connection/auth) and §6 (permission matrix). §3 assumes this backend checks the local `sessions` table; that conflicts with external auth, so confirm before using `Session` and update the doc once the contract is known.
1a. Build against a thin `AuthClient` interface in `lib/` (verify token → `{ userId, role }`) so the real API can be plugged in and mocked in tests.
2. Implement in services/middleware, not only in the UI.
3. Add tests for allowed and denied cases.
4. Check nothing sensitive is logged or returned.

## Architecture rules
- Token validity (signature, expiry, revocation) is decided by the external auth service; never store raw tokens. The local `sessions` table may be unnecessary — do not write to it until confirmed.
- Dashboard socket accepts only `AGENT`/`SUPERVISOR`/`ADMIN`; customers use a separate channel.
- Authorization lives in services (ownership, role, handoff state); the DB backs it with CHECKs/unique indexes.
- Local `users.password_hash` should stay unused if auth is external.

## Coding standards
zod-validate all external input; parameterized queries only (Prisma or `$queryRaw` tagged templates); helmet + explicit CORS origins from `CORS_ORIGIN`; generic error messages for auth failures.

## Testing requirements
Test unauthenticated, wrong-role, not-owner and expired/revoked-session paths.

## Common mistakes
Reading, printing or committing `.env` values; trusting client-sent ids/roles; plaintext tokens in the DB; `$queryRawUnsafe`; UI-only permission checks; wildcard CORS with credentials.
