# Project Guideline Improvements

This document compares our modules with the reference `banner` module that was copied from the LOS backend, and records the decisions that come out of it. The `banner` folder and the sample `post` module have since been removed (2026-11-05); the excerpts below are kept for the reasoning, and `src/modules/chat/` is now the working example of these rules. Together with the [README](../README.md), it is the reference for how modules in this project are built.

| # | Topic | Decision | Status |
| :--- | :--- | :--- | :--- |
| 1 | [How dependencies are wired](#1-how-dependencies-are-wired) | Keep **our** approach; adopt it as a rule | Implemented in `post` and `auth`; see [New rules](#new-rules) |
| 2 | [Folder layout](#2-folder-layout) | Adopt **banner's** audience split, but only when a module has more than one audience | See [Rule: split by audience](#rule-split-by-audience-when-a-second-audience-appears) |
| 3 | [Response shape](#3-response-shape) | **Start lean:** Zod validates requests, and a column whitelist (`select`) per repository controls responses. DTOs are paused. | `select` implemented in `post` and `auth`; request DTOs removed from the code (paused); response DTOs deferred |

**Open items, not decided yet:**

- **Response and error shape.** Our code and the README use a nested `error: { code, message, details }` and a top-level `meta` for lists. The LOS API uses flat errors (`{ status, code, message }`) and `data.pagination` / `contents`. Decide whether to keep ours or match LOS (this matters if the Flutter app shares its HTTP and error-parsing code with LOS), then update the README to match.

---

## 1. How dependencies are wired

### Side by side

**Banner:** the controller is injected, but the service builds its own repository, and the repository reaches for the global `prisma`.

```typescript
// admin-banner.routes.ts
const adminBannerController = new AdminBannerController(new AdminBannerService());

// admin-banner.service.ts
export class AdminBannerService {
  constructor(private bannerRepository: BannerRepository = new BannerRepository()) {}
  //                                                     ^^^^^^^^^^^^^^^^^^^^^^ hidden dependency
}

// banner.repository.ts
import { prisma } from '@config/database.js'; // global import, not injected
export class BannerRepository {
  async findById(id: number) {
    return prisma.gallery.findUnique({ where: { id } });
  }
}
```

**Ours:** every dependency, including the database client, is passed in explicitly, and all of them are created in one place.

```typescript
// post.routes.ts — the composition root
const postRepository = new PostRepository(prisma);
const postService = new PostService(postRepository);
const postController = new PostController(postService);

// post.service.ts
import type { PostRepository } from './post.repository.js'; // type-only: cannot create one
export class PostService {
  constructor(private readonly postRepository: PostRepository) {}
}

// post.repository.ts
import type { DatabaseClient } from '@config/database.js';
export class PostRepository {
  constructor(private readonly db: DatabaseClient) {}
  findById(id: string) {
    return this.db.post.findUnique({ where: { id }, select: postSelect });
  }
}
```

### Verdict: ours is better

| Concern | Banner | Ours |
| :--- | :--- | :--- |
| **Can you see every dependency?** | No. Reading `routes.ts` you can't tell the service uses a repository or that the repository uses Prisma. | Yes. The three `new` lines in `routes.ts` are the whole dependency graph. |
| **Who creates instances?** | Spread out: `routes.ts` creates the service, the service's default parameter creates the repository. | One place: `<name>.routes.ts`. |
| **Testing the service** | Works (`new AdminBannerService(mockRepo)`), but forgetting the argument silently uses the **real** repository and real DB. | The argument is required. Forgetting it is a compile error, so a unit test can never hit the DB by accident. |
| **Testing the repository** | Requires `vi.mock('@config/database.js')`, i.e. module-level mocking. | Pass a fake client: `new PostRepository(fakeDb)`. |
| **Sharing one repository** | Each `new AdminBannerService()` silently builds its own `BannerRepository`. | Build one, pass it to as many services as needed. |
| **Layer leaks** | Nothing stops a service doing `new BannerRepository()` anywhere. | Services and controllers only `import type` the layer below, so they **can't** construct it. |

Testing the repository shows the difference most clearly:

```typescript
// Banner: has to replace the whole module before importing the repository
vi.mock('@config/database.js', () => ({
  prisma: { gallery: { findUnique: vi.fn() } },
}));
const { BannerRepository } = await import('@modules/banner/shared/banner.repository.js');

// Ours: an ordinary constructor argument
const fakeDb = { post: { findUnique: vi.fn().mockResolvedValue(fakePost) } };
const repository = new PostRepository(fakeDb as unknown as DatabaseClient);
```

### New rules

These apply to every module.

1. **Every dependency comes in through the constructor, with no default values.**
   ```typescript
   // Bad: hidden dependency, and a test that forgets the argument uses the real DB
   constructor(private repo: BannerRepository = new BannerRepository()) {}

   // Good: required, visible in the composition root
   constructor(private readonly repo: BannerRepository) {}
   ```
2. **Repositories receive the database client**, as `constructor(private readonly db: DatabaseClient)`. They never import `prisma` directly.
3. **`new` only appears in `<name>.routes.ts`**, the composition root. Services and controllers import the layer below with `import type`.
4. **Dependencies are `private readonly`.** Banner uses `private`, which lets a method reassign the dependency at runtime.

---

## 2. Folder layout

### Side by side

```
banner/                                   post/
├── shared/                               ├── post.controller.ts
│   └── banner.repository.ts  ← shared    ├── post.service.ts
├── admin-banner/                         ├── post.repository.ts
│   ├── __tests__/                        ├── post.routes.ts
│   ├── admin-banner.controller.ts        ├── post.schema.ts
│   ├── admin-banner.service.ts           └── index.ts
│   ├── admin-banner.routes.ts
│   ├── admin-banner.schema.ts
│   ├── admin-banner.openapi.ts
│   └── types/admin-banner.types.ts
├── customer-banner/ …
└── guest-banner/ …
```

Banner's layout is right **because banner has three audiences** (admin, customer, guest) that see different data and follow different rules. Our `post` module currently serves one audience (customers), so a flat folder is correct for now. Splitting it today would only add empty structure.

### Rule: split by audience when a second audience appears

- **One audience:** a flat folder (`post/post.*.ts`), like today.
- **Two or more audiences:** one sub-folder per audience, named `<audience>-<module>/`, plus a `shared/` folder for the repository they all use.

The audiences in this project match the API namespaces: `customer` (`/customer/api/v1`, the Flutter app) and `agent` (`/agent/api/v1`, internal staff). Use `guest-` for public endpoints that need no login.

This is what `post` becomes when staff need to moderate posts:

```
src/modules/post/
├── shared/
│   └── post.repository.ts              ← used by both audiences
├── customer-post/
│   ├── __tests__/
│   ├── customer-post.controller.ts
│   ├── customer-post.service.ts        ← "only your own posts" rules
│   ├── customer-post.routes.ts
│   ├── customer-post.schema.ts
│   └── types/customer-post.types.ts
├── agent-post/
│   ├── agent-post.controller.ts
│   ├── agent-post.service.ts           ← moderation rules (can edit any post)
│   ├── agent-post.routes.ts            ← authenticate + role check
│   └── …
└── index.ts                            ← exports customerPostRouter, agentPostRouter
```

Each audience's `routes.ts` remains its own composition root and creates its own repository instance. Repositories hold no state, so two instances are fine:

```typescript
// customer-post/customer-post.routes.ts
const postRepository = new PostRepository(prisma);
const customerPostController = new CustomerPostController(new CustomerPostService(postRepository));
```

Splitting also needs one change outside the module. Today `app.ts` mounts a single `v1Router` at `/customer/api/v1`. When the first `agent` route arrives, give each namespace its own router:

```typescript
// src/routes/v1.ts
export const customerV1Router = Router();
customerV1Router.use('/auth', authRouter);
customerV1Router.use('/posts', customerPostRouter);

export const agentV1Router = Router();
agentV1Router.use('/posts', agentPostRouter);

// src/app.ts
app.use('/customer/api/v1', customerV1Router);
app.use('/agent/api/v1', agentV1Router);
```

### Also adopt from banner, regardless of split

- **`__tests__/` next to the code it tests**, e.g. `post/__tests__/post.service.test.ts`.
- **`types/<name>.types.ts` for response DTOs**, once they're adopted; see section 3. Request types are never hand-written there.
- **An `index.ts` that exports only the routers**, plus any instance outside code needs (like `authService` for passport). Banner's README mentions an `index.ts` that isn't actually there.

---

## 3. Response shape

### Decision (2026-11-04): start lean

Full response DTOs plus a mapper (described below) are **deferred**. With one resource and one client app, the post row is already the shape the app needs, so a mapper would mostly copy fields one by one.

The one thing a response DTO protects against, leaking columns, is covered more cheaply. Each repository declares exactly which columns it returns:

```typescript
// post.repository.ts
// * Only these columns ever reach the client; a new column stays private until it is added here
export const postSelect = {
  id: true, title: true, content: true, published: true,
  authorId: true, createdAt: true, updatedAt: true,
} as const;

findById(id: string) {
  return this.db.post.findUnique({ where: { id }, select: postSelect });
}
```

`auth.repository.ts` already does the same with `publicUserSelect`, which is what keeps `passwordHash` out of responses. Prisma infers the return type from `select`, so results stay fully typed without a separate interface.

**Request DTOs are paused too (2026-11-04).** The `z.infer` exports were removed from `post.schema.ts` and `auth.schema.ts`. Handlers now receive `req.body` / `req.query` as `any`, and services and repositories take `input: any`. Zod still validates every request at runtime. What we give up is explained in [Why we need request DTOs](#why-we-need-request-dtos-when-zod-already-validates) (example A is the code as it is now). To turn them back on, re-add `export type XInput = z.infer<typeof xSchema>; // dto` under each schema and replace the `any` parameters with it.

**Rules for now:**

1. **Every request is validated with a Zod schema** in `<name>.schema.ts`, applied with `validate()` in the routes. No request type is exported (DTOs paused).
2. **Every repository query passes a `select` whitelist** (`postSelect`, `publicUserSelect`). Never return a model without one.
3. **The `select` constant is the response contract.** To expose a new column, add it there on purpose. To hide one, leave it out.
4. **Controllers still use the standard envelope:** `{ status: 'success', data }`, plus `meta` for lists.

**Add response DTOs plus a mapper (the full proposal below) when any of these appear:**

- The response needs a **different shape** from the table: renamed fields, computed values, nested data (`author: { id, name }`), or formatted dates.
- **Two audiences** need different views of the same data (customer vs agent). See [section 2](#2-folder-layout).
- We add **OpenAPI** docs and want a written contract. At that point, consider Zod response schemas so one definition produces both the DTO type and the docs.

The rest of this section explains the terms, then documents the full approach for when a trigger appears.

### Type vs DTO

These two words get mixed up, so here is how this doc uses them.

- **Type:** any TypeScript `type` or `interface`. It describes the shape of a value, for any purpose: a database row, a helper inside a function, a config object. Types exist only at compile time.
- **DTO (Data Transfer Object):** a type with **one specific job**: to describe data that **crosses the API boundary**, either coming in from a client or going out to one. A DTO is the contract between this backend and the Flutter or web app.

> **Every DTO is a type, but not every type is a DTO.** The question to ask is "does a client send or receive exactly this shape?" If yes, it's a DTO. If it only lives inside the server, it's just a type.

A type is a DTO because of three properties:

1. **It sits at the boundary.** It's the shape of `req.body`, `req.query` or `req.params` (request DTO) or of `data` in `res.json(...)` (response DTO).
2. **It's decoupled from storage.** It's designed for the client, not copied from the table. Columns can be added, renamed or hidden without changing it, so clients don't break.
3. **It's data only.** It has fields and no methods or behavior. Converting into or out of it is done by something else (Zod for requests, the mapper for responses).

How every type in the post and auth modules classifies. The request DTOs are currently removed from the code (paused) and are listed with the names they'd have when they're turned back on:

| Type | Where | DTO? | Why |
| :--- | :--- | :--- | :--- |
| `CreatePostInput`, `UpdatePostInput` | `post.schema.ts` (paused) | **Request DTO** | Exact shape of `req.body` the client sends. Inferred from Zod, which also validates it at runtime. |
| `ListPostsQuery`, `PostIdParam` | `post.schema.ts` (paused) | **Request DTO** | Exact shape of `req.query` / `req.params`. |
| `RegisterInput`, `LoginInput` | `auth.schema.ts` (paused) | **Request DTO** | Exact shape of the auth request bodies. |
| `PostResponse`, `PostAuthorResponse` | `types/post.types.ts` (proposed) | **Response DTO** | Exact shape of `data` the client receives. Written for the client, not the table. |
| `UserResponse`, `AuthResponse` | `types/auth.types.ts` (proposed) | **Response DTO** | Same, for the auth endpoints. |
| `Post`, `User` | Prisma, `generated/prisma` | Type (entity) | Describes a **database row**. Contains `passwordHash`, `authorId` and anything else the table has. Never sent as-is. |
| `PostWithAuthor` | `post.mapper.ts` (proposed) | Type (internal) | Describes what the repository returns to the mapper. Never leaves the server. |
| `ApiSuccessResponse<T>`, `ApiPaginatedResponse<T>`, `ApiErrorResponse`, `PaginationMeta` | `shared/types/response.types.ts` (proposed) | Type (envelope) | The wrapper every response shares. It carries no resource data of its own; it **holds** a DTO in `data`. |
| `Express.User` | `shared/types/express.d.ts` | Type (internal) | The shape Passport puts on `req.user`. Today `GET /auth/me` sends it directly, which is exactly why the checklist adds a `UserResponse` DTO. |
| `toPostResponse` | `post.mapper.ts` (proposed) | Not a type | A function. It **produces** a response DTO from an entity. |

The flow through the layers:

```text
client ──request DTO──▶ validate (Zod) ──▶ controller ──▶ service ──▶ repository ──entity──▶ DB
client ◀─response DTO── controller ◀── service ◀── mapper ◀──entity── repository
```

Every DTO declaration is marked with a `// dto` comment so it's easy to spot in code and in review. Plain types get no marker.

**How ours differs from DTOs in NestJS or Spring:** those frameworks write DTOs as classes with decorators (`@IsString()`, `@Exclude()`) and convert at runtime with class-transformer. Ours are plain types: Zod produces and validates the request DTOs, and a pure function produces the response DTOs. It's the same pattern with less machinery.

### Why we need request DTOs when Zod already validates

Zod and the request DTO do different jobs:

- **The Zod schema** checks what the **client** sends, while the server runs.
- **The request DTO** (`z.infer`) checks what **we** write, when the code compiles.

Without the DTO, everything after `validate()` is `any`. Below is the same `POST /posts` flow written both ways. The only difference is the `z.infer` line and the parameter types.

#### A) Zod only (no DTO): what the code does now

```typescript
// ── post.schema.ts ──────────────────────────────────────────
export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(10_000).optional(),
  published: z.boolean().optional(),
});
// (no z.infer line, so no DTO)

// ── post.routes.ts ──────────────────────────────────────────
postRouter.post('/', validate({ body: createPostSchema }), postController.create);
// ✅ Zod still checks req.body at runtime

// ── post.controller.ts ──────────────────────────────────────
create = async (req: Request, res: Response) => {
  const post = await this.postService.create(getAuthUser(req).id, req.body);
  //                                                              ^^^^^^^^ type: any
  res.status(201).json({ status: 'success', data: post });
};

// ── post.service.ts ─────────────────────────────────────────
create(userId: string, input: any) {          // ← only option is `any`
  if (input.tittle.length > 100) { ... }      // ❌ typo, compiles fine, crashes at runtime
  return this.postRepository.create(userId, input);
}

// ── post.repository.ts ──────────────────────────────────────
create(authorId: string, data: any) {
  return this.db.post.create({
    data: {
      title: data.titel,                      // ❌ typo, compiles fine; Prisma fails at runtime
      content: data.content ?? null,
      published: data.publish ?? false,       // ❌ wrong name: always false, no error at all
      authorId,
    },
  });
}
```

**Result:** all three mistakes compile. They show up only when a request fails, and the `publish` typo never fails at all. It just silently saves the wrong value.

#### B) Zod + DTO (paused)

```typescript
// ── post.schema.ts ──────────────────────────────────────────
export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(10_000).optional(),
  published: z.boolean().optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>; // dto
// = { title: string; content?: string; published?: boolean }

// ── post.routes.ts ──────────────────────────────────────────
postRouter.post('/', validate({ body: createPostSchema }), postController.create);
// ✅ Zod checks req.body at runtime (same as A)

// ── post.controller.ts ──────────────────────────────────────
create = async (req: Request, res: Response) => {
  const post = await this.postService.create(getAuthUser(req).id, req.body as CreatePostInput);
  //                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^ safe: validate() already checked it
  res.status(201).json({ status: 'success', data: post });
};

// ── post.service.ts ─────────────────────────────────────────
create(userId: string, input: CreatePostInput) {
  if (input.tittle.length > 100) { ... }
  //        ^^^^^^ 🔴 compile error: Property 'tittle' does not exist. Did you mean 'title'?
  return this.postRepository.create(userId, input);
}

// ── post.repository.ts ──────────────────────────────────────
create(authorId: string, data: CreatePostInput) {
  return this.db.post.create({
    data: {
      title: data.titel,                      // 🔴 compile error: did you mean 'title'?
      content: data.content ?? null,          // ✅ editor knows it's string | undefined
      published: data.publish ?? false,       // 🔴 compile error: did you mean 'published'?
      authorId,
    },
  });
}
```

**Result:** all three mistakes show up as red underlines in the editor, and `pnpm run typecheck` fails. None of them reaches a running server.

#### Changing the schema later

Say a required field is added:

```typescript
export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(['news', 'chat']),   // ← new
  ...
});
```

| | A) Zod only | B) Zod + DTO |
| :--- | :--- | :--- |
| Client must send `category` | ✅ Zod enforces it | ✅ Zod enforces it |
| Repository saves `category` | ❌ Must remember to update it. Forget, and the value is silently dropped. | ✅ `data.category` autocompletes. If the DB column is required and it's missing, Prisma's types report an error. |

#### Summary

```text
                runtime (server running)        compile time (writing code)
A) Zod only     ✅ bad input → 400              ❌ everything after validate() is `any`
B) Zod + DTO    ✅ bad input → 400              ✅ every layer knows the exact shape
```

| Advantage | Zod alone | Zod + DTO |
| :--- | :--- | :--- |
| Bad input rejected early with a 400 | ✅ | ✅ |
| Data is trimmed, its length checked, extra fields stripped | ✅ | ✅ |
| The schema shows what the API accepts | ✅ | ✅ |
| Typos and wrong types caught in the controller, service and repository | ❌ everything is `any` | ✅ |
| A schema change points you to the code that has to change | ❌ | ✅ |
| Check and type can't drift | ⚠️ only with a hand-written type, which can drift (banner's problem) | ✅ |

The cost is one line per schema: `export type CreatePostInput = z.infer<typeof createPostSchema>; // dto`.

### Ours before the lean change: the raw database row

> This shows the code as it was before `postSelect`. Problem 2 below is now solved by the `select` whitelist. Problems 1, 3 and 4 remain, and they're what the full approach would fix.

```typescript
// post.service.ts
getById(userId: string, postId: string) {
  const post = await this.postRepository.findById(postId);
  …
  return post; // the Prisma `Post` entity: no response DTO
}

// post.controller.ts
getById = async (req: Request, res: Response) => { // Response is untyped (any)
  const post = await this.postService.getById(getAuthUser(req).id, id);
  res.status(200).json({ status: 'success', data: post });
};
```

The JSON the client gets is whatever columns the table happens to have:

```json
{
  "status": "success",
  "data": {
    "id": "8c1f…", "title": "Hello", "content": "First post", "published": false,
    "authorId": "3a9e…",
    "createdAt": "2026-11-04T02:10:00.000Z", "updatedAt": "2026-11-04T02:10:00.000Z"
  }
}
```

Problems:

1. **No API contract.** Nothing in the code says what `GET /posts/:id` returns. The Flutter developer has to read the Prisma schema or guess.
2. **The database leaks into the API.** Add a column (say `deletedAt` or `internalNotes`) and it is **silently sent to every client**. Rename a column and the mobile app breaks, with no TypeScript error anywhere. *(Leaking is now solved by `postSelect`. Renaming still breaks clients.)*
3. **No compile-time check on the response.** `Response` is untyped, so `res.json({ status: 'sucess', dat: post })` compiles fine.
4. **Clients only get raw ids.** To show who wrote a post, the client gets an `authorId` and must make a second request.

### Banner's approach: an improvement, with gaps

```typescript
// types/admin-banner.types.ts: hand-written response interface
// dto
export interface AdminBannerResponse {
  id: number; file: string | null; name: string | null; type: string | null; link: string | null; status: string | null;
}

// admin-banner.service.ts: map every row before returning
private async mapToResponse(banner: Gallery): Promise<AdminBannerResponse> {
  return { id: banner.id, file: await documentStorage.resolveUrl(banner.file, …), name: banner.name, … };
}

// admin-banner.controller.ts: typed Express response
listBanners = async (req: Request, res: Response<ApiResponse<AdminBannerListResponse>>) => { … };
```

**What it does well:** there's an explicit response DTO, columns are chosen deliberately, and `res.json` is type-checked.

**Gaps to avoid:**

- The same `types.ts` file also hand-writes the **request DTOs** (`AdminCreateBannerBody`). Those duplicate the Zod schemas, so a change to one can silently miss the other. A request DTO should be `z.infer<>`, so validation and type can never drift apart.
- The mapper is a `private` method of the service, so other services can't reuse it and it can't be tested on its own.
- The list is wrapped as `{ items: [...] }` without pagination `meta`, which doesn't match our paginated list contract.

### Full approach (deferred until a trigger appears)

Three pieces:

**a) Shared response envelope types:** `src/shared/types/response.types.ts`

These are **types, not DTOs**: they are the wrapper, and the DTO goes inside `data`.

```typescript
export interface PaginationMeta {
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
}

export interface ApiPaginatedResponse<T> {
  status: 'success';
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  status: 'error';
  error: { code: string; message: string; details?: unknown };
}
```

**b) Module response DTOs plus a pure mapper:** `src/modules/post/types/post.types.ts` and `post.mapper.ts`

```typescript
// types/post.types.ts: RESPONSE DTOs only (request DTOs stay z.infer in post.schema.ts)
// dto
export interface PostAuthorResponse {
  id: string;
  name: string | null;
}

// dto
export interface PostResponse {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  author: PostAuthorResponse;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

```typescript
// post.mapper.ts: plain function, no class, no I/O. Turns an entity into a response DTO.
import type { Post, User } from '@config/database.js'; // model types re-exported there, so no deep relative import
import type { PostResponse } from './types/post.types.js';

// Internal type, not a DTO: it never leaves the server
type PostWithAuthor = Post & { author: Pick<User, 'id' | 'name'> };

export const toPostResponse = (post: PostWithAuthor): PostResponse => ({
  id: post.id,
  title: post.title,
  content: post.content,
  published: post.published,
  author: { id: post.author.id, name: post.author.name },
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});
```

**c) Repository, service and controller wired to the types**

```typescript
// post.repository.ts: load the author summary with every post
const authorSummary = { author: { select: { id: true, name: true } } } as const;

findById(id: string) {
  return this.db.post.findUnique({ where: { id }, include: authorSummary });
}

// post.service.ts: the service returns DTOs, never raw rows
async getById(userId: string, postId: string): Promise<PostResponse> {
  const post = await this.postRepository.findById(postId);
  if (!post || (post.authorId !== userId && !post.published)) throw new NotFoundError('Post not found');
  return toPostResponse(post);
}

async list(userId: string, query: ListPostsQuery): Promise<{ items: PostResponse[]; meta: PaginationMeta }> {
  const { items, total } = await this.postRepository.findManyByAuthor(userId, …);
  return { items: items.map(toPostResponse), meta: { … } };
}

// post.controller.ts: the response body is type-checked
getById = async (req: Request, res: Response<ApiSuccessResponse<PostResponse>>) => {
  const post = await this.postService.getById(getAuthUser(req).id, id);
  res.status(200).json({ status: 'success', data: post });
};

list = async (req: Request, res: Response<ApiPaginatedResponse<PostResponse>>) => {
  const { items, meta } = await this.postService.list(getAuthUser(req).id, query);
  res.status(200).json({ status: 'success', data: items, meta });
};
```

The resulting JSON is a deliberate contract:

```json
{
  "status": "success",
  "data": {
    "id": "8c1f…", "title": "Hello", "content": "First post", "published": false,
    "author": { "id": "3a9e…", "name": "Alice" },
    "createdAt": "2026-11-04T02:10:00.000Z", "updatedAt": "2026-11-04T02:10:00.000Z"
  }
}
```

### Comparison

| | Current (ours, lean) | Banner | Full approach |
| :--- | :--- | :--- | :--- |
| Response DTO | None (sends the `select`ed row) | Yes | Yes |
| New DB column leaks to clients | No (`postSelect`) | No | No |
| `res.json(...)` type-checked | No | Yes | Yes |
| Request DTOs | None (paused; Zod validates only) | Hand-written ❌ (duplicates Zod) | `z.infer` ✅ |
| Mapper | None | `private` service method | Exported pure function, reusable and unit-testable |
| Shared envelope types | None | `ApiResponse<T>` | `ApiSuccessResponse`, `ApiPaginatedResponse`, `ApiErrorResponse` |
| Related data (author) | id only | n/a | Small embedded summary |
| Dates | Implicit `Date` → string | n/a | Explicit ISO strings |

### Rules for the full approach (apply when it is adopted)

1. **Services return response DTOs, never raw Prisma entities.** Controllers send what the service returns.
2. **Response DTOs live in `types/<name>.types.ts`** as interfaces named `<Thing>Response`. Request DTOs stay `z.infer<>` in `<name>.schema.ts`, named `<Action><Thing>Input` / `Query` / `Param`; never hand-write them.
3. **Mark every DTO with a `// dto` comment.** Internal, entity and envelope types get no marker. If you can't decide, ask "does a client send or receive exactly this shape?"
4. **Mapping is an exported pure function** in `<name>.mapper.ts` (`toPostResponse`), not a private method.
5. **Controllers type their response:** `Response<ApiSuccessResponse<T>>` or `Response<ApiPaginatedResponse<T>>`, where `T` is a response DTO.
6. **Dates are ISO 8601 strings**; nullable columns stay `null`, not omitted.
7. **Never expose secrets or internal columns.** `passwordHash` is already excluded via `publicUserSelect`; the response DTO makes this explicit for every model.

### Implementation checklist

Done now (lean):

- [x] Add `postSelect` to every query in `post.repository.ts` (`auth` already uses `publicUserSelect`)
- [x] Remove the request DTOs (`z.infer` exports) and use `any` in handlers, services and repositories (paused on 2026-11-04)

Later, when a trigger appears (full approach):

- [ ] Re-add the request DTOs (`z.infer` + `// dto`) and replace the `any` parameters
- [ ] Add `src/shared/types/response.types.ts`
- [ ] Re-export model types from `src/config/database.ts`: `export type { Post, User } from '../../generated/prisma/client.js';`
- [ ] `post`: add `types/post.types.ts`, `post.mapper.ts`, and include the author in repository queries
- [ ] `post`: return DTOs from `PostService`, and type the controller responses
- [ ] `auth`: add `UserResponse` and `AuthResponse` (`{ user, accessToken }`) types, and type the controller responses
- [ ] Update `postman/chat_backend.postman_collection.json` to check `data.author`
- [ ] Update the README's response-shape section, and mark the rules above as active
