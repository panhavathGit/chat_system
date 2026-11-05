# API response contracts

Every REST response uses one of these envelopes. Never call `res.json()` for errors: throw an `AppError`
subclass (`backend/src/shared/errors/AppError.ts`) and let `error-handler.middleware.ts` serialize it.

```ts
// 200 / 201
{ status: "success", data: T }

// paginated list (200)
{ status: "success", data: T[], meta: { total, page, size, totalPages } }

// any error
{ status: "error", error: { code: string, message: string, details?: unknown } }
```

| Class                     | HTTP | `code`                                                                |
| ------------------------- | ---- | --------------------------------------------------------------------- |
| `BadRequestError`         | 400  | `BAD_REQUEST` (zod failures put `issues` in `details`)                |
| `UnauthorizedError`       | 401  | `UNAUTHORIZED`                                                        |
| `ForbiddenError`          | 403  | `FORBIDDEN`                                                           |
| `NotFoundError`           | 404  | `NOT_FOUND` (also unknown routes, Prisma `P2025`)                     |
| `ConflictError`           | 409  | `CONFLICT` (Prisma `P2002`)                                           |
| `TooManyRequestsError`    | 429  | `RATE_LIMIT_EXCEEDED`                                                 |
| `ServiceUnavailableError` | 503  | `SERVICE_UNAVAILABLE`                                                 |
| anything else             | 500  | `INTERNAL_SERVER_ERROR` (message is generic; details are logged only) |

`GET /api/health` returns `200` with `data.status = "ok"`, or `503` with `data.status = "degraded"`; each dependency
check times out after 2 s and is reported as `"down"`.
