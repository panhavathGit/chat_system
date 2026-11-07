# Sign in with LOS: what los_backend, los_web and the mobile app need to do

chat_backend runs its own sessions but never checks passwords. LOS proves who someone is with a token signed by its RS256 key. chat_backend verifies that token with the LOS JWKS, maps the person to a chat account (find-or-create by LOS user id), and returns **its own chat session token**. LOS tokens are accepted **only** by the two `/auth/session` endpoints; every other chat request and the Socket.io connection need the chat session token.

```
Mobile:  LOS app login ─▶ LOS access token ─▶ POST /customer/api/v1/auth/session { losToken }    ─▶ chat customer session (1 h)
Web:     los_web ─▶ los_backend: chat handoff token (2 min) ─postMessage─▶ los_chat_web
                ─▶ POST /agent/api/v1/auth/session { handoffToken }                               ─▶ chat staff session (15 min)
```

Why staff use a separate handoff token: los_web's own access token works on all of LOS for up to an hour. The handoff token works only for starting a chat session, for 2 minutes, so a leaked copy is close to useless and the real LOS token never leaves los_web.

---

## 1. los_backend (small change)

The analytics-dashboard iframe already uses this pattern (`generateDashboardHandoffToken` in `src/shared/utils/jwt.util.ts`, route `POST /api/v1/admin/dashboard-embed/handoff-token`). Chat needs the same thing with a different audience.

1. Let the token function take the audience and token type instead of hard-coding `analytics-dashboard` / `dashboard-handoff`.
2. Add `POST /api/v1/admin/chat/handoff-token`:
   - requires a valid **staff** access token (customers get `403`, as on the dashboard endpoint);
   - rate-limited like the dashboard endpoint;
   - empty body; returns `{ "status": "success", "data": { "token": "<jwt>", "expiresAt": "<ISO time>" } }`.
3. The token:

   | Field | Value |
   | :--- | :--- |
   | header | `{ "alg": "RS256", "typ": "JWT", "kid": "<access key kid>" }`, signed with the access-token private key |
   | `iss` | `los-backend` |
   | `aud` | `chat` |
   | `tokenType` | `chat-handoff` |
   | `type` | `staff` |
   | `userId` | LOS `User.id` (number) |
   | `username` | LOS username |
   | `role` | the staff role name, e.g. `CREDIT_SUPPORT_OFFICER` |
   | `roleId` | the role id |
   | `exp` | 2 minutes after `iat` |

No new keys, tables or JWKS changes: chat_backend already verifies with the published JWKS.

Every LOS staff member may use chat, so LOS issues the handoff to any staff account; chat_backend stores the role only for display.

## 2. los_web (the page that embeds los_chat_web)

A postMessage handshake, the same shape as the analytics-dashboard embed:

```
los_chat_web (iframe)                    los_web (parent)                        los_backend
      │ ── { type: 'CHAT_READY' } ────────▶ │                                          │
      │                                    │ ── POST /admin/chat/handoff-token ──────▶ │  (Bearer: los_web's own token)
      │                                    │ ◀──────────── { token, expiresAt } ───── │
      │ ◀── { type: 'CHAT_AUTH_HANDOFF',    │                                          │
      │       token } ─────────────────────│                                          │
      │  POST chat_backend /agent/api/v1/auth/session { handoffToken: token }         │
      │  ... chat session runs ...          │                                          │
      │ ── { type: 'CHAT_TOKEN_EXPIRING' } ▶│  (before the 15-minute session ends: repeat)
```

Rules:

- Post with the **exact** chat_web origin as `targetOrigin`, never `'*'`; check `event.origin` on every message, on both sides.
- Never put the token in the iframe URL (URLs end up in history and logs).
- If the staff member is logged out of los_web, the handoff request fails and chat stops at the next renewal. That's the intended logout behaviour.

## 3. Flutter app

- When the chat screen opens: `POST /customer/api/v1/auth/session` with `{ "losToken": "<the LOS access token the app already has>" }`. The response is `{ accessToken, expiresIn, user }`.
- Use `accessToken` for every chat REST call (`Authorization: Bearer …`) and for Socket.io (`auth: { token }`).
- Keep it in memory. On a `401` from chat, or shortly before `expiresIn`, exchange again with the current LOS token (refresh the LOS token first if it has expired), then reconnect the socket with the new chat token.

## 4. chat_backend configuration

| Setting | Production value |
| :--- | :--- |
| `LOS_JWKS_URI` | `https://api.los.delightech.asia/api/v1/guest/.well-known/jwks.json` |
| `LOS_ISSUER` | `los-backend` |
| `LOS_CUSTOMER_AUDIENCE` | `luyleun` |
| `LOS_HANDOFF_AUDIENCE` / `LOS_HANDOFF_TOKEN_TYPE` | `chat` / `chat-handoff` |

Until step 1 ships, development against LOS dev borrows the analytics-dashboard handoff (`LOS_HANDOFF_AUDIENCE=analytics-dashboard`, `LOS_HANDOFF_TOKEN_TYPE=dashboard-handoff`). chat_backend refuses to start with that in production.

## Known limits (accepted for now)

- A revoked LOS token (logout, suspension) can still be exchanged until it expires, and a chat session lasts until its own expiry (1 h customers, 15 min staff). LOS Redis revocation checks can be added at exchange time later.
