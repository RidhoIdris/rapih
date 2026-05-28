# worker-ai (Chunk A — Tanya) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chunk A of the `ai-worker` sub-project: scaffold `apps/worker-ai`, deliver multi-session "Tanya" LLM chat end-to-end (schema → API → worker → mobile), with streaming via Redis pubsub → SSE bridge, 5 read-only tools, and cost logging.

**Architecture:** New BullMQ queue `ai`. API enqueues `tanya.chat-completion` jobs and exposes an SSE endpoint that bridges Redis pubsub channel `tanya:${job_id}` to the client. Worker calls OpenAI streaming, runs tool calls in a bounded loop (MAX_ITERATIONS=5), publishes token/tool/done/error events, then persists assistant + tool messages and a usage log row. Mobile uses `expo/fetch` streaming for the SSE client.

**Tech Stack:** Node 22 / TypeScript / Fastify (worker has `/health` only) / BullMQ + ioredis / Prisma 6 / OpenAI SDK v4.x / Pino / Vitest. Mobile: Expo SDK 55 + Zustand + `expo/fetch`.

**Spec:** `docs/superpowers/specs/2026-05-28-worker-ai-tanya-design.md` — reference for big code blocks, pseudocode, schemas.

**Branch:** Create `feat/worker-ai-tanya` from `main` **before Task 1's first commit**:

```bash
git checkout main
git pull --ff-only
git checkout -b feat/worker-ai-tanya
```

Do not merge this branch without explicit user approval (per locked user constraint).

**Workflow note:** Batch file writes per task, then run `pnpm check` + relevant `pnpm test` once at the end of the task. Each task = atomic commit. Match Biome config when writing (single quotes, semicolons, es5 trailing commas, alphabetical imports).

**Security locks (Spine):** Never trust client-provided `user_id` — always derive from `req.user.id`. Cross-user access returns **404**, not 403. Always scope by `user_id` AND `deleted_at: null`. Always wrap routes with `onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus]`. BigInt values over the wire as numeric strings.

---

## Task 1: Schema migration — `ai_sessions`, `ai_messages`, `ai_usage_logs`

**Files:**

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_ai_chat/migration.sql` (generated)

- [ ] **Step 1: Add enums + models to schema**

Append to `packages/db/prisma/schema.prisma` (place enums near the other enums; place models after the existing notification model or at end of file):

```prisma
enum AiRole {
  user
  assistant
  tool
}

enum AiUsageKind {
  chat
  ocr
  weekly_review
}

model AiSession {
  id              String    @id @default(cuid())
  user_id         String
  title           String    @default("")
  created_at      DateTime  @default(now())
  last_message_at DateTime  @default(now())
  deleted_at      DateTime?

  user     User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  messages AiMessage[]

  @@index([user_id, deleted_at, last_message_at])
  @@map("ai_sessions")
}

model AiMessage {
  id          String   @id @default(cuid())
  session_id  String
  role        AiRole
  content     String
  tool_name   String?
  tool_args   Json?
  tool_result Json?
  created_at  DateTime @default(now())

  session AiSession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([session_id, created_at])
  @@map("ai_messages")
}

model AiUsageLog {
  id                String      @id @default(cuid())
  user_id           String
  session_id        String?
  kind              AiUsageKind
  model             String
  prompt_tokens     Int
  completion_tokens Int
  total_tokens      Int
  cost_usd          Decimal     @db.Decimal(10, 6)
  created_at        DateTime    @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, created_at])
  @@map("ai_usage_logs")
}
```

- [ ] **Step 2: Add relation back-refs on `User`**

In the `User` model relations block, add (alphabetical placement):

```prisma
ai_sessions   AiSession[]
ai_usage_logs AiUsageLog[]
```

- [ ] **Step 3: Generate migration**

```bash
pnpm --filter @rapih/db exec prisma migrate dev --name add_ai_chat --create-only
```

Inspect generated SQL — must create both enums (`AiRole`, `AiUsageKind`), all three tables with correct indexes, and FK CASCADE on `user_id` / `session_id`.

- [ ] **Step 4: Apply migration to dev + test DBs, rebuild client**

```bash
pnpm --filter @rapih/db exec prisma migrate deploy
DATABASE_URL="postgresql://rapih:rapih@localhost:5433/rapih_test" pnpm --filter @rapih/db exec prisma migrate deploy
pnpm --filter @rapih/db build
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add ai_sessions, ai_messages, ai_usage_logs

Schema for the Tanya multi-session LLM chat (Chunk A of ai-worker).
Adds AiRole + AiUsageKind enums, three tables, and User back-refs.
Tool-call rows live alongside user/assistant rows so transcripts are replayable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared types + error codes

**Files:**

- Create: `packages/shared/src/tanya/enums.ts`
- Create: `packages/shared/src/tanya/schemas.ts`
- Create: `packages/shared/src/tanya/index.ts`
- Modify: `packages/shared/src/index.ts` — export tanya
- Modify: `packages/shared/src/errors.ts` — add 3 codes

- [ ] **Step 1: `packages/shared/src/tanya/enums.ts`**

```ts
import { z } from 'zod';

export const AiRoleSchema = z.enum(['user', 'assistant', 'tool']);
export type AiRole = z.infer<typeof AiRoleSchema>;
```

- [ ] **Step 2: `packages/shared/src/tanya/schemas.ts`**

```ts
import { z } from 'zod';
import { AiRoleSchema } from './enums.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const AiSessionDto = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  last_message_at: z.string(),
});
export type AiSessionDto = z.infer<typeof AiSessionDto>;

export const AiMessageDto = z.object({
  id: z.string(),
  session_id: z.string(),
  role: AiRoleSchema,
  content: z.string(),
  tool_name: z.string().nullable(),
  tool_args: z.unknown().nullable(),
  tool_result: z.unknown().nullable(),
  created_at: z.string(),
});
export type AiMessageDto = z.infer<typeof AiMessageDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateSessionBody = z.object({
  title: z.string().max(120).optional(),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBody>;

export const SendMessageBody = z.object({
  text: z.string().min(1).max(4000),
});
export type SendMessageBody = z.infer<typeof SendMessageBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const ListSessionsResponse = z.object({
  ok: z.literal(true),
  data: z.object({ sessions: z.array(AiSessionDto) }),
});
export type ListSessionsResponse = z.infer<typeof ListSessionsResponse>;

export const CreateSessionResponse = z.object({
  ok: z.literal(true),
  data: z.object({ session: AiSessionDto }),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;

export const ListMessagesResponse = z.object({
  ok: z.literal(true),
  data: z.object({ messages: z.array(AiMessageDto) }),
});
export type ListMessagesResponse = z.infer<typeof ListMessagesResponse>;

export const SendMessageResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    user_message: AiMessageDto,
    job_id: z.string(),
  }),
});
export type SendMessageResponse = z.infer<typeof SendMessageResponse>;

export const DeleteSessionResponse = z.object({
  ok: z.literal(true),
});
export type DeleteSessionResponse = z.infer<typeof DeleteSessionResponse>;
```

- [ ] **Step 3: `packages/shared/src/tanya/index.ts`**

```ts
export * from './enums.js';
export * from './schemas.js';
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

Add the tanya export in alphabetical position:

```ts
export * from './tanya/index.js';
```

- [ ] **Step 5: Update `packages/shared/src/errors.ts`**

Add three new entries to the `ERROR_CODES` map (alphabetical):

```ts
'tanya.job_not_found': { http: 404, message: 'Sesi streaming tidak ditemukan.' },
'tanya.session_not_found': { http: 404, message: 'Sesi Tanya tidak ditemukan.' },
'tier.upgrade_required': { http: 403, message: 'Fitur ini butuh Rapih Plus.' },
```

(Match the existing entry shape — verify by reading the current file first.)

- [ ] **Step 6: Build + commit**

```bash
pnpm --filter @rapih/shared build
git add packages/shared/
git commit -m "$(cat <<'EOF'
feat(shared): add tanya types + tier/tanya error codes

DTOs and request/response schemas for the Tanya chat API (sessions, messages,
send/stream). Also adds tier.upgrade_required and tanya.* error codes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: API plumbing — env, Redis, `requirePlus`, `aiQueue` producer

**Files:**

- Modify: `apps/api/src/config/env.ts` — add `REDIS_URL`
- Create: `apps/api/src/lib/redis.ts`
- Modify: `apps/api/src/auth/decorators.ts` — `requirePlus`
- Create: `apps/api/src/producers/ai-queue.ts`
- Modify: `apps/api/.env.example` — add `REDIS_URL`
- Modify root `.env.example` — add `REDIS_URL`, `OPENAI_API_KEY`

- [ ] **Step 1: `apps/api/src/config/env.ts` — add `REDIS_URL`**

Add to the zod schema (preserve existing fields):

```ts
REDIS_URL: z.string().url(),
```

- [ ] **Step 2: `apps/api/src/lib/redis.ts`** (new)

```ts
import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const env = loadEnv();
    client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
```

- [ ] **Step 3: `apps/api/src/auth/decorators.ts` — add `requirePlus`**

Update the `declare module` block to include `requirePlus`:

```ts
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOnboarding: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePlus: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
```

Inside the plugin, after `requireOnboarding`, add:

```ts
const requirePlus = async (req: FastifyRequest, _reply: FastifyReply) => {
  if (!req.user) {
    throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
  }
  if (req.user.tier === 'free') {
    throw new AppError('tier.upgrade_required', 'Fitur ini butuh Rapih Plus.', 403);
  }
};
app.decorate('requirePlus', requirePlus);
```

- [ ] **Step 4: `apps/api/src/producers/ai-queue.ts`** (new)

```ts
import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let queue: Queue | null = null;

export function getAiQueue(): Queue {
  if (!queue) {
    queue = new Queue('ai', { connection: getRedis() });
  }
  return queue;
}

export async function closeAiQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
```

- [ ] **Step 5: Update env example files**

`apps/api/.env.example`: add line `REDIS_URL=redis://localhost:6379`.

Root `.env.example`: add lines `REDIS_URL=redis://localhost:6379` and `OPENAI_API_KEY=`.

- [ ] **Step 6: Verify pnpm install picks up ioredis + bullmq for api**

```bash
cd apps/api && pnpm add ioredis@5.10.1 bullmq && cd ../..
```

Pin `ioredis` to `5.10.1` exactly (lesson from worker-reminder — BullMQ peer-dep mismatch with newer ioredis).

- [ ] **Step 7: Build + commit**

```bash
pnpm --filter @rapih/api typecheck
git add apps/api/ .env.example
git commit -m "$(cat <<'EOF'
feat(api): redis client, ai queue producer, requirePlus guard

Foundations for Tanya: REDIS_URL env, ioredis singleton, aiQueue producer,
and the requirePlus decorator that gates Plus-only routes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API — `/tanya` routes + tests

**Files:**

- Create: `apps/api/src/routes/tanya.ts`
- Modify: `apps/api/src/routes/index.ts` — register tanya routes
- Modify: `apps/api/src/plugins/swagger.ts` — add `tanya` tag
- Modify: `apps/api/tests/helpers/test-db.ts` — TRUNCATE new tables
- Create: `apps/api/tests/helpers/test-redis.ts` (if absent)
- Create: `apps/api/tests/tanya.test.ts`

- [ ] **Step 1: `apps/api/src/routes/tanya.ts`** — REST endpoints (SSE handler added in Task 5)

Implements:

```
GET    /tanya/sessions               → list (deleted_at IS NULL, desc by last_message_at)
POST   /tanya/sessions               → create
DELETE /tanya/sessions/:id           → soft-delete
GET    /tanya/sessions/:id/messages  → all messages, oldest→newest
POST   /tanya/sessions/:id/messages  → insert user msg + enqueue job + return { user_message, job_id }
```

Every route uses `onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus]`. All `:id` lookups scope by `user_id: req.user.id` AND `deleted_at: null`. Cross-user / not-found → `404 tanya.session_not_found`.

For `POST /tanya/sessions/:id/messages`:

```ts
const job_id = createId(); // from @paralleldrive/cuid2 (or whatever util the api uses for cuids)
const userMessage = await app.db.$transaction(async (tx) => {
  const session = await tx.aiSession.findFirst({
    where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
  });
  if (!session) throw new AppError('tanya.session_not_found', '...', 404);
  const msg = await tx.aiMessage.create({
    data: { session_id: session.id, role: 'user', content: req.body.text },
  });
  await tx.aiSession.update({ where: { id: session.id }, data: { last_message_at: new Date() } });
  return msg;
});
await getAiQueue().add(
  'tanya.chat-completion',
  { user_id: req.user.id, session_id: req.params.id, user_message_id: userMessage.id, job_id },
  { jobId: job_id, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
);
return reply.send({ ok: true, data: { user_message: toMessageDto(userMessage), job_id } });
```

`toMessageDto` serializes `tool_args` / `tool_result` (cast unknown JSON), and returns ISO strings for dates. Mirror the pattern used in `notifications.ts`.

For `DELETE /tanya/sessions/:id`: `updateMany` with `where: { id, user_id, deleted_at: null }` → set `deleted_at: new Date()`. If `count === 0` → 404.

For `GET /tanya/sessions/:id/messages`: return all messages (no pagination cap in v1; ordered by `created_at ASC`).

Add Zod request/response schemas via `fastify-type-provider-zod` using the shared types from `packages/shared/src/tanya/`.

- [ ] **Step 2: Register in `apps/api/src/routes/index.ts`**

Add import and register call alongside the other route modules (alphabetical position).

- [ ] **Step 3: `apps/api/src/plugins/swagger.ts`**

Add `{ name: 'tanya', description: 'AI chat (Plus)' }` to the tags array.

- [ ] **Step 4: `apps/api/tests/helpers/test-db.ts`**

Add `'ai_messages'`, `'ai_sessions'`, `'ai_usage_logs'` to the TRUNCATE list (alphabetical; tool/session dependencies handled by CASCADE so order does not matter when using `TRUNCATE ... CASCADE`).

- [ ] **Step 5: `apps/api/tests/helpers/test-redis.ts`** (create if missing)

```ts
import { Redis } from 'ioredis';

let testRedis: Redis | null = null;

export function getTestRedis(): Redis {
  if (!testRedis) {
    testRedis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/15', {
      maxRetriesPerRequest: null,
    });
  }
  return testRedis;
}

export async function flushTestRedis(): Promise<void> {
  await getTestRedis().flushdb();
}

export async function closeTestRedis(): Promise<void> {
  if (testRedis) {
    await testRedis.quit();
    testRedis = null;
  }
}
```

- [ ] **Step 6: `apps/api/tests/tanya.test.ts` (REST endpoints only — SSE in Task 5)**

Tests:

1. `GET /tanya/sessions` without token → 401
2. `GET /tanya/sessions` user without onboarding → 403 `onboarding.required`
3. `GET /tanya/sessions` Free user → 403 `tier.upgrade_required`
4. `GET /tanya/sessions` Plus user → 200 with empty list
5. `POST /tanya/sessions` creates a row; appears in list ordered desc by `last_message_at`
6. `POST /tanya/sessions` with title → uses provided title
7. `DELETE /tanya/sessions/:id` soft-deletes; subsequent list omits it
8. `DELETE /tanya/sessions/:id` for another user's session → 404
9. `GET /tanya/sessions/:id/messages` returns messages oldest→newest, including tool rows
10. `GET /tanya/sessions/:id/messages` for cross-user session → 404
11. `POST /tanya/sessions/:id/messages`:
    - persists user `AiMessage` row
    - bumps `session.last_message_at`
    - enqueues a `tanya.chat-completion` job (verify via `aiQueue.getJob(job_id)` shape: data has correct user_id, session_id, user_message_id)
    - returns `{ user_message, job_id }`
12. `POST /tanya/sessions/:id/messages` for cross-user session → 404
13. `POST /tanya/sessions/:id/messages` for deleted session → 404
14. Free user → all routes → 403 (one sanity test)

Test setup: `beforeEach` truncates DB + `flushdb` Redis. Build the BullMQ queue inside the test process using the same `REDIS_URL` as the app (DB 15). `afterAll` closes Redis connections.

- [ ] **Step 7: Run check + tests**

```bash
pnpm --filter @rapih/api typecheck
pnpm --filter @rapih/api test tanya
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/
git commit -m "$(cat <<'EOF'
feat(api): tanya REST routes (sessions + messages)

Endpoints for listing/creating/deleting Tanya sessions and listing/sending
messages. Sending a message enqueues a tanya.chat-completion job on the
ai queue and returns the job_id for the mobile client to subscribe to.

All routes gated by authenticate + requireOnboarding + requirePlus.
Cross-user access returns 404 (no existence leak).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: API — SSE bridge endpoint + tests

**Files:**

- Modify: `apps/api/src/routes/tanya.ts` — add `GET /tanya/jobs/:job_id/stream`
- Modify: `apps/api/tests/tanya.test.ts` — add SSE tests

- [ ] **Step 1: Add SSE handler**

Per spec § 6.4. Key behaviors:

- Verify job ownership: `getAiQueue().getJob(req.params.job_id)` → if missing OR `data.user_id !== req.user.id` → `404 tanya.job_not_found`.
- Write SSE headers; set up a **separate** Redis client via `getRedis().duplicate()` for subscription.
- Subscribe to `tanya:${job_id}`; forward each message as `data: ${payload}\n\n`.
- 15s heartbeat (`: ping\n\n`).
- On parsed event type `done` or `error`, call cleanup (unsubscribe + quit + clearInterval + `reply.raw.end()`).
- `req.raw.on('close', cleanup)` to handle client disconnect.
- Wrap with `onRequest: [app.authenticate, app.requirePlus]` only (skip `requireOnboarding` since Plus-only already implies onboarded; mirror the simpler decorator chain for streaming endpoint — but verify by reading existing patterns. **Decision:** include `requireOnboarding` too for consistency).

- [ ] **Step 2: Add SSE tests**

Tests:

1. `GET /tanya/jobs/:job_id/stream` without token → 401
2. Free user → 403
3. Non-existent job_id → 404
4. Cross-user job_id → 404 (create job for user A, request as user B)
5. Owned job_id → 200 with `content-type: text/event-stream`; after publishing `{ type: 'done', message_id: 'x' }` to the channel, the response body contains `data: {"type":"done","message_id":"x"}` and the connection closes

For test (5): inject the request via `app.inject({ method: 'GET', url: ... })` does NOT support streams — instead use `light-my-request` raw mode OR start the actual server on a random port and use `fetch` with `ReadableStream` reading. Simpler: use `supertest`-style raw http with `node:http.request` against `app.listen({ port: 0 })`. Mirror whatever pattern other streaming tests use; if none exist, prefer the `app.listen` + `fetch` approach.

After connection is open, `getTestRedis().publish('tanya:${job_id}', JSON.stringify({...}))`; read the response stream; assert frame received; assert connection closes within 1s after `done` event.

- [ ] **Step 3: Run check + tests + commit**

```bash
pnpm --filter @rapih/api typecheck
pnpm --filter @rapih/api test tanya
git add apps/api/
git commit -m "$(cat <<'EOF'
feat(api): SSE bridge endpoint for tanya streaming

GET /tanya/jobs/:job_id/stream subscribes to redis channel tanya:<job_id>
and forwards every published event as SSE data frames. Heartbeat every 15s.
Verifies job ownership before subscribing — cross-user requests return 404.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `apps/worker-ai` scaffold

**Files:** entire new app skeleton (mirrors `apps/worker-reminder` structure)

- Create: `apps/worker-ai/package.json`
- Create: `apps/worker-ai/tsconfig.json`
- Create: `apps/worker-ai/.env.example`
- Create: `apps/worker-ai/Dockerfile`
- Create: `apps/worker-ai/src/config/env.ts`
- Create: `apps/worker-ai/src/lib/logger.ts`
- Create: `apps/worker-ai/src/lib/redis.ts`
- Create: `apps/worker-ai/src/lib/prisma.ts`
- Create: `apps/worker-ai/src/lib/openai.ts`
- Create: `apps/worker-ai/src/lib/cost.ts`
- Create: `apps/worker-ai/src/queues/ai.ts`
- Create: `apps/worker-ai/src/worker.ts` (dispatcher; handlers wired in Task 8)
- Create: `apps/worker-ai/src/server.ts`
- Create: `apps/worker-ai/tests/helpers/test-redis.ts`
- Create: `apps/worker-ai/tests/helpers/test-db.ts`
- Create: `apps/worker-ai/tests/helpers/test-env.ts`
- Create: `apps/worker-ai/tests/helpers/openai-mock.ts`

- [ ] **Step 1: Copy structure from `apps/worker-reminder`**

Start from the existing worker-reminder app (package.json, tsconfig, Dockerfile, src/lib/*) — read each file and adapt:

- `package.json` name → `@rapih/worker-ai`. Add deps: `openai` (latest v4). Keep BullMQ + ioredis pinned (`ioredis: "5.10.1"` exact).
- `tsconfig.json` → identical (extends root tsconfig).
- `Dockerfile` → identical; final `CMD ["node", "dist/server.js"]`.

- [ ] **Step 2: `src/config/env.ts`**

```ts
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  MAX_CONTEXT_MESSAGES: z.coerce.number().int().min(1).max(200).default(20),
  MAX_ITERATIONS: z.coerce.number().int().min(1).max(10).default(5),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('Asia/Jakarta'),
});

let cached: z.infer<typeof Env> | null = null;
export function loadEnv() {
  if (!cached) cached = Env.parse(process.env);
  return cached;
}
```

- [ ] **Step 3: `src/lib/logger.ts`, `redis.ts`, `prisma.ts`**

Copy verbatim from worker-reminder. They are stack-identical (pino, ioredis singleton with `maxRetriesPerRequest: null`, PrismaClient singleton from `@rapih/db`).

- [ ] **Step 4: `src/lib/openai.ts`**

```ts
import OpenAI from 'openai';
import { loadEnv } from '../config/env.js';

let client: OpenAI | null = null;
let injected: OpenAI | null = null;

export function getOpenAi(): OpenAI {
  if (injected) return injected;
  if (!client) {
    const env = loadEnv();
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

// Test seam — replace the client with a fake.
export function __setOpenAiForTests(fake: OpenAI | null): void {
  injected = fake;
}
```

- [ ] **Step 5: `src/lib/cost.ts`**

```ts
import { Prisma } from '@rapih/db';

const PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
};

export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): Prisma.Decimal {
  const rate = PRICING[model];
  if (!rate) return new Prisma.Decimal(0);
  const cost =
    (promptTokens / 1000) * rate.promptPer1k +
    (completionTokens / 1000) * rate.completionPer1k;
  return new Prisma.Decimal(cost.toFixed(6));
}
```

- [ ] **Step 6: `src/queues/ai.ts`**

```ts
import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let queue: Queue | null = null;
export function getAiQueue(): Queue {
  if (!queue) queue = new Queue('ai', { connection: getRedis() });
  return queue;
}
```

- [ ] **Step 7: `src/worker.ts` — dispatcher**

```ts
import { Worker, type Job } from 'bullmq';
import { getRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';

type Dispatcher = (job: Job) => Promise<void>;

export function startWorker(handlers: Record<string, Dispatcher>): Worker {
  const worker = new Worker(
    'ai',
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) {
        logger.warn({ jobName: job.name }, 'no handler registered');
        return;
      }
      await handler(job);
    },
    { connection: getRedis() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id, jobName: job?.name }, 'job failed'));
  return worker;
}
```

- [ ] **Step 8: `src/server.ts` — entrypoint**

Mirror `worker-reminder/src/server.ts`:

- Connect Prisma.
- Register handler map (empty for now; Task 8 will add `tanya.chat-completion`).
- `startWorker(handlers)`.
- Start a minimal Fastify HTTP server with `GET /health` returning `{ ok: true }`.
- SIGTERM handler closes worker + prisma + redis + http.

For Task 6 leave the handler map empty — code will be added in Task 8. This keeps the scaffold buildable and the dispatcher works (logs "no handler registered" on unknown job names — that's fine until Task 8).

- [ ] **Step 9: `.env.example`**

```
NODE_ENV=development
DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
MAX_CONTEXT_MESSAGES=20
MAX_ITERATIONS=5
LOG_LEVEL=info
TZ=Asia/Jakarta
```

- [ ] **Step 10: Test helpers**

`tests/helpers/test-redis.ts` — copy from worker-reminder.

`tests/helpers/test-db.ts` — copy from worker-reminder but TRUNCATE list adds `ai_sessions`, `ai_messages`, `ai_usage_logs`.

`tests/helpers/test-env.ts` — sets `OPENAI_API_KEY=test`, `OPENAI_MODEL=gpt-4o-mini`, `REDIS_URL=redis://localhost:6379/15`, `MAX_CONTEXT_MESSAGES=20`, `MAX_ITERATIONS=5`.

`tests/helpers/openai-mock.ts`:

```ts
import OpenAI from 'openai';

export type ScriptedChunk =
  | { content?: string }
  | { toolCall?: { id: string; name: string; argumentsJson: string } }
  | { usage?: { prompt_tokens: number; completion_tokens: number } }
  | { finish?: 'stop' | 'tool_calls' };

export type ScriptedTurn = ScriptedChunk[];

// Build a fake OpenAI client whose chat.completions.create returns scripted async iterables.
// Multiple scripted turns supported (one per .create() call) for tool-loop flows.
export function buildOpenAiMock(turns: ScriptedTurn[]): OpenAI {
  let turnIdx = 0;
  const fake = {
    chat: {
      completions: {
        create: async (_args: unknown) => {
          const turn = turns[turnIdx++] ?? [];
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const c of turn) {
                if ('content' in c && c.content) {
                  yield { choices: [{ delta: { content: c.content } }] };
                } else if ('toolCall' in c && c.toolCall) {
                  yield {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: c.toolCall.id,
                              type: 'function',
                              function: { name: c.toolCall.name, arguments: c.toolCall.argumentsJson },
                            },
                          ],
                        },
                      },
                    ],
                  };
                } else if ('usage' in c && c.usage) {
                  yield { choices: [{ delta: {} }], usage: c.usage };
                } else if ('finish' in c) {
                  yield { choices: [{ delta: {}, finish_reason: c.finish }] };
                }
              }
            },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return fake;
}
```

- [ ] **Step 11: Install + typecheck**

```bash
pnpm install
pnpm --filter @rapih/worker-ai build
```

Expected: `apps/worker-ai/dist/` populated; no TS errors.

- [ ] **Step 12: Wire workspace + commit**

Verify `apps/worker-ai` is included in workspace (root `pnpm-workspace.yaml` already includes `apps/*`).

```bash
git add apps/worker-ai/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(worker-ai): scaffold — env, redis, prisma, openai, cost, worker

New BullMQ worker app scaffolded with empty handler map. Includes pricing
table for gpt-4o-mini/gpt-4o, OpenAI client with test seam, /health server,
and SIGTERM shutdown. Handlers wired in next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Tools — 5 read-only Prisma queries

**Files:**

- Create: `apps/worker-ai/src/tools/types.ts`
- Create: `apps/worker-ai/src/tools/list-transactions.ts`
- Create: `apps/worker-ai/src/tools/summarize-month.ts`
- Create: `apps/worker-ai/src/tools/get-budgets.ts`
- Create: `apps/worker-ai/src/tools/get-goals.ts`
- Create: `apps/worker-ai/src/tools/get-wallets.ts`
- Create: `apps/worker-ai/src/tools/index.ts`
- Create: `apps/worker-ai/tests/tools/list-transactions.test.ts`
- Create: `apps/worker-ai/tests/tools/summarize-month.test.ts`
- Create: `apps/worker-ai/tests/tools/get-budgets.test.ts`
- Create: `apps/worker-ai/tests/tools/get-goals.test.ts`
- Create: `apps/worker-ai/tests/tools/get-wallets.test.ts`

- [ ] **Step 1: `tools/types.ts`** — shared `ToolDef`

```ts
import type { PrismaClient } from '@rapih/db';
import type { z } from 'zod';

export type ToolContext = { userId: string; prisma: PrismaClient };

export type ToolDef<TArgs = unknown> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // OpenAI JSONSchema
  argsSchema: z.ZodType<TArgs>;
  run: (args: TArgs, ctx: ToolContext) => Promise<unknown>;
};
```

- [ ] **Step 2: Implement 5 tools**

Each tool file exports a single `ToolDef`. All return money as numeric strings (BigInt rule). All filter `user_id` AND `deleted_at: null` on every table that has those columns.

`list-transactions.ts`:

- args: `{ since?: string (ISO date), until?: string (ISO date), limit?: 1..50, kind?: 'income'|'expense' }`
- query: `prisma.transaction.findMany({ where: { user_id, deleted_at: null, transacted_at: range, kind }, take: Math.min(limit ?? 20, 50), orderBy: { transacted_at: 'desc' }, include: { category: true, wallet: true } })`
- returns: `{ transactions: [{ id, transacted_at, kind, amount: amount.toString(), category_name, note, wallet_name }] }`

`summarize-month.ts`:

- args: `{ month: string ('YYYY-MM') }`
- compute start/end of the month in Asia/Jakarta tz.
- query transactions in range, group manually by `category_id` for `by_category`, sum income vs expense.
- returns: `{ income, expense, net, by_category: [{ name, total }] }` (all amounts as strings).

`get-budgets.ts`:

- args: `{ month?: 'YYYY-MM' }` defaults to current.
- Use existing budget logic from `apps/api/src/routes/budgets.ts` (same calc) — but **do not import from apps/api** (Spine rule). Reimplement here (or extract to shared if too large; for v1 reimplement).
- returns: `{ budgets: [{ category_name, limit, spent, remaining }] }` (strings).

`get-goals.ts`:

- args: `{}`
- query: `prisma.goal.findMany({ where: { user_id, deleted_at: null } })`
- compute `progress_pct = floor((saved / target) * 100)` (using bigint math, convert at the end).
- returns: `{ goals: [{ id, name, target, saved, deadline (ISO date or null), progress_pct }] }` (amounts as strings).

`get-wallets.ts`:

- args: `{}`
- query: `prisma.wallet.findMany({ where: { user_id, deleted_at: null } })`
- returns: `{ wallets: [{ id, name, kind, balance: balance.toString() }] }`

- [ ] **Step 3: `tools/index.ts`**

```ts
import { listTransactionsTool } from './list-transactions.js';
import { summarizeMonthTool } from './summarize-month.js';
import { getBudgetsTool } from './get-budgets.js';
import { getGoalsTool } from './get-goals.js';
import { getWalletsTool } from './get-wallets.js';
import type { ToolDef } from './types.js';

export const TOOLS: Record<string, ToolDef> = {
  list_transactions: listTransactionsTool,
  summarize_month: summarizeMonthTool,
  get_budgets: getBudgetsTool,
  get_goals: getGoalsTool,
  get_wallets: getWalletsTool,
};

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));
```

- [ ] **Step 4: Tests per tool (3-5 tests each)**

`list-transactions.test.ts`:

- returns only requesting user's rows
- excludes deleted (`deleted_at IS NOT NULL`)
- kind filter ('expense' only returns expenses)
- limit cap (request 999 → returns ≤50)
- amount serialized as string

`summarize-month.test.ts`:

- groups by category correctly
- income/expense split correct
- amounts as strings
- empty month returns `{ income: '0', expense: '0', net: '0', by_category: [] }`

`get-budgets.test.ts`:

- user scoping
- default month = current
- spent matches sum of expense in that month for that category

`get-goals.test.ts`:

- user scoping
- soft-delete excluded
- progress_pct math correct (e.g. saved=500, target=2000 → 25)

`get-wallets.test.ts`:

- user scoping
- soft-delete excluded
- balance as string

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @rapih/worker-ai typecheck
pnpm --filter @rapih/worker-ai test tools
git add apps/worker-ai/src/tools/ apps/worker-ai/tests/tools/
git commit -m "$(cat <<'EOF'
feat(worker-ai): five read-only tools for Tanya

list_transactions, summarize_month, get_budgets, get_goals, get_wallets.
All scope by user_id, exclude soft-deleted rows, and return money as numeric
strings (BigInt wire rule).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `tanya-chat` handler — streaming + tool loop

**Files:**

- Create: `apps/worker-ai/src/handlers/system-prompt.ts`
- Create: `apps/worker-ai/src/handlers/tanya-chat.ts`
- Modify: `apps/worker-ai/src/server.ts` — register `tanya.chat-completion` handler
- Create: `apps/worker-ai/tests/tanya-chat.test.ts`
- Create: `apps/worker-ai/tests/cost.test.ts`

- [ ] **Step 1: `handlers/system-prompt.ts`**

```ts
export const SYSTEM_PROMPT = `Kamu adalah "Tanya", asisten keuangan untuk pengguna Rapih (aplikasi keuangan personal Indonesia).

Aturan:
- Jawab dalam Bahasa Indonesia yang ramah dan singkat.
- Format angka Rupiah dengan prefix "Rp" dan separator ribuan (mis. Rp 1.250.000).
- Gunakan tools yang tersedia untuk mengambil data pengguna sebelum menjawab pertanyaan tentang transaksi, budget, goal, atau wallet.
- Jangan mengarang angka. Kalau data tidak ada, bilang terus terang.
- Tools bersifat read-only. Kalau pengguna minta mengubah data, arahkan ke fitur aplikasi yang sesuai.
- Jangan menebak ID atau detail data — selalu panggil tool.
`;
```

- [ ] **Step 2: `handlers/tanya-chat.ts`** — implement per spec § 7.1 pseudocode

Key details:

- Type the job payload:
  ```ts
  type TanyaChatPayload = { user_id: string; session_id: string; user_message_id: string; job_id: string };
  ```
- `loadHistory(session_id, limit)` selects `WHERE role IN ('user','assistant') ORDER BY created_at DESC LIMIT ?`, reverses, maps to `{ role, content }`. **Excludes tool rows from the model context** (they remain in DB for transcript reconstruction).
- Stream consumption: aggregate `delta.content` into `textThisRound`. Tool-call deltas accumulate `arguments` (may arrive in fragments). Watch for `chunk.usage` (only present on final chunk when `stream_options.include_usage: true`).
- After loop iteration: if no tool_call → break.
- If tool_call: parse args; if invalid → tool_result = `{ error: 'invalid_args', detail }`; else run tool.
- Append assistant tool-call message + tool message to the local `messages` array; loop.
- **MAX_ITERATIONS exceeded:** publish `{ type: 'error', code: 'tool_loop_limit', message: 'Permintaan terlalu kompleks, coba sederhanakan.' }`, persist whatever assistantText we have, throw to mark job failed.
- Persist on success:
  1. assistant `AiMessage` row
  2. one `AiMessage` row per tool call (role: 'tool', tool_name, tool_args, tool_result, content: '')
  3. Update `session.last_message_at`; if `title === ''` → set title to first user message[0..40] (trimmed, single line).
  4. `AiUsageLog` row with computed cost.
- Publish `{ type: 'done', message_id }`.
- Use `Prisma.JsonNull` for null JSON fields, `Prisma.InputJsonValue` cast for non-null.

- [ ] **Step 3: Register handler in `server.ts`**

```ts
import { handleTanyaChat } from './handlers/tanya-chat.js';
// ...
startWorker({ 'tanya.chat-completion': handleTanyaChat });
```

- [ ] **Step 4: `tests/tanya-chat.test.ts` (~10 tests)**

For each test: seed user + session in DB, build scripted OpenAI mock with `buildOpenAiMock([turn1, turn2, ...])`, call `handleTanyaChat({ data: payload } as Job<TanyaChatPayload>)`, then assert DB rows + published events.

Capture published events via test-side subscriber:

```ts
const events: any[] = [];
const sub = getTestRedis().duplicate();
await sub.subscribe(`tanya:${jobId}`);
sub.on('message', (_c, p) => events.push(JSON.parse(p)));
```

Tests:

1. **Happy path (no tools):** scripted turn = `[{ content: 'Halo' }, { content: '!' }, { usage: { prompt_tokens: 10, completion_tokens: 5 } }, { finish: 'stop' }]` → assistant row with content 'Halo!' exists; one AiUsageLog; events include `token` × 2 then `done`.
2. **Tool-use happy path:** turn1 emits `tool_calls` for `list_transactions` with valid args; turn2 emits plain content + usage + stop. → assistant row + 1 tool row (with parsed args + tool result) + done event; events include `tool_call` + `tool_result`.
3. **MAX_ITERATIONS exceeded:** 6 scripted turns each emitting a tool_call → after 5 iterations, event `{ type: 'error', code: 'tool_loop_limit' }` published; handler throws.
4. **Invalid tool args:** turn1 emits tool_call with malformed JSON → tool_result row stored with `{ error: 'invalid_args', detail: ... }`; turn2 emits content → assistant row persists; done event published.
5. **History trimming:** seed 25 prior messages on the session; MAX_CONTEXT_MESSAGES=20 → spy on the openai mock's `create` args; assert `messages.length === 21` (1 system + 20 history).
6. **Auto-title set:** session with empty title + first turn → session row's `title` becomes first user message[0..40].
7. **Existing title preserved:** session with non-empty title → not overwritten.
8. **Tool rows excluded from prompt history:** seed session with role='tool' rows interleaved → spy on `create` args; assert no tool rows passed.
9. **OpenAI client throws:** mock raises on `create` → `error` event published with code `internal`; job throws.
10. **Cost log written:** verify `AiUsageLog` row has correct `prompt_tokens`, `completion_tokens`, `total_tokens`, and `cost_usd` matches `computeCost`.

- [ ] **Step 5: `tests/cost.test.ts`**

1. gpt-4o-mini: 1000 prompt + 1000 completion → cost ≈ 0.00075 USD (precision check)
2. unknown model → cost = 0 (no throw)
3. Decimal precision: result has exactly 6 fractional digits.

- [ ] **Step 6: Run check + tests + commit**

```bash
pnpm --filter @rapih/worker-ai typecheck
pnpm --filter @rapih/worker-ai test
```

```bash
git add apps/worker-ai/
git commit -m "$(cat <<'EOF'
feat(worker-ai): tanya.chat-completion handler

Streams OpenAI tokens to redis pubsub channel tanya:<job_id>, runs the
read-only tools in a bounded loop (MAX_ITERATIONS=5), persists assistant
and tool rows, auto-titles new sessions, and logs token usage + cost.
Tool rows are kept in the DB for transcript reconstruction but excluded
from the model context window.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Mobile — `tanya` feature folder (api, sse-client, store)

**Files:**

- Create: `apps/mobile/src/features/tanya/api.ts`
- Create: `apps/mobile/src/features/tanya/sse-client.ts`
- Create: `apps/mobile/src/features/tanya/tanya-store.ts`

- [ ] **Step 1: `api.ts`** — mirrors `features/notification/api.ts` shape

```ts
import { apiRequest, getApiBaseUrl, getAccessToken } from '@/lib/api';
import type {
  AiMessageDto,
  AiSessionDto,
  CreateSessionResponse,
  ListMessagesResponse,
  ListSessionsResponse,
  SendMessageResponse,
} from '@rapih/shared';

export async function listSessions(): Promise<AiSessionDto[]> {
  const data = await apiRequest<ListSessionsResponse['data']>('/tanya/sessions');
  return data.sessions;
}
export async function createSession(title?: string): Promise<AiSessionDto> {
  const data = await apiRequest<CreateSessionResponse['data']>('/tanya/sessions', {
    method: 'POST',
    body: title ? { title } : {},
  });
  return data.session;
}
export async function deleteSession(id: string): Promise<void> {
  await apiRequest(`/tanya/sessions/${id}`, { method: 'DELETE' });
}
export async function listMessages(sessionId: string): Promise<AiMessageDto[]> {
  const data = await apiRequest<ListMessagesResponse['data']>(`/tanya/sessions/${sessionId}/messages`);
  return data.messages;
}
export async function sendMessage(
  sessionId: string,
  text: string,
): Promise<{ user_message: AiMessageDto; job_id: string }> {
  const data = await apiRequest<SendMessageResponse['data']>(
    `/tanya/sessions/${sessionId}/messages`,
    { method: 'POST', body: { text } },
  );
  return data;
}
export function streamUrl(jobId: string): string {
  return `${getApiBaseUrl()}/tanya/jobs/${jobId}/stream`;
}
export function streamHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

(Adapt to whatever helpers `@/lib/api` actually exposes — verify by reading that file first.)

- [ ] **Step 2: `sse-client.ts`**

```ts
import { fetch } from 'expo/fetch';

export type SseEvent = { data: string };

export type SseHandle = { close: () => void };

export async function openSse(
  url: string,
  headers: Record<string, string>,
  onEvent: (e: SseEvent) => void,
  onError: (err: unknown) => void,
): Promise<SseHandle> {
  const controller = new AbortController();
  let closed = false;
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`sse http ${res.status}`);
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    (async () => {
      try {
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of frame.split('\n')) {
              if (line.startsWith('data: ')) onEvent({ data: line.slice(6) });
            }
          }
        }
      } catch (err) {
        if (!closed) onError(err);
      }
    })();
  } catch (err) {
    onError(err);
  }
  return {
    close: () => {
      closed = true;
      controller.abort();
    },
  };
}
```

- [ ] **Step 3: `tanya-store.ts`**

Zustand store covering the flow from spec § 8.3:

```ts
type Status = 'idle' | 'loading' | 'ready' | 'error';
type StreamingState = { text: string; toolCall: { name: string } | null };

type State = {
  status: Status;
  error: string | null;
  sessions: AiSessionDto[];
  activeSessionId: string | null;
  messages: AiMessageDto[];
  streaming: StreamingState | null;
  sse: SseHandle | null;

  loadSessions: () => Promise<void>;
  createNewSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  send: (text: string) => Promise<void>;
  cleanupSse: () => void;
};
```

`send()` follows spec § 8.3 step-by-step. On `done`, parse `message_id`, push a final assistant message built from the accumulated `streaming.text`. On `error`, push an assistant message with content `"Maaf, terjadi kesalahan."` and clear streaming.

- [ ] **Step 4: Verify expo/fetch dep**

```bash
cd apps/mobile && pnpm add expo@~55 && cd ../..
```

`expo/fetch` ships in Expo SDK 55 — no additional dep needed if `expo` is already at SDK 55. Confirm by `import { fetch } from 'expo/fetch'` typechecks.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @rapih/mobile typecheck
git add apps/mobile/src/features/tanya/
git commit -m "$(cat <<'EOF'
feat(mobile): tanya feature — api + sse client + zustand store

REST helpers for sessions/messages, an SSE client built on expo/fetch
streaming (React Native lacks native EventSource), and a zustand store
that owns sessions list, active session, messages, and the streaming
buffer (partial assistant text + current tool indicator).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mobile — tanya screen rewrite + drawer + paywall

**Files:**

- Rewrite: `apps/mobile/src/features/tanya/screens/tanya-screen.tsx`
- Create: `apps/mobile/src/features/tanya/components/session-drawer.tsx`
- Create: `apps/mobile/src/features/tanya/components/tanya-paywall-card.tsx`
- Create: `apps/mobile/src/features/tanya/components/message-bubble.tsx`
- Create: `apps/mobile/src/features/tanya/components/tool-call-chip.tsx`

- [ ] **Step 1: `tanya-paywall-card.tsx`**

Centered card visible when `useAuthStore().user.tier === 'free'`. Title "Tanya hanya untuk Plus". Body 1-line explainer. CTA button "Upgrade" → `router.push('/(app)/pengaturan')` (or whatever the upgrade screen path is — verify).

- [ ] **Step 2: `message-bubble.tsx`**

Props: `{ role: 'user' | 'assistant', content: string, streaming?: boolean }`. Right-aligned for user (background `tint.iris`, text white/ink). Left-aligned for assistant (background `palette.card`, text `palette.ink`). When `streaming`, render a blinking caret at end (animated opacity).

- [ ] **Step 3: `tool-call-chip.tsx`**

Compact pill: "✦ menggunakan {tool_name}…". Small, left-aligned, palette `palette.limeSoft` bg + `palette.moss` text. Used as a transient row while streaming.

- [ ] **Step 4: `session-drawer.tsx`**

Side-panel (slide from left, or modal overlay) showing `sessions[]` from the store. Each row: title (or "Sesi baru" if empty) + timestamp from `last_message_at`. Tap → `selectSession(id)`. Long-press → confirm dialog → `removeSession(id)`. Header has a "+ Baru" button calling `createNewSession()`.

- [ ] **Step 5: `tanya-screen.tsx` — full rewrite**

Layout from spec § 8.2:

```tsx
export function TanyaScreen() {
  const user = useAuthStore((s) => s.user);
  const { sessions, activeSessionId, messages, streaming, status,
          loadSessions, loadMessages, send, cleanupSse } = useTanyaStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (user?.tier === 'free') {
    return <TanyaPaywallCard />;
  }

  useEffect(() => {
    loadSessions();
    return () => cleanupSse();
  }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages();
  }, [activeSessionId]);

  return (
    <Screen>
      <Header ... />
      <SessionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ScrollView ... >
        {messages.map((m) => (
          m.role === 'tool'
            ? null /* tool rows hidden from chat view in v1 */
            : <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming?.toolCall && <ToolCallChip name={streaming.toolCall.name} />}
        {streaming && <MessageBubble role="assistant" content={streaming.text} streaming />}
      </ScrollView>
      <Composer disabled={!!streaming} onSend={send} />
    </Screen>
  );
}
```

Auto-scroll on new content via `ScrollView` ref + `scrollToEnd({ animated: true })` whenever `streaming.text` or `messages` length changes.

If no `activeSessionId` on mount and `sessions[]` is empty, automatically call `createNewSession()` to give the user a thread to start in.

- [ ] **Step 6: Manual smoke test**

```bash
pnpm --filter @rapih/mobile typecheck
```

Then run `expo start --dev-client` and walk through:

- Login as a Free user → paywall renders.
- Switch to a Plus account (or update DB row) → chat renders.
- Send message → tokens stream in; tool chip appears+disappears if model uses a tool; assistant bubble settles with final content.
- Switch sessions via drawer; messages reload.
- Create a new session, then delete it.

Document the smoke checklist in the commit body.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/tanya/
git commit -m "$(cat <<'EOF'
feat(mobile): rewire tanya chat to live API

Full rewrite of tanya-screen with session drawer, message bubbles, streaming
caret, tool-call chip, and tier paywall for Free users. Streaming uses the
expo/fetch SSE client from the previous commit.

Smoke tested: paywall (Free), happy path (Plus), tool-call chip transitions,
session switching, session delete.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Spine Feature Atlas update + final integration check

**Files:**

- Modify: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — mark Atlas rows done

- [ ] **Step 1: Update Feature Atlas**

Find rows for `tanya chat (AI)` and `tanya quota tracking` in the Spine spec's Feature Atlas. Set both status cells to `done`.

- [ ] **Step 2: Full repo check**

```bash
pnpm check
pnpm --filter @rapih/api test
pnpm --filter @rapih/worker-ai test
```

All green expected. Mobile is typecheck-only (no test suite).

- [ ] **Step 3: Verify branch state**

```bash
git status   # clean
git log --oneline main..HEAD   # all task commits present, ordered
```

- [ ] **Step 4: Commit atlas update**

```bash
git add docs/superpowers/specs/2026-05-20-rapih-backend-spine.md
git commit -m "$(cat <<'EOF'
docs(spine): mark tanya features as done

tanya chat (AI) + tanya quota tracking → done after Chunk A landed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Hand off to user for review**

Do NOT push or open a PR — per locked user constraint: "jangan merge sebelum dapat persetujuan saya." Surface the branch and let the user decide push timing.

```bash
git log --oneline main..HEAD
```

Report back: number of commits, summary of test pass, any deferred items.

---

## Appendix A — Done criteria

- [ ] All 11 tasks committed on `feat/worker-ai-tanya`.
- [ ] `pnpm check` passes (root).
- [ ] `pnpm --filter @rapih/api test` passes — includes new tanya REST + SSE tests.
- [ ] `pnpm --filter @rapih/worker-ai test` passes — includes all tools + tanya-chat + cost tests.
- [ ] `pnpm --filter @rapih/mobile typecheck` passes.
- [ ] Spine Feature Atlas updated.
- [ ] Branch state clean; ready for user review.

## Appendix B — Deferred from this chunk

- **Chunk B (scan-struk OCR):** `ai.ocr-receipt` handler, camera + gallery picker, `expo-share-intent` (requires EAS Dev Build), "review pending" notifications. Separate spec + plan.
- **Chunk C (weekly-review-gen consumer):** `ai.weekly-review-gen` handler in worker-ai consuming the jobs already enqueued by worker-reminder. Separate spec + plan.
- Quota enforcement (per-tier daily cap). Logging-only in this chunk.
- "Stop generating" button (needs BullMQ job cancel + pubsub coordination).
- Streaming markdown rendering / message regenerate / title rename UI.
- Embeddings / RAG.
