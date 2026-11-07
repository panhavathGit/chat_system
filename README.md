# Chat System

Customer chat for the LOS system. Customers chat from the Flutter app; LOS staff read and answer every conversation from `chat_web`, which is embedded as an iframe in `los_web`.

pnpm monorepo:

| Package | Folder | What it is |
| --- | --- | --- |
| `@chat-system/frontend` | [frontend/](frontend/) | `chat_web`: React 19 + Vite staff UI, Feature-Sliced Design |
| `@chat-system/backend` | [backend/](backend/) | `chat_backend`: Express 5 + Prisma 7 (PostgreSQL) + Socket.io. Setup, env and API: [backend/README.md](backend/README.md) |

Shared docs are in [docs/](docs/) (`backend/`, `frontend/`, `mobile/`).

## Getting started

Requires Node 22 and pnpm (versions pinned in `.mise.toml` / `package.json`).

```sh
pnpm install
```

**Backend:** set up `backend/.env` from `backend/.env.example` (see [backend/README.md](backend/README.md)), then:

```sh
pnpm db:validate
pnpm db:migrate
pnpm db:generate     # Prisma 7: migrate does not regenerate the client
pnpm dev:backend     # http://localhost:3000
```

**Frontend:** create `frontend/.env` and run `pnpm dev`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_TRANSPORT` | `mock` | `chat-backend` uses the real API + Socket.io; anything else uses the in-browser mock |
| `VITE_CHAT_API_URL` | `http://localhost:3000` | chat_backend base URL |
| `VITE_AUTH_MODE` | `standalone` | `embedded` when running inside `los_web` |
| `VITE_LOS_API_URL` | – | LOS API base URL |
| `VITE_LOS_HANDOFF_PATH` | `/admin/dashboard-embed/handoff-token` | LOS staff handoff endpoint |
| `VITE_LOS_WEB_ORIGIN` | – | `los_web` origin; required when `VITE_AUTH_MODE=embedded` |

Integration contract: [docs/frontend/backend_integration.md](docs/frontend/backend_integration.md).

## Scripts (run from the root)

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `preview` | Frontend Vite dev server, build, preview |
| `pnpm dev:backend` | Backend in watch mode |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm lint` / `lint:fix` | oxlint (frontend) |
| `pnpm format` / `format:check` | Prettier (frontend) |
| `pnpm check:fsd` | Steiger + layer-boundary check (frontend) |
| `pnpm test` | Vitest (frontend) |
| `pnpm check` | All of the above checks |
| `pnpm db:validate` / `db:migrate` / `db:generate` | Prisma (backend) |
