# Chat System

Customer chat for the LOS system. Customers chat from the Flutter app; LOS staff read and answer every conversation from `chat_web`, which is embedded as an iframe in `los_web`. Identity comes from LOS: this repo stores no passwords.

pnpm monorepo:

| Package | Folder | What it is |
| --- | --- | --- |
| `@chat-system/frontend` | [frontend/](frontend/) | `chat_web`: React 19 + Vite staff UI, Feature-Sliced Design |
| `@chat-system/backend` | [backend/](backend/) | `chat_backend`: Express 5 + Prisma 7 (PostgreSQL) + Socket.io. Full guide: [backend/README.md](backend/README.md) |
| | [docs/](docs/) | `backend/` designs and guidelines, `frontend/` integration contract, `mobile/` Flutter app reference |

## Prerequisites

- Node 22 and pnpm 10 (pinned in `.mise.toml` and `package.json`; `corepack enable` gives you the right pnpm)
- PostgreSQL 17 (`brew install postgresql@17`)
- Optional: DBeaver to browse the database, Postman for the LOS dev collection

## First-time setup (after cloning)

Run everything from the **repo root** unless a step says `cd backend`.

### 1. Install

```sh
pnpm install          # one install for both packages
```

### 2. Database

```sh
brew services start postgresql@17
psql -U postgres -c "CREATE DATABASE chat_backend;"
```

### 3. Backend config

```sh
cd backend
cp .env.example .env
openssl rand -base64 48     # paste the output into CHAT_SESSION_SECRET in backend/.env
pnpm run dev:keys           # dev RSA key pair standing in for LOS (backend/keys/, git-ignored)
cd ..
```

The defaults work locally with the dev key. To sign in with **real LOS dev accounts** instead, see [Developing against LOS dev](backend/README.md#developing-against-los-dev-real-logins).

### 4. Create tables and the Prisma client

```sh
pnpm db:migrate       # applies every migration (also seeds the roles and permissions)
pnpm db:generate      # Prisma 7: migrate does not generate the client for you
```

### 5. Frontend config

```sh
cp frontend/.env.example frontend/.env
```

Set `VITE_LOS_API_URL` to the LOS dev API to sign in as LOS staff. Set `VITE_TRANSPORT=mock` to work on the UI with no backend at all. Every variable is explained in [frontend/.env.example](frontend/.env.example).

### 6. Run

```sh
pnpm dev:backend      # http://localhost:3000  (check: curl http://localhost:3000/health)
pnpm dev              # http://localhost:5173  (second terminal)
```

## Scripts (from the root)

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `preview` | Frontend Vite dev server, build, preview |
| `pnpm dev:backend` | Backend in watch mode |
| `pnpm db:validate` / `db:migrate` / `db:generate` | Prisma (backend) |
| `pnpm typecheck` | `tsc` in both packages |
| `pnpm lint` / `lint:fix` | oxlint (frontend) |
| `pnpm format` / `format:check` | Prettier (frontend) |
| `pnpm check:fsd` | Steiger + layer-boundary check (frontend) |
| `pnpm test` | Vitest (frontend) |
| `pnpm check` | All of the checks above; run before pushing |

Backend-only tools (`dev:token`, `smoke:socket`, Prisma commands) run from `backend/`; see [backend/README.md](backend/README.md#scripts--command-reference).

## Where to read next

- Backend API, auth flow, real-time events, troubleshooting: [backend/README.md](backend/README.md)
- How the frontend talks to the backend: [docs/frontend/backend_integration.md](docs/frontend/backend_integration.md)
- Frontend structure rules (Feature-Sliced Design): [frontend/CLAUDE.md](frontend/CLAUDE.md)
