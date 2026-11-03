---
name: websocket-development
description: Add or change realtime chat events across the ws gateway, Redis fan-out, the shared protocol, and the frontend client/mock. Use for any new or modified WebSocket event.
---

# WebSocket development

## When to use
New/changed client or server events, gateway behaviour, heartbeat, fan-out, or frontend realtime routing.

## Required knowledge
`ws` 8, Redis pub/sub (`ioredis`), envelope `{ type, payload }`, `frontend/src/shared/api/ws/protocol.ts` (`ServerEventMap`, `ClientEventMap`, `isServerEvent`), `docs/chat-logic-design.md` §2–§7.

## Workflow
1. Define the event in `protocol.ts` (type + `isServerEvent` validation + `protocol.test.ts`).
2. Frontend: route it in `app/providers/realtime.ts` into entity stores; extend the mock server in `shared/api/ws/mock`.
3. Backend: handler (validate with zod) → service → repository; the service returns events, the gateway delivers each only to permitted sockets.
4. Publish via Redis channel so every API instance delivers to its own sockets.
5. Update `docs/chat-logic-design.md` §7 if it was a listed gap.

## Architecture rules
- Gateway authenticates and routes; no business rules in it. Handlers validate and call a service.
- Slow work (AI replies) runs as a queue job, never inside a socket handler.
- Visibility is per socket by role/assignment, not broadcast-to-all (the mock broadcasts; the real server must not).
- `message.send` is idempotent via `clientId`; ack must return `clientId` + real message.
- The current gateway relays Redis messages to all sockets with no auth — treat that as a stub.

## Coding standards
Treat every inbound frame as untrusted; validate shape before use. Event names are dotted (`message.new`). Keep payloads JSON-serializable DTOs.

## Testing requirements
Protocol validator tests, store/action tests with mocked `wsClient`, service tests for permission and conflict cases (two agents taking over at once).

## Common mistakes
Changing one side of the contract only; broadcasting private chats or `NOTE` messages to customers; doing DB work in the gateway; forgetting heartbeat/cleanup on shutdown; replaying events on reconnect (design says clients re-sync).
