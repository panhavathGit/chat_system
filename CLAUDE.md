# CLAUDE.md

## Monorepo

pnpm workspace (`pnpm-workspace.yaml`). Run commands from the repo root.

- `frontend/` — `@chat-system/frontend`, React + Vite staff UI (`chat_web`). See [frontend/CLAUDE.md](frontend/CLAUDE.md) (Feature-Sliced Design rules).
- `backend/` — `@chat-system/backend`, Express 5 + Prisma 7 (PostgreSQL) + Socket.io chat service. See [backend/CLAUDE.md](backend/CLAUDE.md).
- `docs/` — shared docs:
  - `docs/backend/` — backend guidelines and feature designs (`features/`). `architecture.md` describes the **LOS backend**, not this repo.
  - `docs/frontend/` — frontend ↔ backend integration contract.
  - `docs/mobile/` — the Flutter customer app (another repo); reference only.

## Root scripts

- `pnpm dev` (frontend), `pnpm dev:backend`, `pnpm build`, `pnpm preview`
- `pnpm check` — typecheck, lint, FSD, format check and tests. Only the frontend has all of these; the backend only has `typecheck`, so verify backend changes as described in [backend/CLAUDE.md](backend/CLAUDE.md).
- `pnpm lint:fix`, `pnpm format`
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:validate` (backend Prisma)
