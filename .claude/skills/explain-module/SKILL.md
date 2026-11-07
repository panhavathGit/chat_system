---
name: explain-module
description: Review a module's source files and explain how it works — endpoints, business logic, data flow, validation, and types.
argument-hint: <module-name-or-path>
user-invokable: true
---

# Explain Module: $ARGUMENTS

Locate and read the module at `$ARGUMENTS` inside `src/modules/` (or use as a full path if it starts with `src/`), then produce a structured explanation.

## Steps

1. **Find the module directory**
   - If `$ARGUMENTS` starts with `src/`, use it as-is
   - Otherwise glob `src/modules/**/$ARGUMENTS` and `src/modules/$ARGUMENTS` to find the directory
   - List all `.ts` files inside it

2. **Read files in this order** (skip any that don't exist):
   - `*.routes.ts`
   - `*.controller.ts`
   - `*.service.ts`
   - `*.schema.ts`
   - `types/*.ts`
   - `*.openapi.ts`
   - `__tests__/**/*.ts` (skim — note what scenarios are tested)
   - If this is an `applications` sub-module, also read `src/modules/applications/shared/application.repository.ts` and identify which methods this module uses

3. **Write a structured explanation** with the following sections:

### Purpose

What this module does and which loan lifecycle stage it covers:

- S1 Draft — customer draft review, approval, failure
- S2 Request / Process — credit assessment, recommend/decline offer
- S2 Credit Decision — credit committee approval/rejection
- S4 Deposit — disbursement receipt, hold-on
- S5 Repayment — repayment review, complete, fail
- Other (auth, geolocation, notification, etc.)

### Endpoints

| Method | Path | Auth Roles | Description |
| ------ | ---- | ---------- | ----------- |

List every route registered in `*.routes.ts`. Include the full path prefix if visible, or note it comes from the router registration in `src/routes/v1.ts`.

### Business Logic

- Status transition rules and guard conditions (what status must the record be in, what status does it transition to)
- Side effects: file operations, DB upserts, tracking/audit log entries, notifications
- Any notable validation or error-throwing logic in the service

### Data Flow

Step through the chain for a typical request:

> HTTP request → [middleware list from routes] → controller method → service method → repository method → Prisma query → DB

And the response path back.

### Validation

Key Zod schemas: required fields, type constraints, enums (list enum values). Note which endpoints use which schemas.

### Key Types

List the main request/response interfaces with their fields and types.

---

Keep the explanation factual and grounded in what you actually read — no speculation. Use markdown links to reference source files where relevant.
