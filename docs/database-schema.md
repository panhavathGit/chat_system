# Database Schema Design — Chat Dashboard

## Overview

The persistent data model behind the Chat Dashboard. It is defined in
`backend/prisma/schema.prisma` and targets **PostgreSQL 16+** (Prisma 7). It normalizes
chat entities that are currently embedded in the client DTOs (`ConversationDto`,
`ChatMessageDto`, `ActivityDto` in `frontend/src/shared/api/ws/protocol.ts`).

Related files:

| File                                 | Purpose                                                          |
| ------------------------------------ | ---------------------------------------------------------------- |
| `backend/prisma/schema.prisma`       | Source of truth for tables, columns, relations, enums            |
| `backend/prisma/sql/constraints.sql` | Constraints Prisma cannot express; append to the first migration |
| `backend/prisma.config.ts`           | Prisma 7 config (schema path, `DATABASE_URL`)                    |
| `backend/src/config/database.ts`     | `PrismaClient` with the `pg` driver adapter                      |
| `docs/database-schema.dbml`          | Same schema for https://dbdiagram.io/d                           |

Tables are snake_case plural (`conversations`, `agent_conversations`); in code use the
Prisma names (`prisma.user`, `lastMessageAt`).

## Service boundary

Two independent backends, each with its own PostgreSQL database:

- **Backend 1 (main):** identity, authentication, users, agents, customers, loan applications, roles and permissions.
- **Backend 2 (chat, this repo):** conversations, messages, receipts, assignments, activities, shared files,
  notifications, device tokens, settings, and realtime.

This schema contains **chat data only**. Anything owned by Backend 1 is stored as an opaque external id
(`customer_id`, `application_id`, `agent_id`, `user_id`, `sender_user_id`; `VARCHAR(64)`) with **no foreign key**,
because a constraint cannot span two databases. Names, avatars, roles and loan details are fetched from Backend 1
when a DTO is built and are not copied here. The id format and the Backend 1 API contract are not yet known; see
`authentication-security`. Consequences: referential integrity for these ids is the application's job, and
deleting a user in Backend 1 does not cascade into chat history (which is kept on purpose).

## Entity Relationship Diagram

```
conversations ──< messages ──< message_receipts
      │  │  │
      │  │  ├──< activities
      │  │  ├──< shared_files
      │  │  ├──< agent_conversations   (assignment history)
      │  │  └──< conversation_reads
      │
      └── customer_id, application_id, assigned_agent_id  ──▶  Backend 1 (external, no FK)

notifications, settings, device_tokens: keyed by Backend 1 agent/user id
```

## Design decisions

1. **No identity tables.** Users, customers, agents and applications live in Backend 1. This schema references
   them by external id only (see Service boundary).
2. **Two sources of "who owns this chat" are kept in sync.** `conversations.assigned_agent_id`
   is the fast read path for the inbox; `agent_conversations` is the append-only history.
3. **`handoff` is the AI-to-human state machine**, separate from the lifecycle `status`:

   ```
   AI ──(escalate / callback / customer asks)──▶ NEEDS_HUMAN ──(takeover)──▶ ASSIGNED
    ▲                                                                           │
    └──────────────────────────(release / resolve)──────────────────────────────┘
   ```

4. **Messages are append-only.** Soft delete via `deleted_at`; `client_id` makes
   optimistic sends idempotent (unique with `conversation_id`).
5. **Denormalized inbox fields** (`preview`, `last_message_at`, `unread_count`)
   are updated in the same transaction as the message insert.
6. **Display strings are derived.** File size is bytes, and `Activity.time` / `SharedFile.addedAt` come from
   `created_at`. The server formats them when building DTOs. Money, tenor and customer fields come from Backend 1.
7. **Receipts are per recipient.** `messages.status` is the sender-facing summary; `message_receipts` records who
   got and read each message.

## Tables

### conversations

| Column                                                 | Type                | Notes                                                                    |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `id`                                                   | CHAR(36) PK         |                                                                          |
| `slug`                                                 | VARCHAR(100) unique | external id the WS protocol uses today (e.g. `maya`)                     |
| `customer_id`                                          | VARCHAR(64)         | Backend 1 customer id, required (no FK)                                  |
| `application_id`                                       | VARCHAR(64)? unique | Backend 1 loan application id; one conversation per application (no FK)  |
| `status`                                               | ENUM                | `OPEN`, `RESOLVED`, `CLOSED`                                             |
| `closed_at`                                            | DATETIME?           | set exactly when `status != OPEN` (CHECK)                                |
| `channel`                                              | VARCHAR(32)         | default `web`                                                            |
| `handoff`                                              | ENUM                | `AI`, `NEEDS_HUMAN`, `ASSIGNED`                                          |
| `assigned_agent_id`                                    | VARCHAR(64)?        | Backend 1 agent id; set exactly when `handoff = ASSIGNED` (CHECK; no FK) |
| `preview`, `last_message_at`, `unread_count`, `urgent` |                     | inbox fields                                                             |
| `summary`, `summary_image`                             | TEXT?, VARCHAR?     |                                                                          |

### messages

| Column                                  | Type         | Notes                                                          |
| --------------------------------------- | ------------ | -------------------------------------------------------------- |
| `id`                                    | CHAR(36) PK  |                                                                |
| `conversation_id`                       | CHAR(36)     | CASCADE                                                        |
| `sender_type`                           | ENUM         | `CUSTOMER`, `ASSISTANT`, `AGENT`                               |
| `sender_user_id`                        | VARCHAR(64)? | Backend 1 id; NULL exactly when `ASSISTANT` (CHECK; no FK)     |
| `type`                                  | ENUM         | `TEXT`, `IMAGE`, `FILE`, `NOTE` (internal), `SYSTEM`           |
| `text`                                  | TEXT         | GIN `to_tsvector` index for search-in-chat (`constraints.sql`) |
| `client_id`                             | VARCHAR(64)? | unique with `conversation_id`                                  |
| `status`                                | ENUM?        | `SENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`               |
| `created_at`, `edited_at`, `deleted_at` | DATETIME     |                                                                |

### activities

`id`, `conversation_id` (CASCADE), `agent_id`? (Backend 1 id; NULL = system/AI), `tone` (`BLUE`/`CYAN`/`RED`), `title`, `copy`, `created_at`.

### agent_conversations (assignment history)

`agent_id` (Backend 1 id), `conversation_id` (RESTRICT, so history survives), `role` (`OWNER`/`VIEWER`),
`assigned_at`, `unassigned_at` (NULL = currently assigned). A partial UNIQUE index
(`constraints.sql`) allows only one active OWNER per conversation.

### shared_files

`conversation_id` (CASCADE), `customer_id` and `application_id`? (Backend 1 ids), `message_id`? (SET NULL),
`name`, `kind` (`DOCUMENT`/`IMAGE`), `size_bytes`, `mime_type`?, `storage_key` (object key; derive or sign download URLs from it), `url`? (optional cached URL), `checksum_sha256`?, `created_at`.

### conversation_reads

Composite key `(user_id, conversation_id)` (`user_id` is a Backend 1 id) with `last_read_at`. Gives each agent their own
unread state; `conversations.unread_count` remains the shared inbox badge.

### message_receipts

Composite key `(message_id, user_id)` (CASCADE on message; `user_id` is the Backend 1 id of the recipient),
`delivered_at`?, `read_at`?. Written when a recipient client acknowledges `message:delivered` / `message:read`.

### device_tokens

`id`, `user_id` (Backend 1 id), `platform` (`ANDROID`/`IOS`), `token` (unique FCM registration or APNs device token),
`revoked_at`? (set when the provider reports the token invalid), timestamps. Targets for push notifications.

### settings / notifications

`settings`: one boolean per `(agent_id, key)` (also checked before sending a push). `notifications`: `agent_id`, `type`,
`text`, `read`, `created_at`.

## Database-enforced rules

| Rule                                           | Mechanism                             |
| ---------------------------------------------- | ------------------------------------- |
| `handoff = ASSIGNED` ⇔ `assigned_agent_id` set | CHECK                                 |
| `status = OPEN` ⇔ `closed_at` is NULL          | CHECK                                 |
| `ASSISTANT` message ⇔ no `sender_user_id`      | CHECK                                 |
| One active OWNER per conversation              | partial UNIQUE index                  |
| No duplicate optimistic sends                  | UNIQUE `(conversation_id, client_id)` |
| Chats with assignment history can't be deleted | FK RESTRICT                           |

CHECKs and the partial unique index live in `prisma/sql/constraints.sql`.

Not enforced by the database (do it in the application): that every Backend 1 id
(`customer_id`, `application_id`, `agent_id`, `user_id`) exists, and that the sender's role
(from Backend 1) matches `sender_type`.

## Workflows

**Customer message:** insert message → update conversation (`preview`,
`last_message_at`, `unread_count + 1`) in one transaction → if `handoff = AI`,
queue the AI reply; if it escalates, set `NEEDS_HUMAN`, `urgent`, and notify agents.

**Takeover (race-safe):**

```sql
UPDATE conversations
SET handoff = 'ASSIGNED', assigned_agent_id = ?
WHERE id = ? AND handoff = 'NEEDS_HUMAN';   -- 0 rows affected = someone else won
```

In the same transaction, close any open owner row (`unassigned_at = NOW()`) and
insert the new `agent_conversations` row.

**Agent message:** validate ownership → insert → `message.ack` maps `client_id`
to the real id → `message.status` updates.

## Setup

```bash
pnpm install
cp backend/.env.example backend/.env
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat?schema=public"
pnpm db:generate                              # client -> backend/prisma/generated/prisma
pnpm db:migrate --create-only     # then append backend/prisma/sql/constraints.sql to the new migration.sql
pnpm db:migrate
```

## Conversation DTO

`ConversationDto` is composed in the service layer: conversation rows from this database plus customer
name/avatar and loan application details fetched from Backend 1 by `customer_id` / `application_id`. There is no
SQL view, because that data is not in this database.
