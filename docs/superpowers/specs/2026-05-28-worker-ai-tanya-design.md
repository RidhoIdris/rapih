## worker-ai (Chunk A — Tanya chat) — Design Spec

**Status:** draft · **Date:** 2026-05-28 · **Owner:** @ridhoidris
**Sub-project:** ai-worker (per Spine § 15.6) · **Chunk:** A of 3
**References:** [Spine](./2026-05-20-rapih-backend-spine.md) § 2 (stack), § 10 (async jobs), § 12 (AI/Tanya), § 13 (tiers); [worker-reminder spec](./2026-05-28-worker-reminder-design.md) (boot pattern, expo-push pattern)

This spec covers **Chunk A** of the `ai-worker` sub-project: scaffold the worker app, ship the "Tanya" multi-session chat feature end-to-end (schema → API → worker → mobile), and instrument cost logging. Chunks B (scan-struk OCR) and C (weekly-review-gen consumer) are deferred.

## 1. Goals

1. New app `apps/worker-ai` consuming a BullMQ queue `ai`, mirroring the `worker-reminder` boot pattern.
2. End-to-end **Tanya** chat: Plus/Pro users can open a multi-session chat with an LLM that has read-only access to their finance data via tool calls.
3. Streaming responses delivered to mobile via Server-Sent Events bridged through Redis pubsub.
4. Cost & token usage logged per call (no enforcement in v1).
5. Mobile `tanya-screen.tsx` rewired from dummy UI to real chat with session drawer, message bubbles, and tool-call indicators.

Out of scope for Chunk A: scan-struk OCR, weekly-review-gen consumer, per-user quota enforcement, image input, model selection UI, RAG/embeddings.

## 2. Locked Decisions

| Concern | Choice | Reasoning |
|---|---|---|
| LLM provider | **OpenAI** (`openai` SDK v4.x) | User already has key; widely understood; future swap is low-cost. |
| Default model | **`gpt-4o-mini`** (env-configurable) | Cheap, fast, tool-use capable, good Indonesian. |
| Session model | **Multi-session** (sidebar drawer) | Per user request — separate "Tanya" threads. |
| Streaming transport | **SSE via Redis pubsub** (`tanya:${job_id}`) | Worker publishes tokens → API subscribes & forwards to client. Worker stays decoupled from HTTP. |
| Context strategy | **System prompt + last N messages (default 20)** | Simple; trim before send. Token-budget safety via `MAX_CONTEXT_MESSAGES`. |
| Tool use | **Enabled, 5 read-only tools** | Real value over plain chat. Read-only avoids accidental mutations. |
| Tool loop bound | **`MAX_ITERATIONS = 5`** | Cap runaway tool chains; surface error if exceeded. |
| Auto-title | **First user message — first 40 chars** (no LLM call) | Zero extra cost; good enough. |
| Tier gate | **Plus + Pro** via new `app.requirePlus` decorator | Free users see paywall card. |
| Quota | **Log only — no enforcement** | Visibility now, enforcement after we see real usage. |
| Idempotency | Not applicable (one job per user send) | Each "send" is a unique job; client-side button disable prevents double-send. |
| Testing | **Real Redis (DB 15) + real Postgres + mocked OpenAI client** | Same pattern as worker-reminder. |

## 3. Architecture & Job Flow

```text
mobile (POST /tanya/sessions/:id/messages)
   │  body: { text }
   ▼
apps/api/routes/tanya.ts
   ├─ inserts user AiMessage row
   ├─ aiQueue.add('tanya.chat-completion', { user_id, session_id, message_id })
   └─ returns { job_id }                  ← mobile uses this for SSE URL

mobile GET /tanya/jobs/:job_id/stream (EventSource)
   ▼
apps/api/routes/tanya.ts (sse handler)
   ├─ subscribes to redis channel `tanya:${job_id}`
   ├─ forwards each pubsub message as SSE `data: {...}\n\n`
   └─ closes on `{ type: 'done' }` or `{ type: 'error' }`

apps/worker-ai (Worker on 'ai' queue, name 'tanya.chat-completion')
   ├─ loads session history (last N messages, oldest→newest)
   ├─ calls OpenAI chat.completions.create({ stream: true, tools })
   ├─ for each token chunk → redis.publish(`tanya:${job_id}`, { type: 'token', text })
   ├─ on tool_call → run tool handler (read-only Prisma query) → loop back
   ├─ on completion → insert assistant AiMessage row, AiUsageLog row,
   │                  update session.last_message_at + auto-title if first reply
   └─ publish `{ type: 'done', message_id }` then close
```

**Why pubsub, not direct WebSocket from worker**: workers stay HTTP-free; API owns all client connections. Redis pubsub is the seam.

**Single queue `ai`** for the entire ai-worker (Chunks A/B/C). Job names: `tanya.chat-completion` (this chunk), `ai.ocr-receipt` (Chunk B), `ai.weekly-review-gen` (Chunk C).

**Workers do not import from `apps/api`** (Spine § 3). Shared logic lives in `packages/shared` / `packages/db`.

## 4. Schema Additions

Add to `packages/db/prisma/schema.prisma`:

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

Add to `User`:

```prisma
ai_sessions   AiSession[]
ai_usage_logs AiUsageLog[]
```

Migration name: `add_ai_chat`.

Notes:
- `AiMessage.role = tool` rows store the **tool result** (with `tool_name` + `tool_args` + `tool_result`), making the full transcript replayable.
- `AiSession.deleted_at` enables soft-delete (consistent with the rest of the codebase).
- `AiUsageLog.session_id` nullable so future non-chat kinds (ocr, weekly_review) can log without a session.

## 5. Tool Definitions (read-only)

All tools execute against the **authenticated user's data only** — `user_id` is bound by the worker, never accepted from the model.

| Tool | Args (zod) | Returns |
|---|---|---|
| `list_transactions` | `{ since?: ISODate, until?: ISODate, limit?: 1..50, kind?: 'income'\|'expense' }` | `{ transactions: TxSummary[] }` (id, transacted_at, kind, amount string, category_name, note, wallet_name) |
| `summarize_month` | `{ month: 'YYYY-MM' }` | `{ income, expense, net, by_category: { name, total }[] }` (all amounts string) |
| `get_budgets` | `{ month?: 'YYYY-MM' }` (default current) | `{ budgets: { category_name, limit, spent, remaining }[] }` |
| `get_goals` | `{}` | `{ goals: { id, name, target, saved, deadline, progress_pct }[] }` (only `deleted_at: null`) |
| `get_wallets` | `{}` | `{ wallets: { id, name, kind, balance }[] }` |

**Locked behaviors:**
- All money fields serialized as **numeric strings** (BigInt over-the-wire rule).
- Pagination caps at 50 rows for `list_transactions` to keep prompt size sane.
- Tools never write. Adding write-tools (e.g. `create_transaction`) requires a future spec.
- `tool_args` from the model are validated by the same zod schema; invalid args → return `{ error: 'invalid_args', detail }` as the tool result and let the model retry within `MAX_ITERATIONS`.

Tool definitions live in `apps/worker-ai/src/tools/` (one file each + `index.ts` registry). Each file exports:

```ts
export const listTransactionsTool: ToolDef = {
  name: 'list_transactions',
  description: '...for the OpenAI tools schema...',
  parameters: <openai jsonschema>,
  argsSchema: z.object({...}),
  async run(args, ctx: { userId: string; prisma: PrismaClient }): Promise<unknown> { ... },
};
```

## 6. Shared Types & API Surface

### 6.1 Shared types

New folder: `packages/shared/src/tanya/`.

```ts
// enums.ts
export const AiRoleSchema = z.enum(['user', 'assistant', 'tool']);

// schemas.ts
export const AiSessionDto = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  last_message_at: z.string(),
});

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

export const ListSessionsResponse = z.object({
  ok: z.literal(true),
  data: z.object({ sessions: z.array(AiSessionDto) }),
});

export const CreateSessionBody = z.object({ title: z.string().max(120).optional() });

export const CreateSessionResponse = z.object({
  ok: z.literal(true),
  data: z.object({ session: AiSessionDto }),
});

export const ListMessagesResponse = z.object({
  ok: z.literal(true),
  data: z.object({ messages: z.array(AiMessageDto) }),
});

export const SendMessageBody = z.object({ text: z.string().min(1).max(4000) });

export const SendMessageResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    user_message: AiMessageDto,
    job_id: z.string(),
  }),
});
```

Add to `packages/shared/src/index.ts`: `export * from './tanya/index.js'`.

Add error codes to `packages/shared/src/errors.ts`:
- `tier.upgrade_required` (403)
- `tanya.session_not_found` (404)
- `tanya.job_not_found` (404)

### 6.2 `requirePlus` decorator

New decorator in `apps/api/src/auth/decorators.ts`:

```ts
const requirePlus = async (req: FastifyRequest, _reply: FastifyReply) => {
  if (!req.user) throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
  if (req.user.tier === 'free') {
    throw new AppError(
      'tier.upgrade_required',
      'Fitur ini butuh Rapih Plus.',
      403,
    );
  }
};
app.decorate('requirePlus', requirePlus);
```

Update the `FastifyInstance` declaration block to include `requirePlus`.

### 6.3 API endpoints

New file: `apps/api/src/routes/tanya.ts`. All routes wrapped with `onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus]` unless noted.

```
GET    /tanya/sessions                  → { sessions: AiSessionDto[] }   (deleted_at IS NULL, desc by last_message_at)
POST   /tanya/sessions                  body: { title? }  → { session }
DELETE /tanya/sessions/:id              soft-delete  → { ok: true }
GET    /tanya/sessions/:id/messages     → { messages: AiMessageDto[] }   (oldest→newest, all rows)
POST   /tanya/sessions/:id/messages     body: { text }   → { user_message, job_id }
GET    /tanya/jobs/:job_id/stream       SSE (no body) — see § 6.4
```

**Cross-user enforcement (Spine rule):** all `:id` lookups MUST filter `user_id: req.user.id`. Not found OR not owned → `404 tanya.session_not_found` (don't leak existence).

`POST /tanya/sessions/:id/messages`:
1. Verify session exists + owned + not deleted (404 otherwise).
2. `$transaction`: insert `AiMessage { role: 'user', content: text }`; bump `session.last_message_at`.
3. Generate `job_id = cuid()`.
4. `aiQueue.add('tanya.chat-completion', { user_id, session_id, user_message_id, job_id }, { jobId: job_id })`.
5. Return `{ user_message, job_id }`.

### 6.4 SSE handler (`GET /tanya/jobs/:job_id/stream`)

```ts
app.get('/tanya/jobs/:job_id/stream', { onRequest: [app.authenticate, app.requirePlus] }, async (req, reply) => {
  const { job_id } = req.params;
  // Verify the job belongs to this user — read the BullMQ job by id and check data.user_id
  const job = await aiQueue.getJob(job_id);
  if (!job || job.data.user_id !== req.user.id) {
    throw new AppError('tanya.job_not_found', 'Sesi streaming tidak ditemukan.', 404);
  }
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const sub = redis.duplicate();
  await sub.subscribe(`tanya:${job_id}`);
  const onMessage = (_channel: string, payload: string) => {
    reply.raw.write(`data: ${payload}\n\n`);
    const event = safeJsonParse(payload);
    if (event?.type === 'done' || event?.type === 'error') cleanup();
  };
  sub.on('message', onMessage);
  const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
  const cleanup = () => {
    clearInterval(heartbeat);
    sub.removeListener('message', onMessage);
    sub.unsubscribe().catch(() => {});
    sub.quit().catch(() => {});
    reply.raw.end();
  };
  req.raw.on('close', cleanup);
});
```

**Event types published by worker:**
- `{ type: 'token', text }` — partial assistant text
- `{ type: 'tool_call', name, args }` — tool invocation begun (UI shows "menggunakan list_transactions…")
- `{ type: 'tool_result', name }` — tool finished (no payload to client — privacy)
- `{ type: 'done', message_id }` — final, assistant row persisted
- `{ type: 'error', code, message }` — fatal

API also needs `REDIS_URL` and a `producers/ai-queue.ts` exporting `aiQueue`.

## 7. Worker Structure (`apps/worker-ai`)

```
apps/worker-ai/
  src/
    config/
      env.ts                    REDIS_URL, DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL (default 'gpt-4o-mini'),
                                MAX_CONTEXT_MESSAGES (default 20), MAX_ITERATIONS (default 5),
                                LOG_LEVEL
    lib/
      logger.ts                 pino
      redis.ts                  ioredis singleton (for pubsub + BullMQ connection)
      prisma.ts                 PrismaClient singleton
      openai.ts                 wrapper around openai SDK — injectable client for tests
      cost.ts                   pricing table per model → { promptUSDper1k, completionUSDper1k }
                                computeCost(model, prompt, completion) → Decimal
    tools/
      list-transactions.ts
      summarize-month.ts
      get-budgets.ts
      get-goals.ts
      get-wallets.ts
      index.ts                  registry: name → ToolDef
    handlers/
      tanya-chat.ts             handler — the main loop (see § 7.1)
    queues/
      ai.ts                     new Queue('ai', { connection })  (worker-side)
    worker.ts                   new Worker('ai', dispatcher, { connection })
                                dispatcher switches on job.name → handler from handlers/
    server.ts                   entrypoint: prisma connect, start worker, /health http
  tests/
    helpers/
      test-redis.ts             redis://localhost:6379/15, FLUSHDB beforeEach
      test-db.ts                truncate incl. ai_sessions, ai_messages, ai_usage_logs
      test-env.ts
      openai-mock.ts            factory returning a fake client with scripted responses
    tanya-chat.test.ts          ~10 tests (see § 9)
    tools/*.test.ts             one file per tool, ~3-5 tests each
    cost.test.ts                ~3 tests
  package.json
  tsconfig.json
  Dockerfile                    multi-stage, entry: node dist/server.js
  .env.example
```

### 7.1 `tanya-chat.ts` handler — pseudocode

```ts
export async function handleTanyaChat(job: Job<TanyaChatPayload>) {
  const { user_id, session_id, user_message_id, job_id } = job.data;
  const channel = `tanya:${job_id}`;
  try {
    const history = await loadHistory(session_id, env.MAX_CONTEXT_MESSAGES);
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
    let assistantText = '';
    const toolCallsForRow: { name: string; args: unknown; result: unknown }[] = [];
    let promptTokens = 0;
    let completionTokens = 0;

    for (let i = 0; i < env.MAX_ITERATIONS; i++) {
      const stream = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        tools: TOOL_SCHEMAS,
        stream: true,
        stream_options: { include_usage: true },
      });

      let toolCall: { id: string; name: string; argsRaw: string } | null = null;
      let textThisRound = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          textThisRound += delta.content;
          await redis.publish(channel, JSON.stringify({ type: 'token', text: delta.content }));
        }
        if (delta?.tool_calls?.[0]) {
          const tc = delta.tool_calls[0];
          if (!toolCall) toolCall = { id: tc.id!, name: tc.function!.name!, argsRaw: '' };
          if (tc.function?.arguments) toolCall.argsRaw += tc.function.arguments;
        }
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens;
          completionTokens = chunk.usage.completion_tokens;
        }
      }

      assistantText += textThisRound;

      if (!toolCall) break;  // model finished

      // Run tool
      await redis.publish(channel, JSON.stringify({ type: 'tool_call', name: toolCall.name, args: safeParse(toolCall.argsRaw) }));
      const tool = TOOLS[toolCall.name];
      const parsedArgs = tool.argsSchema.safeParse(safeParse(toolCall.argsRaw));
      const result = parsedArgs.success
        ? await tool.run(parsedArgs.data, { userId: user_id, prisma })
        : { error: 'invalid_args', detail: parsedArgs.error.format() };

      toolCallsForRow.push({ name: toolCall.name, args: parsedArgs.success ? parsedArgs.data : safeParse(toolCall.argsRaw), result });
      await redis.publish(channel, JSON.stringify({ type: 'tool_result', name: toolCall.name }));

      // Append the assistant tool_call message and the tool result to history for next iteration
      messages.push({ role: 'assistant', content: textThisRound, tool_calls: [{ id: toolCall.id, type: 'function', function: { name: toolCall.name, arguments: toolCall.argsRaw } }] });
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      // continue loop
    }

    // Persist
    const assistantRow = await prisma.aiMessage.create({
      data: { session_id, role: 'assistant', content: assistantText },
    });
    for (const tc of toolCallsForRow) {
      await prisma.aiMessage.create({
        data: {
          session_id, role: 'tool',
          content: '',
          tool_name: tc.name,
          tool_args: tc.args as Prisma.InputJsonValue,
          tool_result: tc.result as Prisma.InputJsonValue,
        },
      });
    }
    await prisma.aiSession.update({
      where: { id: session_id },
      data: {
        last_message_at: new Date(),
        // auto-title if title is still empty
        ...(await needsAutoTitle(session_id) ? { title: await deriveTitle(session_id) } : {}),
      },
    });
    await prisma.aiUsageLog.create({
      data: {
        user_id, session_id, kind: 'chat', model: env.OPENAI_MODEL,
        prompt_tokens: promptTokens, completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        cost_usd: computeCost(env.OPENAI_MODEL, promptTokens, completionTokens),
      },
    });
    await redis.publish(channel, JSON.stringify({ type: 'done', message_id: assistantRow.id }));
  } catch (err) {
    logger.error({ err, job_id }, 'tanya-chat failed');
    await redis.publish(channel, JSON.stringify({ type: 'error', code: 'internal', message: 'Maaf, terjadi kesalahan.' }));
    throw err;  // let BullMQ mark failed
  }
}
```

Notes:
- `SYSTEM_PROMPT` lives in `apps/worker-ai/src/handlers/system-prompt.ts` (Bahasa Indonesia, tells the model it is "Tanya", reminds it of read-only tools, and to format Rupiah responses with Rp prefix).
- `deriveTitle(session_id)` = first user message content, first 40 chars, trim, single line.
- `needsAutoTitle()` checks `title === ''`.
- `loadHistory()` returns messages in role/content shape (omits `tool` role rows older than the current turn to avoid stale tool clutter — only include last assistant/user pairs in the prompt; tool rows are persisted for transcript reconstruction but not replayed into the model). **Locked rule:** loadHistory selects messages WHERE role IN ('user','assistant') ORDER BY created_at DESC LIMIT N, then reversed.

## 8. Mobile rewire

### 8.1 Feature folder

New: `apps/mobile/src/features/tanya/`.

```
api.ts                 listSessions, createSession, deleteSession, listMessages, sendMessage, streamUrl(jobId)
tanya-store.ts         Zustand: sessions[], activeSessionId, messages[], status, streaming{text,toolCall|null},
                       loadSessions(), createSession(), selectSession(id), loadMessages(),
                       send(text) → POSTs, opens EventSource via streamUrl, dispatches into store
sse-client.ts          EventSource-like wrapper using expo-fetch streaming (RN has no native EventSource)
```

Why `expo-fetch` streaming: React Native's built-in `fetch` does not surface chunks. We use Expo SDK 55's `expo/fetch` which exposes the `ReadableStream` body; manually parse `data: …\n\n` frames. (Same approach OpenAI SDK uses in RN.)

### 8.2 Screen rewrite

`apps/mobile/src/features/tanya/screens/tanya-screen.tsx` — full rewrite (keep visual language: pastel palette, rounded cards, header "Rapih · online" or similar).

Layout:
- Header row: hamburger (opens drawer) · title · "+" new session button.
- Drawer (overlay or swipe-from-left): list of sessions, tap to switch, long-press → delete confirm.
- Messages area: scroll-to-bottom on new content. Bubble variants:
  - `role: 'user'` — right-aligned, palette `tint.iris` background.
  - `role: 'assistant'` — left-aligned, `palette.card` background. Streaming bubble shows blinking caret.
  - `tool_call` indicator (transient) — small "✦ menggunakan {tool_name}…" chip while streaming; disappears on `tool_result`.
- Composer: text input + send button. Disabled while streaming.

Tier paywall:
- On mount, check `user.tier` from auth store. If `'free'` → render `<TanyaPaywallCard />` instead of the chat — title "Tanya hanya untuk Plus", body explainer, CTA "Upgrade" (links to pengaturan-screen).

### 8.3 Store flow for `send(text)`

```
1. optimistic append { role: 'user', content: text, id: tempId }
2. POST /tanya/sessions/:id/messages → { user_message, job_id }
3. replace tempId with user_message.id; clear streaming buffer
4. open SSE to /tanya/jobs/:job_id/stream
5. on { type: 'token' } → append to streaming.text + force scroll
6. on { type: 'tool_call' } → set streaming.toolCall = { name }
7. on { type: 'tool_result' } → streaming.toolCall = null
8. on { type: 'done', message_id } → push final assistant msg with id, clear streaming
9. on { type: 'error' } → toast + push assistant msg with error copy, clear streaming
```

## 9. Testing strategy

### 9.1 worker-ai tests

- `tanya-chat.test.ts`:
  - happy path: scripted OpenAI returns plain text → assistant row persisted + AiUsageLog written + `done` published
  - tool-use: scripted OpenAI emits `list_transactions` call → tool runs against real Prisma data → second iteration produces final text
  - MAX_ITERATIONS exceeded → assistant text saved with whatever accumulated, `error` published? **Locked:** persist what we have, publish `error` with code `tool_loop_limit`.
  - invalid tool args from model → `error: 'invalid_args'` returned to model; second iteration succeeds
  - history trimming: 25 prior messages + MAX_CONTEXT_MESSAGES=20 → only last 20 sent
  - auto-title: empty session → title set to first user message[0..40]
  - existing title: not overwritten
  - tool-only rows excluded from prompt history (verify by inspecting messages array passed to OpenAI mock)
  - error from OpenAI client → `error` published, job marked failed
  - cost log: tokens recorded correctly per scripted usage

- `tools/list-transactions.test.ts`:
  - filters by user (cross-user data excluded)
  - excludes deleted_at IS NOT NULL
  - kind filter
  - limit cap (request 999 → returns ≤50)

- `tools/summarize-month.test.ts`:
  - groups by category correctly
  - amounts returned as strings

- `tools/get-budgets.test.ts`, `tools/get-goals.test.ts`, `tools/get-wallets.test.ts`:
  - user scoping
  - soft-delete filtering (goals, wallets)
  - budget month default = current

- `cost.test.ts`:
  - gpt-4o-mini pricing math
  - unknown model → cost 0 + log warning
  - decimal precision (6 places)

### 9.2 API tests

`apps/api/tests/tanya.test.ts`:
- auth guard (401 without token)
- onboarding guard (403 without onboarding)
- tier guard (403 for Free; 200 for Plus/Pro)
- create session → row appears in list
- delete session → soft-deleted (not in list, but messages still accessible if directly fetched? **Locked:** GET /sessions/:id/messages returns 404 once session is soft-deleted)
- list messages: oldest→newest order, includes tool rows
- send message: persists user msg, enqueues job, returns job_id
- cross-user session access → 404 (not 403)
- SSE: verify subscribes to redis channel, forwards published events, closes on `done`; cross-user job_id → 404

### 9.3 Mobile

No automated tests yet — manual smoke via expo dev: create session, send message, see streaming tokens, see tool-call chip, switch sessions, delete session, free-user paywall renders.

## 10. Environment

`apps/worker-ai/.env.example`:

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

`apps/api/.env.example`: add `REDIS_URL=redis://localhost:6379` (new requirement — API now produces to `ai` queue and subscribes for SSE).

Root `.env.example`: add `OPENAI_API_KEY`.

## 11. Deployment

`apps/worker-ai/Dockerfile` — multi-stage like worker-reminder:
1. base: node:22-alpine, pnpm
2. deps: install workspace deps
3. build: tsc
4. runner: copy dist + node_modules, `CMD ["node", "dist/server.js"]`

Dokploy: 1 new service `worker-ai`. Same Postgres + Redis as api & worker-reminder. Health probe via `/health`.

Scaling note: SSE bridge in API is per-process; if API runs N replicas, the user's EventSource may land on a different replica than the one that produced the job — fine, since all replicas subscribe to the same Redis channel by `job_id`. Worker can also scale to N replicas (BullMQ handles distribution).

## 12. Rollout order

1. `packages/db` migration (`add_ai_chat`).
2. `packages/shared` — tanya types + error codes.
3. `apps/api` — `REDIS_URL` config, `requirePlus` decorator, `aiQueue` producer, `tanya.ts` routes + SSE handler + tests.
4. `apps/worker-ai` — scaffold + lib + tools + chat handler + tests.
5. `apps/mobile` — feature folder (api + store + sse-client) + chat screen rewrite + drawer + paywall.
6. Update Spine Feature Atlas: `tanya chat (AI)` + `tanya quota tracking` → done.

Branch: `feat/worker-ai-tanya` (created from `main` immediately before first commit). Single PR, no merge until user approval.

## 13. Open questions (deferred)

- Quota enforcement (per-day token cap for Plus vs Pro) — out of scope, logging only.
- Streaming markdown rendering on mobile — v1 ships plain text bubbles; rich rendering later.
- Long-press message → copy / "regenerate" — deferred.
- "Stop generating" button — needs job cancel via BullMQ + pubsub notify. Deferred.
- Embeddings / RAG over user notes — deferred.
- Multi-modal (image input to chat) — Chunk B adds OCR via separate `ai.ocr-receipt` job, not Tanya.
- Title rename UI — out of scope; auto-title only.

---

## Appendix A — File checklist

**packages/db:**
- [ ] `prisma/schema.prisma` — add `AiRole`, `AiUsageKind` enums + `AiSession`, `AiMessage`, `AiUsageLog` models + `User` back-refs
- [ ] migration `add_ai_chat`

**packages/shared:**
- [ ] `src/tanya/enums.ts`
- [ ] `src/tanya/schemas.ts`
- [ ] `src/tanya/index.ts`
- [ ] `src/index.ts` — add tanya export
- [ ] `src/errors.ts` — add `tier.upgrade_required`, `tanya.session_not_found`, `tanya.job_not_found`

**apps/api:**
- [ ] `src/config/env.ts` — add `REDIS_URL`
- [ ] `src/auth/decorators.ts` — `requirePlus`
- [ ] `src/lib/redis.ts` (new) — ioredis singleton
- [ ] `src/producers/ai-queue.ts` (new) — `aiQueue`
- [ ] `src/routes/tanya.ts`
- [ ] `src/routes/index.ts` — register
- [ ] `src/plugins/swagger.ts` — add `tanya` tag
- [ ] `tests/helpers/test-db.ts` — add `ai_sessions`, `ai_messages`, `ai_usage_logs` to TRUNCATE
- [ ] `tests/helpers/test-redis.ts` (new if absent)
- [ ] `tests/tanya.test.ts`

**apps/worker-ai/** (entire new app — see § 7)

**apps/mobile:**
- [ ] `src/features/tanya/api.ts`
- [ ] `src/features/tanya/sse-client.ts`
- [ ] `src/features/tanya/tanya-store.ts`
- [ ] `src/features/tanya/screens/tanya-screen.tsx` — rewrite
- [ ] `src/features/tanya/components/session-drawer.tsx`
- [ ] `src/features/tanya/components/tanya-paywall-card.tsx`

**docs:**
- [ ] Update Spine Feature Atlas: `tanya chat (AI)`, `tanya quota tracking` rows → `done`
