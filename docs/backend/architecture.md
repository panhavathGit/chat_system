# LOS Backend v2

> Loan Origination System backend — a Node.js/Express + TypeScript REST API that drives the full lifecycle of a consumer loan, from customer registration and draft application through credit committee decision, disbursement, and repayment collection.

## Project Overview

LOS Backend v2 is the server-side engine for a digital lending platform. It exposes three API namespaces:

| Namespace   | Consumers                         | Auth required        |
| ----------- | --------------------------------- | -------------------- |
| `/guest`    | Public (mobile app, calculator)   | None                 |
| `/admin`    | Internal staff (web dashboard)    | JWT — staff token    |
| `/customer` | Registered borrowers (mobile app) | JWT — customer token |

The system manages the entire loan pipeline across five stages: draft review (S1), credit assessment (S2), offer acceptance (S3), disbursement (S4), and repayment collection (S5). Role-based access control determines which staff roles can act at each stage.

**Tech stack:** Node.js 22 · Express · TypeScript · Prisma ORM · MySQL · Redis · Firebase Admin SDK · Pino logging · Zod validation · Vitest

---

## RBAC Architecture & Staff Roles

LOS Backend v2 implements comprehensive role-based access control across all operations. The system defines 12 distinct staff roles, each with specific module and action permissions:

| Role                        | Department     | Purpose                    | Key Responsibilities                                           |
| --------------------------- | -------------- | -------------------------- | -------------------------------------------------------------- |
| `ADMIN`                     | —              | Super-admin                | Full system access, staff management, permission configuration |
| `OPERATION_SUPERVISOR`      | Operations     | Cross-functional oversight | Can access and manage tasks across all departments             |
| `CREDIT_SUPPORT_SUPERVISOR` | Credit Support | Team leadership            | Manages credit support officers, assigns leads and drafts      |
| `CREDIT_SUPPORT_OFFICER`    | Credit Support | Lead intake & draft review | Processes new leads and reviews draft applications (Stage 1)   |
| `CREDIT_SUPERVISOR`         | Credit         | Team leadership            | Supervises credit assessment officers                          |
| `CREDIT_ASSESSMENT`         | Credit         | Application evaluation     | Reviews applications and makes credit decisions (Stage 2)      |
| `CREDIT_COMMITTEE`          | Credit         | Final authority            | Approves or rejects loan offers                                |
| `ACCOUNTANT_SUPERVISOR`     | Accounting     | Team leadership            | Oversees disbursement and repayment accounting                 |
| `ACCOUNTANT_AP`             | Accounting     | Disbursements              | Manages loan disbursement and deposit processing (Stage 3)     |
| `ACCOUNTANT_AR`             | Accounting     | Collections                | Manages repayment collection (Stage 5)                         |
| `COLLECTION_SUPERVISOR`     | Collections    | Team leadership            | Oversees collection officers                                   |
| `COLLECTION_OFFICER`        | Collections    | Debt collection            | Manages overdue loan recovery                                  |

### Breaking Changes

The following role names have been **renamed for semantic clarity**:

| Previous Name      | New Name                                                       |
| ------------------ | -------------------------------------------------------------- |
| `SALES_OFFICER`    | [`CREDIT_SUPPORT_OFFICER`](#rbac-architecture--staff-roles)    |
| `SALES_SUPERVISOR` | [`CREDIT_SUPPORT_SUPERVISOR`](#rbac-architecture--staff-roles) |
| `CREDIT_OFFICER`   | [`CREDIT_ASSESSMENT`](#rbac-architecture--staff-roles)         |

**Functional Impact:** None — all permissions and access patterns remain identical. This is a terminology update only.

**API/Token Impact:** JWT tokens, API responses, and database seed data now use the new role names. This **requires updates in external systems** that reference role names.

### Migration Guide for External Systems

If your mobile app, dashboard, or external integrations store or reference old role names:

1. **Update JWT token handling** — new tokens will contain updated role strings
2. **Update UI/permission checks** — replace references to old role constants with new ones
3. **Update test fixtures** — replace old role names in test seeds and mocks
4. **Update integration tests** — ensure role filters use new role names

**TypeScript Example:**

```typescript
// OLD (before refactoring)
const allowedRoles = ['SALES_OFFICER', 'CREDIT_OFFICER'];

// NEW (after refactoring)
import { Role } from '@shared/middleware/rbac.middleware.js';
const allowedRoles = [Role.CREDIT_SUPPORT_OFFICER, Role.CREDIT_ASSESSMENT];
```

### Auto-Assignment Service & Module Context

The [`AutoAssignmentService`](src/shared/services/auto-assignment.service.ts) uses intelligent load-balancing to assign work. It supports **module context** to allow a single officer to be balanced independently across different workload sources:

```typescript
import { Role } from '@shared/middleware/rbac.middleware.js';

// Assign to a lead (loads counted from LEAD table)
await autoAssign.pickOfficer(Role.CREDIT_SUPPORT_OFFICER, { module: 'lead' });

// Assign to a draft (loads counted from APPLICATION table, DRAFT statuses)
// Same officer might be picked because draft load is separate from lead load
await autoAssign.pickOfficer(Role.CREDIT_SUPPORT_OFFICER, { module: 'draft' });

// Default: count loads from role's primary table (LEAD for CREDIT_SUPPORT, APPLICATION for credits)
await autoAssign.pickOfficer(Role.CREDIT_ASSESSMENT);
```

For details on role permissions, module access, and stage-based workflow, see [RBAC & Permission Middleware](docs/rbac.md).

---

## ⚠️ Before You Start

**Read [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md) first.** This document explains how we build things in this codebase: coding conventions, module structure, testing practices, and development workflows. New developers, feature implementations, and pull requests must follow these guidelines.

---

## Table of Contents

- **[📘 Project Guidelines](PROJECT_GUIDELINES.md)** — Start here
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Local Infrastructure (Docker)](#local-infrastructure-docker)
- [Environment Variables Reference](#environment-variables-reference)
- [Redis](#redis)
- [Document Storage](#document-storage)
- [Background Jobs](#background-jobs)
- [Firebase Push Notifications](#firebase-push-notifications)
- [Logging & Observability](#logging--observability)
- [Sentry Error Monitoring](#sentry-error-monitoring)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Development Setup](#development-setup)
- [Available Commands](#available-commands)
- [Modules](#modules)
- [Further Reading](#further-reading)

---

## Prerequisites

| Tool       | Recommended Version | Notes                          |
| ---------- | ------------------- | ------------------------------ |
| Node.js    | >= 22.x             | Required for ES module support |
| pnpm       | >= 9.x              | Install via `npm i -g pnpm`    |
| TypeScript | ^5.9                | Installed via devDependencies  |
| Prisma CLI | ^7.3                | Installed via devDependencies  |
| MySQL      | >= 8.0              | Required as the database       |
| Git        | >= 2.x              | Required for Husky git hooks   |

## Quick Start

The steps below take you from a clean clone to a running development server.

```bash
# 1. Clone the repository
git clone <repo-url> && cd los_backendv2

# 2. Install dependencies
pnpm install

# 3. Start backing services (MySQL, Redis, fake-GCS)
docker compose up -d

# 4. Create your local environment file
cp .env.example .env.development
# Edit .env.development — at minimum set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 5. Generate the Prisma client
pnpm prisma generate

# 6. Run migrations and seed reference data
make migrate
make seed

# 7. Start the development server
pnpm dev
```

The server starts on `http://localhost:3000` by default. Interactive API docs are available at `http://localhost:3000/api/docs`.

## API Documentation

Interactive API docs are auto-generated from Zod validation schemas using OpenAPI 3.0.

| URL              | Description               |
| ---------------- | ------------------------- |
| `/api/docs`      | Swagger UI (interactive)  |
| `/api/docs.json` | Raw OpenAPI 3.0 JSON spec |

**Published spec file.** `pnpm run openapi:export [outFile]` writes the same document to `openapi.json` (git-ignored) without a running server, a database or Redis. `pnpm run openapi:sync` writes it into the frontend checkout (`../los_frontendv2/docs/LOSv2Backend.json`, override with `FRONTEND_DIR`) and runs the frontend's `make openapi` to regenerate its types. Jenkins runs the sync on every `nak` build (it needs the frontend checkout on the same machine); the export stage also archives `openapi.json` and fails the build if spec generation breaks.

Zod schemas serve as the single source of truth for both request validation and API documentation. Each module has a `*.schema.ts` file (validation) and a `*.openapi.ts` file (path registration).

## Project Structure

```
los_backendv2/
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration (production)
├── tsconfig.test.json          # TypeScript configuration (tests, extends tsconfig.json)
├── vitest.config.ts            # Unit test configuration and coverage thresholds
├── vitest.integration.config.ts # Integration test configuration
├── prisma.config.ts            # Prisma configuration (reads DATABASE_URL)
├── nodemon.json                # Nodemon development configuration
├── README.md                   # Project documentation
├── docs/                       # Architecture and cross-cutting docs
│   ├── rbac.md                 # RBAC & permission middleware reference
│   ├── api-response-contracts.md # Standard response shapes and error classes
│   └── module-authoring-guide.md # Conventions for creating new modules
├── .github/
│   └── workflows/
│       └── test.yml            # CI: unit tests + coverage on push/PR to main
├── prisma/
│   ├── schema.prisma           # Generators and datasource only
│   ├── models/                 # Database models, one .prisma file per domain
│   └── seed.ts                 # Database seed script
├── src/
│   ├── index.ts                # Application entry point
│   ├── app.ts                  # Express app setup and middleware
│   ├── config/                 # Configuration modules
│   │   ├── database.ts         # Database connection setup
│   │   ├── env.ts              # Environment variable validation
│   │   ├── jwt.config.ts       # JWT configuration
│   │   ├── logger.ts           # Pino logger configuration
│   │   ├── openapi.ts          # OpenAPI registry and document generator
│   │   ├── security.ts         # Security settings (rate limiting, lockout)
│   │   └── sentry.ts           # Sentry SDK initialisation (imported as a side effect in app.ts)
│   ├── generated/              # Prisma generated types (gitignored, run `prisma generate`)
│   │   └── prisma/             # Prisma client and types
│   ├── jobs/                   # Background jobs
│   │   └── cleanup.job.ts      # Cleanup job scheduler
│   ├── lib/                    # Shared libraries
│   │   └── prisma.ts           # Prisma client instance
│   ├── modules/                # Feature modules (each has its own README)
│   │   ├── auth/
│   │   ├── applications/
│   │   ├── repayment/
│   │   ├── aba/
│   │   └── ...other modules
│   ├── routes/                 # Route aggregation
│   │   └── v1.ts               # API v1 routes
│   └── shared/                 # Cross-cutting concerns
│       ├── middleware/         # Express middleware (auth, validate, error, upload, set-file-url, rbac, permission)
│       ├── schemas/            # Shared Zod schemas (OpenAPI responses)
│       ├── types/              # Shared type definitions
│       ├── utils/              # Utility functions
│       └── errors/             # Error classes
├── tests/
│   ├── setup.ts                # Global test setup (runs before every unit test suite)
│   └── integration/            # Integration tests (require real DB, run separately)
└── .gitignore
```

## Local Infrastructure (Docker)

The project ships a `docker-compose.yml` that starts all three backing services needed for local development. No manual database or Redis installation is required.

```bash
docker compose up -d          # start all services in the background
docker compose down           # stop all services
docker compose down -v        # stop and delete all volumes (destructive)
```

### Services

| Service    | Container      | Image                    | Host port | Purpose                               |
| ---------- | -------------- | ------------------------ | --------- | ------------------------------------- |
| `mysql`    | `los_mysql`    | `mysql:8.0`              | `3306`    | Primary database                      |
| `redis`    | `los_redis`    | `redis:7.4.8-alpine`     | `6379`    | Token blacklist, rate limiting, cache |
| `fake-gcs` | `los_fake_gcs` | `fsouza/fake-gcs-server` | `4443`    | GCS emulator for local file storage   |

### Default credentials (development only)

| Variable         | Value        |
| ---------------- | ------------ |
| `MYSQL_USER`     | `delightech` |
| `MYSQL_PASSWORD` | `dlt2026`    |
| `MYSQL_DATABASE` | `losv2_db`   |

Set `DATABASE_URL=mysql://delightech:dlt2026@localhost:3306/losv2_db` in your `.env.development`.

### fake-gcs emulator

The `fake-gcs` service is only needed when `DOCUMENT_STORAGE_DRIVER=gcs` in your local env. Set `GCS_API_ENDPOINT=http://localhost:4443` to point the app at the emulator. When `DOCUMENT_STORAGE_DRIVER=local` (the default), `fake-gcs` can be omitted or left stopped.

```bash
# Start only the services you need
docker compose up -d mysql redis
```

## Environment Variables Reference

Copy `.env.example` to `.env.development` (or `.env.production`) before starting the application. The table below documents every variable the app reads from the environment.

| Variable                         |  Required   | Default                 | Description                                                                                                                                          |
| -------------------------------- | :---------: | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   |     Yes     | —                       | MySQL connection string (`mysql://user:pass@host:3306/db`)                                                                                           |
| `DATABASE_PORT`                  |     No      | `3306`                  | MySQL port. Set automatically in tests when `TESTCONTAINERS=1` (container ports are random)                                                          |
| `TESTCONTAINERS`                 |     No      | —                       | Test-runner only. `1` makes integration/e2e start throwaway MySQL + Redis containers instead of using `.env.test`                                    |
| `PORT`                           |     No      | `3000`                  | HTTP port the Express server listens on                                                                                                              |
| `NODE_ENV`                       |     Yes     | —                       | Runtime environment (`development` \| `production` \| `test`)                                                                                        |
| `REDIS_URL`                      |     Yes     | —                       | Redis connection URL (`redis://localhost:6379`)                                                                                                      |
| `REDIS_KEY_PREFIX`               |     No      | `los:`                  | Key namespace prefix applied to every Redis key                                                                                                      |
| `WORKERS_ENABLED`                |     No      | `true`                  | Run BullMQ workers (contract freeze/export, fraud sync) inside this process. Set `false` on an API-only container (see docs/background-jobs.md)      |
| `CONTRACT_RENDER_CONCURRENCY`    |     No      | `1`                     | Max concurrent Chromium contract renders per process                                                                                                 |
| `JWT_ACCESS_SECRET`              |     Yes     | —                       | Secret for signing access tokens (min 32 characters; generate with `openssl rand -base64 32`)                                                        |
| `JWT_REFRESH_SECRET`             |     Yes     | —                       | Secret for signing refresh tokens (min 32 characters)                                                                                                |
| `JWT_STAFF_ACCESS_EXPIRY`        |     No      | `1h`                    | Staff access token lifetime                                                                                                                          |
| `JWT_STAFF_REFRESH_EXPIRY`       |     No      | `1d`                    | Staff refresh token lifetime                                                                                                                         |
| `JWT_CUSTOMER_ACCESS_EXPIRY`     |     No      | `1h`                    | Customer access token lifetime                                                                                                                       |
| `JWT_CUSTOMER_REFRESH_EXPIRY`    |     No      | `30d`                   | Customer refresh token lifetime                                                                                                                      |
| `BCRYPT_SALT_ROUNDS`             |     No      | `12`                    | bcrypt work factor for password hashing                                                                                                              |
| `MAX_LOGIN_ATTEMPTS`             |     No      | `5`                     | Failed login attempts before account lockout                                                                                                         |
| `LOGIN_RATE_LIMIT_WINDOW_MS`     |     No      | `900000`                | Rate-limit window in ms (15 minutes)                                                                                                                 |
| `LOGIN_RATE_LIMIT_MAX_REQUESTS`  |     No      | `5`                     | Max login requests per window                                                                                                                        |
| `CORS_ORIGIN`                    |     No      | `http://localhost:3000` | Comma-separated list of allowed CORS origins                                                                                                         |
| `LOG_LEVEL`                      |     No      | `info`                  | Pino log level (`fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace`)                                                                        |
| `ENABLE_TOKEN_CLEANUP_JOB`       |     No      | `false`                 | Set to `true` to enable the daily expired-token cleanup cron                                                                                         |
| `ENABLE_STAFF_SESSION_RESET_JOB` |     No      | `false`                 | Set to `true` to enable the daily 8 PM staff session reset cron                                                                                      |
| `ENABLE_EARLY_PAYMENT_DISCOUNT`  |     No      | `false`                 | Enable early-payment discount in repayment math (OFF pending general-rollout approval)                                                               |
| `DOCUMENT_STORAGE_DRIVER`        |     No      | `local`                 | Storage backend: `local` (disk) or `gcs` (Google Cloud Storage / emulator)                                                                           |
| `DOCUMENT_PROXY_ADMIN`           |     No      | `false`                 | Serve documents via authenticated app proxy on admin routes instead of a direct storage URL                                                          |
| `DOCUMENT_PROXY_CUSTOMER`        |     No      | `false`                 | Serve documents via authenticated app proxy on customer routes instead of a direct storage URL                                                       |
| `GCS_BUCKET_NAME`                | Conditional | `los-documents`         | GCS bucket name (required when `DOCUMENT_STORAGE_DRIVER=gcs`)                                                                                        |
| `GCS_PROJECT_ID`                 | Conditional | `local`                 | GCP project ID (required when using real GCS)                                                                                                        |
| `GCS_API_ENDPOINT`               | Conditional | —                       | GCS emulator URL (e.g. `http://localhost:4443`); leave empty for real GCS                                                                            |
| `GCS_PUBLIC_BASE_URL`            |     No      | —                       | Override the public URL host for stored files (e.g. `https://storage.googleapis.com`)                                                                |
| `STORAGE_S3_ENDPOINT`            |     No      | GCS endpoint            | S3-compatible API endpoint for the `gcs` driver, e.g. `https://storage.daunpenhcloud.com`; default `https://storage.googleapis.com`                  |
| `PLASGATE_PRIVATE_KEY`           | Conditional | —                       | Plasgate SMS gateway private key                                                                                                                     |
| `PLASGATE_SECRET`                | Conditional | —                       | Plasgate SMS gateway secret                                                                                                                          |
| `PLASGATE_SENDER`                |     No      | `LuyLeun`               | SMS sender ID                                                                                                                                        |
| `ABA_MERCHANT_ID`                | Conditional | —                       | ABA PayWay merchant ID                                                                                                                               |
| `ABA_API_KEY`                    | Conditional | —                       | ABA PayWay API key                                                                                                                                   |
| `ABA_API_URL`                    | Conditional | —                       | ABA PayWay API base URL                                                                                                                              |
| `ABA_RSA_PUBLIC_KEY`             | Conditional | —                       | ABA RSA public key for card data encryption                                                                                                          |
| `ABA_SAVE_QR_IMAGE`              |     No      | `false`                 | Persist generated QR images to disk                                                                                                                  |
| `FIREBASE_PROJECT_ID`            |     No      | —                       | Firebase project ID (push notifications — app starts without it)                                                                                     |
| `FIREBASE_CLIENT_EMAIL`          |     No      | —                       | Firebase service account client email                                                                                                                |
| `FIREBASE_PRIVATE_KEY`           |     No      | —                       | Firebase service account private key (escape newlines: `\n`)                                                                                         |
| `SENTRY_DSN`                     |     No      | —                       | Sentry Data Source Name — error tracking is disabled when not set                                                                                    |
| `TRACING_BACKEND`                |     No      | `sentry`                | Which tracer runs: `sentry`, or `elastic` for Elastic APM via EDOT (see [docs/observability.md](docs/observability.md))                              |
| `SENTRY_TRACES_SAMPLE_RATE`      |     No      | `0.1`                   | Share of requests traced in Sentry (0–1) when `TRACING_BACKEND=sentry`                                                                               |
| `ENABLE_FRAUD_SERVICE`           |     No      | `false`                 | Enable the Fraud Detection Engine integration (advisory scoring on applications)                                                                     |
| `FRAUD_BASE_URL`                 | Conditional | UAT host                | Fraud engine base URL — confirm the production host before enabling there                                                                            |
| `FRAUD_USERNAME`                 | Conditional | —                       | Fraud engine service account — server-to-server only, never expose to the browser                                                                    |
| `FRAUD_PASSWORD`                 | Conditional | —                       | Fraud engine service account password                                                                                                                |
| `FRAUD_TOKEN_TTL_SECONDS`        |     No      | `3600`                  | Token cache lifetime; must match the engine's `ACCESS_TOKEN_EXPIRE_MINUTES`                                                                          |
| `ENABLE_EKYC_SERVICE`            |     No      | `false`                 | Master CamDX switch (staff + customer): `ocr-nid` + staff NID-replace OCR, user-info Verify, and offer-accept liveness if `livenessRequired` is true |
| `CAMDX_PROXY_URL`                | Conditional | —                       | NAK-CamDX proxy base URL (plain JSON + `X-API-Key`); required when `ENABLE_EKYC_SERVICE=true`                                                        |
| `CAMDX_PROXY_API_KEY`            | Conditional | —                       | Shared secret sent as the `X-API-Key` header to the NAK-CamDX proxy                                                                                  |
| `CAMDX_PROXY_TIMEOUT_MS`         |     No      | `30000`                 | Client timeout for proxy calls (liveness tier can take multiple seconds)                                                                             |
| `EKYC_MIN_LIVENESS_SCORE`        |     No      | `0.7`                   | Minimum `livenessScore` to pass the offer-accept gate (placeholder pending risk sign-off)                                                            |
| `EKYC_MIN_FACE_DOCUMENT_SCORE`   |     No      | `0.7`                   | Minimum `faceDocumentScore` (selfie vs. submitted ID photo) to pass the gate                                                                         |
| `EKYC_MIN_FACE_MOI_SCORE`        |     No      | `0.7`                   | Minimum `faceMoiScore` (selfie vs. MOI photo) to pass the gate                                                                                       |
| `EKYC_MAX_LIVENESS_ATTEMPTS`     |     No      | `3`                     | Liveness attempts before the offer is auto-cancelled (`OFFER_CANCELED_S3`)                                                                           |
| `EKYC_MAX_INFO_ATTEMPTS`         |     No      | `3`                     | CamDX user-info attempts per pool (customer, staff) before a supervisor must reset or record a manual verification                                   |
| `ENABLE_EKYC_INFO_REQUIRED_GATE` |     No      | `false`                 | Block customer submit, CS approve and Credit Committee approve until user info is verified; keep off until mobile ships the Verify step              |
| `ENABLE_NID_REUPLOAD`            |     No      | `false`                 | Non-production only — lets mobile QA re-upload the NID photo after identity is verified                                                              |

> **Conditional** means the variable is required only when the related feature is in use (e.g. GCS variables are only needed when `DOCUMENT_STORAGE_DRIVER=gcs`).

## Redis

Redis is used for three distinct purposes. The client is initialised in `src/lib/redis.ts` using [ioredis](https://github.com/redis/ioredis) with `lazyConnect: true`, so the app starts up successfully even when Redis is temporarily unavailable.

### What Redis stores

| Key pattern            | TTL                                            | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `revoked_token:{jti}`  | Remaining lifetime of the revoked access token | Access token blacklist — checked on every authenticated request                                      |
| `last_active:{userId}` | 2 hours                                        | Buffers `lastActiveAt` timestamps so they are written to the DB in bulk rather than on every request |
| `last_active_dirty`    | None (set)                                     | Tracks which `userId` values need to be flushed to the database                                      |
| `login_attempts:{ip}`  | Rate-limit window                              | Tracks failed login attempts per IP for rate limiting                                                |

### Configuration

```bash
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=los:   # all keys are namespaced under this prefix
```

### Degradation behaviour

- **Token blacklist:** If Redis is unreachable when a logout is attempted, the revocation silently fails — the access token remains valid until it naturally expires. The refresh token is always revoked in the database regardless.
- **lastActiveAt flush:** The every-5-minute cron job logs an error and retries on the next tick. No data loss occurs because the buffer keys persist in Redis.
- **Rate limiting:** Errors from Redis are caught and logged; the rate-limit check is skipped rather than blocking the request.

## Document Storage

All user-uploaded files (selfies, NID scans, payslips, receipts, signatures) are handled by `DocumentStorageService` in `src/shared/services/document-storage.service.ts`. The active backend is controlled by a single env var.

### Drivers

| `DOCUMENT_STORAGE_DRIVER` | Where files go                         | When to use                                    |
| ------------------------- | -------------------------------------- | ---------------------------------------------- |
| `local` (default)         | `./documents/` directory on the server | Local development, single-node deployments     |
| `gcs`                     | Google Cloud Storage bucket            | Staging, production, or multi-node deployments |

### Local driver

Files are written to `./documents/<module>/<filename>` and served back via a dedicated file-serving route. No additional configuration is required.

### GCS driver

When `DOCUMENT_STORAGE_DRIVER=gcs`, the service checks `GCS_API_ENDPOINT`:

- **Set** (e.g. `http://localhost:4443`) — uses the `fake-gcs-server` emulator. No GCP credentials are needed.
- **Not set** — uses the real `@google-cloud/storage` SDK with Application Default Credentials. Set `GCS_PROJECT_ID` to your GCP project.

The service creates the bucket automatically if it does not exist (skips if it already exists with a `409 Conflict`).

```bash
# Local dev with fake-gcs emulator (docker compose up -d fake-gcs)
DOCUMENT_STORAGE_DRIVER=gcs
GCS_BUCKET_NAME=los-documents
GCS_PROJECT_ID=local
GCS_API_ENDPOINT=http://localhost:4443

# Production
DOCUMENT_STORAGE_DRIVER=gcs
GCS_BUCKET_NAME=your-production-bucket
GCS_PROJECT_ID=your-gcp-project-id
GCS_API_ENDPOINT=            # leave empty
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com
```

After a successful upload to GCS (or the emulator), the local temp file created by Multer is deleted.

## Background Jobs

Scheduled jobs are defined in `src/jobs/cleanup.job.ts` and registered at startup via `src/index.ts`. Each job is individually opt-in via an environment variable so they can be disabled in test and preview environments.

### Job registry

| Function                    | Schedule        | Enabled by                            | What it does                                                                                                                       |
| --------------------------- | --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scheduleTokenCleanup`      | Daily at 02:00  | `ENABLE_TOKEN_CLEANUP_JOB=true`       | Deletes expired refresh tokens from the `refreshToken` table to prevent unbounded growth                                           |
| `scheduleLastActiveFlush`   | Every 5 minutes | Always (not gated)                    | Flushes buffered `lastActiveAt` timestamps from Redis to the `staff` table in the database                                         |
| `scheduleStaffSessionReset` | Daily at 20:00  | `ENABLE_STAFF_SESSION_RESET_JOB=true` | Revokes all active staff refresh tokens and sets all non-SUSPENDED staff to `inactive` status — enforces end-of-day session expiry |

### Environment variables

```bash
ENABLE_TOKEN_CLEANUP_JOB=false          # set to "true" to enable
ENABLE_STAFF_SESSION_RESET_JOB=false    # set to "true" to enable
```

### Risks and operational notes

- **`scheduleStaffSessionReset`** forces all staff to log in again the next morning. Enable it only after confirming that the mobile/web dashboard handles `401 Unauthorized` gracefully by redirecting to the login screen.
- **`scheduleTokenCleanup`** deletes rows from the `refreshToken` table. If the table is very large, the DELETE query can lock the table briefly. Schedule this during a low-traffic window (default 02:00 is suitable for most deployments).
- **`scheduleLastActiveFlush`** runs unconditionally. If Redis is unavailable for an extended period, the dirty set will be empty and the flush is a no-op — no data is lost.
- All three jobs log errors with `logger.error` but do not crash the process on failure.

## Firebase Push Notifications

Push notifications are sent to mobile devices via Firebase Cloud Messaging (FCM) using the Firebase Admin SDK. The service is implemented in `src/shared/services/firebase.service.ts`.

### Credentials

Obtain a service account JSON from the Firebase console:

1. Open [Firebase Console](https://console.firebase.google.com/) → Project settings → Service accounts
2. Click **Generate new private key** and download the JSON file
3. Copy the three values from the JSON into your environment file:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Note:** The private key contains literal newlines. Wrap it in double quotes and replace actual newlines with `\n`.

### Graceful degradation

All three environment variables are optional. If any are missing, the Firebase Admin SDK is not initialised. When `messaging` is `null`:

- `sendToTokens()` logs a warning and returns `{ successCount: 0, failureCount: 0 }` — no error is thrown.
- `sendToTopic()` logs a warning and returns `void` — no error is thrown.

This means the application starts and operates normally without Firebase configured. Push notifications are silently skipped.

### Usage

```typescript
import { firebaseService } from '../shared/services/firebase.service.js';

// Send to individual device tokens (auto-batched in groups of 500)
await firebaseService.sendToTokens(tokens, {
  title: 'Loan approved',
  body: 'Your loan has been approved.',
});

// Broadcast to a topic (all subscribed devices)
await firebaseService.sendToTopic('ANNOUNCEMENT', {
  title: 'Maintenance',
  body: 'Scheduled maintenance at midnight.',
});
```

## Logging & Observability

The project uses [Pino](https://getpino.io/) for high-performance structured logging and [Sentry](https://sentry.io/) for error monitoring (errors only — see below). For business-level audit trails, see the [Activity Log module](src/modules/activity-log/README.md), which records all user actions across the LOS system.

Logs from every environment are shipped to **Elasticsearch** (via Filebeat) and are
searchable in **Kibana**, which also hosts distributed traces from **Elastic APM**
(query-level Prisma spans included) — see [docs/observability.md](docs/observability.md).
Metrics themselves are exposed at `/metrics` (Prometheus format) and scraped into the
stack defined in [docker-compose.monitoring.yml](docker-compose.monitoring.yml)
(Prometheus, Grafana, Elasticsearch, Kibana, Filebeat, apm-server, cAdvisor,
node-exporter, uptime-kuma).

### Configuration

Logging is configured in [src/config/logger.ts](src/config/logger.ts) with environment-specific behaviour:

**Development Mode:**

- Pretty-printed output with colors for readability
- Debug-level logging enabled by default
- Human-readable timestamps
- Simplified output using `pino-pretty`

**Production Mode:**

- Structured JSON logs for machine parsing
- Configurable log level via `LOG_LEVEL` environment variable
- Multiple transport targets:
  - **stdout**: Captured by Docker/systemd/PM2 for container orchestration
  - **app.log**: Daily rotation, 14-day retention for general logs
  - **error.log**: Daily rotation, 30-day retention for error audit trail

### HTTP Request Logging

HTTP requests and responses are automatically logged via `pino-http` middleware in [src/app.ts](src/app.ts):

- **Auto-logging**: All HTTP requests/responses except health checks
- **Log Levels**:
  - `error`: Status >= 500 or uncaught errors
  - `warn`: Status >= 400 (client errors)
  - `info`: Successful requests (2xx, 3xx)
- **Serialization**: Method, URL, remote address, and status code

### Usage in Code

```typescript
import { logger } from './config/logger.js';

logger.info('Application started');
logger.error({ err }, 'Database connection failed');
logger.debug({ userId }, 'User login attempt');
```

### Log File Locations

```
logs/
├── app.log       # All logs (info+), rotated daily, 14-day retention
└── error.log     # Errors only, rotated daily, 30-day retention
```

## Sentry Error Monitoring

The application reports unhandled errors and performance data to [Sentry](https://sentry.io/). The integration is optional — if `SENTRY_DSN` is not set, Sentry is disabled and the app runs normally.

### How it works

| File                | Role                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/instrument.ts` | Calls `Sentry.init()` — loaded before the app via Node's `--import` flag (see nodemon.json / production start command) |
| `src/instrument.ts` | Registers `expressIntegration` with `shouldReportErrorToSentry`, so Express errors are captured automatically (v11)    |
| `src/config/env.ts` | Validates `SENTRY_DSN` (optional string, defaults to empty — Sentry skips init when `dsn` is `undefined`)              |

### Sample rates

| Environment                        | `tracesSampleRate` | `profilesSampleRate` |
| ---------------------------------- | :----------------: | :------------------: |
| `production`                       |       `0.1`        |        `0.1`         |
| `development` / `test` / `staging` |       `1.0`        |        `1.0`         |

Setting both rates to `1.0` outside production captures every transaction and profile during development, giving maximum visibility without affecting production throughput.

### Configuration

Add `SENTRY_DSN` to the appropriate environment file:

```bash
# .env.development or .env.production
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
```

Retrieve the DSN from **Sentry → Project Settings → Client Keys (DSN)**.

### Source maps

Source maps are uploaded to Sentry as part of the production build so stack traces in the Sentry UI show original TypeScript line numbers.

```bash
pnpm run build
# Equivalent to:
#   cross-env NODE_ENV=production tsc
#   sentry-cli sourcemaps inject --org nak110 --project los_backend ./dist
#   sentry-cli sourcemaps upload --org nak110 --project los_backend ./dist
```

The Sentry CLI reads its auth token from one of two places depending on the context:

| Context        | Token source                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local machine  | `.sentryclirc` — `[auth] token = <token>` (this file is gitignored)                                                                                                                                         |
| GitHub Actions | `SENTRY_AUTH_TOKEN` repository secret, injected into the `Build TypeScript` step of `.github/workflows/test.yml`                                                                                            |
| Docker build   | BuildKit secret `sentry_auth_token` (`--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN`, or the `secrets:` block in the compose files) — never a build arg, since args are recorded in the image history |

To set up local source map uploads, create `.sentryclirc` in the project root:

```ini
[auth]
token=<your-sentry-auth-token>
```

Generate an auth token at **Sentry → Settings → Auth Tokens** with the `project:releases` and `org:read` scopes.

### Middleware order in `app.ts`

`Sentry.setupExpressErrorHandler(app)` must be registered after all routes and before any custom error handlers. The current order is:

```
routes → Sentry.setupExpressErrorHandler → 404 handler → errorHandler
```

Do not move `Sentry.setupExpressErrorHandler` below the 404 handler — Sentry only captures errors passed to `next(err)`, and the 404 handler never calls `next`.

## Testing

### Test Types

| Type                  | Command                     | Requires DB? | Config file                    |
| --------------------- | --------------------------- | :----------: | ------------------------------ |
| Unit tests            | `pnpm test`                 |      No      | `vitest.config.ts`             |
| Unit tests + coverage | `pnpm run test:coverage`    |      No      | `vitest.config.ts`             |
| Unit tests (watch)    | `pnpm run test:watch`       |      No      | `vitest.config.ts`             |
| Integration tests     | `pnpm run test:integration` |     Yes      | `vitest.integration.config.ts` |

### Unit Tests

Unit tests live alongside their source files inside `src/**/__tests__/` directories and use [Vitest](https://vitest.dev/). All external dependencies (Prisma, third-party APIs) are mocked — no database or network connection is needed.

```bash
pnpm test                 # run all unit tests once
pnpm run test:watch       # re-run on file change
pnpm run test:coverage    # run with v8 coverage report
```

Coverage reports are written to `coverage/` (HTML, lcov, text).

### Coverage Thresholds

The following thresholds are enforced in `vitest.config.ts` and are checked in CI:

| Statements                                    | Branches                                  | Functions                                   | Lines                               |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ----------------------------------- |
| ![Statements](./badges_output/statements.svg) | ![Branches](./badges_output/branches.svg) | ![Functions](./badges_output/functions.svg) | ![Lines](./badges_output/lines.svg) |

> Minimum thresholds: Statements 70% · Lines 70% · Functions 70% · Branches 65%
> Run `pnpm run test:badges` to regenerate badges after new test runs.

**Excluded from coverage** (infrastructure / wiring code that is not unit-testable):
`*.types.ts`, `**/index.ts`, `database.ts`, `logger.ts`, `openapi.ts`, `lib/prisma.ts`, `routes/**`, `*.schema.ts`, `*.openapi.ts`, `*.routes.ts`, `src/index.ts`, `src/app.ts`, `src/generated/**`

### Integration Tests

Integration tests live in `tests/integration/` and are run separately. They require a real MySQL database and run migrations before executing:

```bash
# Requires .env.test with a valid DATABASE_URL pointing to a test database
pnpm run test:integration
# or via make
make test-integration
```

Integration tests run serially (`fileParallelism: false`) to avoid DB state conflicts.

Migrations are applied by the Vitest global setup (`tests/global-setup.ts`), not by the npm script.

To run against throwaway containers instead of the local `los_test` database (needs Docker):

```bash
TESTCONTAINERS=1 pnpm run test:integration   # also test:e2e
```

This starts `mysql:8.0.42` and `redis:7.4.8-alpine`, runs `prisma migrate deploy`, seeds the reference
data and removes the containers afterwards. It is roughly 2x slower than the local database for E2E,
so both local development and Jenkins use the native `los_test` database by default.

Current coverage:

| File                                                                       | What it covers                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `tests/integration/auth/admin-auth.integration.test.ts`                    | Admin login and token refresh                    |
| `tests/integration/applications/admin-draft.integration.test.ts`           | Draft review, fail, and sales-officer assignment |
| `tests/integration/applications/admin-process.integration.test.ts`         | CA verification, recommend, decline, amending    |
| `tests/integration/applications/admin-credit-decision.integration.test.ts` | CC review, approve, reject, reevaluate           |
| `tests/integration/applications/admin-disbursement.integration.test.ts`    | Deposit receipt submission and hold              |
| `tests/integration/repayment/admin-repayment.integration.test.ts`          | AR repayment completion and failure              |
| `tests/integration/repayment/admin-collection.integration.test.ts`         | Collection officer queue and assignment          |
| `tests/integration/profile/admin-profile.integration.test.ts`              | Admin profile detail and password change         |
| `tests/integration/lead/admin-lead.integration.test.ts`                    | Lead creation, bulk import, and assignment       |

### Pre-Push Hook

A [Husky](https://typicode.com/husky/) pre-push hook runs `pnpm run type-check` before every push. The push is blocked if TypeScript reports any errors. Fix all type errors before pushing.

### Prisma Client Generation

The Prisma client is generated into `src/generated/prisma/` and is **gitignored**. Always generate it before building or running tests for the first time:

```bash
pnpm prisma generate
```

This is done automatically in CI (see below).

## CI/CD

### GitHub Actions — Quality Pipeline

**Workflow:** `.github/workflows/test.yml`
**Triggers:**

- `pull_request` to `main`
- `push` to `main` (ignores `badges_output/**` only commits)
- `workflow_dispatch` for manual runs

Jobs:

1. `lint` — installs dependencies and runs `pnpm run lint`
2. `typecheck` — installs dependencies and runs `pnpm run type-check`
3. `build` — generates Prisma client and compiles TypeScript

- If `SENTRY_AUTH_TOKEN` exists, runs full `pnpm run build` (includes Sentry sourcemap upload)
- If the token is unavailable (for example in restricted PR contexts), falls back to `pnpm exec tsc`

4. `unit_test` — generates Prisma client, runs `pnpm run test:coverage`, uploads coverage artifact
5. `integration_test` — runs `pnpm run test:integration` against a MySQL service container

- Runs on `push` to `main` and on `workflow_dispatch`

6. `badges` — downloads coverage artifact and creates/updates a PR with refreshed badges

- Runs only on `push` to `main` after `lint`, `typecheck`, `build`, and `unit_test` succeed

#### Required repository secrets

| Secret              | Used by     | Purpose                                            |
| ------------------- | ----------- | -------------------------------------------------- |
| `SENTRY_AUTH_TOKEN` | `build` job | Authenticates the Sentry CLI for source map upload |

Add this secret at **GitHub → Repository Settings → Secrets and variables → Actions → New repository secret**. Generate the token at **Sentry → Settings → Auth Tokens**.

> **Note:** Integration tests now run in CI on `main` pushes and manual dispatch using an ephemeral MySQL service.

## Development Setup

### Running the Application

**Development Mode with Auto-Restart:**

```bash
pnpm dev
```

Uses [nodemon](https://nodemon.io/) to automatically restart the server when files change.

**Nodemon Configuration** ([nodemon.json](nodemon.json)):

- Watches: `src/` directory and `.env.development`
- File extensions: `.ts`, `.js`, `.json`
- Ignores: Test files (`*.test.ts`) and build output (`dist/`)
- Executes: `tsx --import ./src/instrument.ts src/index.ts` with `NODE_ENV=development` and `NODE_OPTIONS=--dns-result-order=ipv4first`

**Production Mode:**

```bash
pnpm run build
pnpm start
```

### Environment Files

Create environment-specific configuration files:

```bash
.env.development    # Local development
.env.production     # Production deployment
```

See [.env.example](.env.example) for all available configuration options.

### Code Quality

The project uses [oxlint](https://oxc.rs/docs/guide/usage/linter.html) with type-aware linting (`oxlint-tsgolint`, which runs on TypeScript 7). The config (`.oxlintrc.json`) has per-file overrides for source files, module services, routes files and test files.

**Key rules:**

| Rule                              | Severity             | Notes                                                             |
| --------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `no-unused-vars`                  | error                | Underscore-prefixed names (`_x`) are exempt                       |
| `typescript/no-explicit-any`      | warn (off in tests)  | Warns on source code; relaxed in tests                            |
| `typescript/no-floating-promises` | error (off in tests) | Prevents silently swallowed async calls                           |
| `typescript/no-misused-promises`  | error (off in tests) | Prevents async functions passed as sync callbacks                 |
| `typescript/await-thenable`       | error                | Prevents `await` on non-Promise values                            |
| `prefer-const` / `no-var`         | error                | Enforces `const`/`let` throughout                                 |
| `no-restricted-imports`           | warn                 | Module services must not import `prisma` directly                 |
| `eslint-js/no-restricted-syntax`  | error                | Routes files must not build repositories or pass args to services |

The three `typescript/*` type-aware rules (`no-floating-promises`, `no-misused-promises`, `await-thenable`) use the TypeScript type checker. They are the most effective rules for catching async bugs at lint time.

`eslint-js/no-restricted-syntax` comes from [`oxlint-plugin-eslint`](https://www.npmjs.com/package/oxlint-plugin-eslint) (ESLint's built-in rules as an oxlint JS plugin), since oxlint has no native `no-restricted-syntax` yet.

```bash
pnpm run lint          # check only
pnpm run lint:fix      # auto-fix where possible
```

Pre-commit (via Husky + lint-staged): oxlint and Prettier run automatically on staged `.ts`/`.tsx` files before each commit.

### TypeScript Path Aliases

All source imports use four path aliases instead of deep relative paths:

| Alias        | Maps to         | Example                                                 |
| ------------ | --------------- | ------------------------------------------------------- |
| `@shared/*`  | `src/shared/*`  | `import { AppError } from '@shared/errors/AppError.js'` |
| `@config/*`  | `src/config/*`  | `import { env } from '@config/env.js'`                  |
| `@modules/*` | `src/modules/*` | `import { authRouter } from '@modules/auth/index.js'`   |
| `@lib/*`     | `src/lib/*`     | `import { prisma } from '@lib/prisma.js'`               |

**How aliases are resolved at runtime:**

| Context     | Resolver                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------- |
| Development | `tsx` resolves aliases natively via `tsconfig.json` `paths`                                 |
| Build       | `tsc` compiles to `dist/`; `tsc-alias` rewrites alias paths to relative paths in the output |
| Tests       | Vite `resolve.tsconfigPaths` in `vitest.config.ts` / `vitest.integration.config.ts`         |

When authoring new modules, always use aliases — never write `../../../shared/...` style relative imports.

## Available Commands

All common tasks are available via `make`. Run `make help` to list them.

```
make dev                - Start development server (nodemon + tsx)
make build              - Compile TypeScript to dist/
make start              - Start production server from dist/
make lint               - Run oxlint
make lint-fix           - Run oxlint with auto-fix
make format             - Format code with Prettier
make type-check         - Run TypeScript type check
make test               - Run unit tests
make test-watch         - Run unit tests in watch mode
make test-coverage      - Run unit tests with coverage report
make test-integration   - Run integration tests (requires .env.test with DATABASE_URL)
make fresh              - Reset DB, push schema, and seed (like Laravel migrate:fresh --seed)
make reset              - Reset DB only, no seed (pnpm prisma migrate reset --force --skip-seed)
make migrate            - Run pending migrations (deploy)
make push               - Push schema without migrations (prototyping)
make seed               - Seed the database
```

> **Tip — Laravel equivalents:**
>
> | Make command   | Laravel equivalent                          |
> | -------------- | ------------------------------------------- |
> | `make fresh`   | `artisan migrate:fresh --seed`              |
> | `make reset`   | `artisan migrate:fresh` (no seed)           |
> | `make migrate` | `artisan migrate`                           |
> | `make push`    | _(no equivalent — schema prototyping only)_ |
> | `make seed`    | `artisan db:seed`                           |

---

## Modules

Each module owns its endpoints, business logic, validation schemas, and OpenAPI registrations. Click a module name for the full reference.

| Module                                                     | Description                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [auth](src/modules/auth/README.md)                         | Customer and staff authentication — register, login, token refresh, logout, OTP                                                     |
| [applications](src/modules/applications/README.md)         | Full loan application lifecycle — customer draft, admin draft review, credit assessment (CA/CC), offer acceptance, and disbursement |
| [repayment](src/modules/repayment/README.md)               | Customer repayment tracking and payment submission; admin AR receipt review; collection officer overdue queue management            |
| [activity-log](src/modules/activity-log/README.md)         | Comprehensive audit trail — records all user actions with actor, timestamp, entity, and metadata                                    |
| [settings](src/modules/settings/README.md)                 | ADMIN-only system configuration — cron job scheduling and auto-assignment capacity tuning                                           |
| [aba](src/modules/aba/README.md)                           | ABA PayWay integration — KHQR generation, card purchase, and transaction status check                                               |
| [geolocation](src/modules/geolocation/README.md)           | Read-only province / district / commune hierarchy, served to both admin and customer                                                |
| [gift](src/modules/gift/README.md)                         | Gift catalogue — admin CRUD; customer browse (visible gifts only)                                                                   |
| [banner](src/modules/banner/README.md)                     | Promotional banners — admin CRUD; guest and customer read active banners                                                            |
| [notification](src/modules/notification/README.md)         | FCM push notifications — guest announcements, customer auto-alerts, admin send/broadcast                                            |
| [staff](src/modules/staff/README.md)                       | ADMIN-only staff account creation and management                                                                                    |
| [profile](src/modules/profile/README.md)                   | Customer and staff profile detail, password change, call-history/contact-list sync                                                  |
| [permission](src/modules/permission/README.md)             | ADMIN-only per-role permission management with live cache invalidation                                                              |
| [customer](src/modules/customer/README.md)                 | Staff-facing customer lookup by phone or NID                                                                                        |
| [lead](src/modules/lead/README.md)                         | Prospective customer leads — create, bulk Excel import, status tracking, sales assignment                                           |
| [search](src/modules/search/README.md)                     | Unified staff quick-search across applications and leads                                                                            |
| [loan-calculator](src/modules/loan-calculator/README.md)   | Public repayment schedule calculator (no auth required)                                                                             |
| [comment](src/modules/comment/README.md)                   | Internal staff notes on customer records                                                                                            |
| [communication](src/modules/communication/README.md)       | Structured audit log of all staff interactions with customers and leads                                                             |
| [incident](src/modules/incident/README.md)                 | Fraud/risk detection — match applicant details against internal blacklist                                                           |
| [sms](src/modules/sms/README.md)                           | Plasgate SMS gateway — single and batch send with audit logging                                                                     |
| [message-template](src/modules/message-template/README.md) | Ready-made SMS / notification texts — Ops CRUD; every staff member lists them to copy into send panels                              |
| [department](src/modules/department/README.md)             | ADMIN-only CRUD for departments, used to group `StaffRole` records                                                                  |
| [app-config](src/modules/app-config/README.md)             | Customer-facing read-only config — third-party service status, contact links, current loan terms                                    |
| [jwks](src/modules/jwks/README.md)                         | Public JWKS endpoint — RS256 public key for verifying dashboard iframe handoff tokens                                               |
| [presence](src/modules/presence/README.md)                 | Staff online/offline tracking via Redis heartbeat                                                                                   |
| [sidebar](src/modules/sidebar/README.md)                   | Open-item counts per sidebar work queue, scoped to the caller — one call instead of 7 summaries                                     |

---

## Further Reading

| Document                                                                 | Description                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [docs/repayment.md](docs/repayment.md)                                   | Repayment system reference — row categories, status lifecycle, completion math, waive modes, auto-remark generation               |
| [docs/project-guidelines.md](docs/project-guidelines.md)                 | Onboarding reference — architecture, conventions, testing, git workflow, and more                                                 |
| [docs/rbac.md](docs/rbac.md)                                             | Role definitions, `requireRole` usage, and fine-grained permission middleware                                                     |
| [docs/api-response-contracts.md](docs/api-response-contracts.md)         | Standard `ApiResponse<T>` and `PaginatedResponse<T>` shapes; error class reference                                                |
| [docs/module-authoring-guide.md](docs/module-authoring-guide.md)         | File naming conventions, how to register a new module, validation and response helpers                                            |
| [docs/dashboard-iframe-embedding.md](docs/dashboard-iframe-embedding.md) | Analytics dashboard iframe SSO handoff — endpoints, JWKS, and the `postMessage` flow, for the dashboard/frontend teams            |
| [docs/camdx-ekyc-integration.md](docs/camdx-ekyc-integration.md)         | CamDX/CamDigiKey eKYC integration — endpoints, error codes, fees, and recommended use in the loan lifecycle                       |
| [docs/date-range-filtering.md](docs/date-range-filtering.md)             | Naive local-time convention for `startDate`/`endDate` and other date filter/body fields — why, and how it's parsed                |
| [src/shared/services/README.md](src/shared/services/README.md)           | Complete guide to all shared services — activity logging, auto-assignment, document storage, Firebase, token management, and more |
