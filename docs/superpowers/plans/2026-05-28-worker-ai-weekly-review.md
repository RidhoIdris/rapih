# worker-ai (Chunk C — Weekly Review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chunk C of `ai-worker`: consumer for the `ai.weekly-review-gen` job (already enqueued by worker-reminder every Sunday 22:00 WIB). Worker pulls the user's last-7-days finance data, asks gpt-4o-mini to summarize, persists a `WeeklyReview` row, and enqueues a push job to the `reminder` queue. Mobile gets a dedicated reviews list + detail screen and a deep-link from the notification.

**Architecture:** Reuses Chunk A's `ai` queue + Chunk B's "worker-ai → reminder queue → worker-reminder pushes" pattern. New `WeeklyReview` table (1 row per `(user_id, week)`, unique). Output is hybrid JSON: `{ narrative_md: string (1 paragraph), highlights: [{ label, value, delta? }], suggestion: string }`. Notification kind `weekly_review` already exists from Chunk A schema; we add a new push job name `weekly-review.ready-push` in worker-reminder. Tier eligibility broadened from Pro-only to Plus+Pro — worker-reminder's existing `weekly-review` cron handler updated accordingly.

**Tech Stack:** Same as Chunks A+B. No new deps.

**Locked decisions** (no separate spec doc):

| Concern | Choice |
|---|---|
| Output format | Hybrid JSON `{ narrative_md, highlights[], suggestion }` via OpenAI JSON mode |
| Storage | New `weekly_reviews` table; unique `(user_id, week)` |
| Mobile UI | Dedicated `/reviews` list + `/reviews/[week]` detail; notif tap → detail |
| Tier | **Plus + Pro** — broaden from existing Pro-only |
| Model | `gpt-4o-mini` (env `OPENAI_WEEKLY_MODEL`, default = mini) |
| Push pipeline | Worker-ai enqueues `weekly-review.ready-push` on `reminder` queue; worker-reminder sends Expo push |
| Idempotency | Cron-enqueue idempotency key `weekly-review-enqueue:{week}:{user_id}` already in place; worker-ai also short-circuits if a `WeeklyReview` row for `(user, week)` already exists |
| Empty-week handling | If user had 0 transactions in the week → skip generation, no push (don't waste tokens / spam) |
| Highlights cap | 4 highlights max (keeps card UI predictable) |
| Narrative length | Prompt caps at ~120 words to keep cost + read time low |
| Cost log | Reuse `AiUsageLog` with `kind: 'weekly_review'` (enum already added in Chunk A) |
| Retry | BullMQ default attempts: 1 (no retry — failure leaves no row, next week's cron is independent). Manual re-trigger out of scope. |

**Branch:** `feat/worker-ai-weekly-review` (from `main`, after Chunks A+B merged).

```bash
git checkout main
git pull --ff-only
git checkout -b feat/worker-ai-weekly-review
```

Do not merge without explicit user approval.

**Workflow note:** Batch writes per task, run `pnpm check` + relevant tests once at end, atomic commit. Match Biome (single quotes, semicolons, es5 trailing commas, alphabetical imports).

**Security locks:** never trust client `user_id`; cross-user → 404; scope by `user_id` AND `deleted_at: null`; gate routes with `[app.authenticate, app.requireOnboarding, app.requirePlus]`; BigInt as string over wire.

---

## Task 1: Schema migration — `weekly_reviews`

**Files:**

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_weekly_reviews/migration.sql`

- [ ] **Step 1: Add `WeeklyReview` model**

```prisma
model WeeklyReview {
  id         String    @id @default(cuid())
  user_id    String
  week       String    // ISO week, e.g. "2026-W22"
  content    Json      // { narrative_md, highlights[], suggestion } — see § shared schema
  created_at DateTime  @default(now())
  deleted_at DateTime?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, week])
  @@index([user_id, deleted_at, created_at])
  @@map("weekly_reviews")
}
```

- [ ] **Step 2: Add back-ref on `User`**

```prisma
weekly_reviews WeeklyReview[]
```

(Alphabetical position in the relation block.)

- [ ] **Step 3: Generate + apply migration**

```bash
pnpm --filter @rapih/db exec prisma migrate dev --name add_weekly_reviews --create-only
```

Inspect SQL: table, unique index on `(user_id, week)`, secondary index, FK CASCADE.

```bash
pnpm --filter @rapih/db exec prisma migrate deploy
DATABASE_URL="postgresql://rapih:rapih@localhost:5433/rapih_test" pnpm --filter @rapih/db exec prisma migrate deploy
pnpm --filter @rapih/db build
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add weekly_reviews

One row per (user, ISO week). Stores hybrid JSON content (narrative + highlights
+ suggestion) produced by ai-worker's weekly-review-gen handler.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared types + error codes

**Files:**

- Create: `packages/shared/src/weekly-review/content.ts`
- Create: `packages/shared/src/weekly-review/schemas.ts`
- Create: `packages/shared/src/weekly-review/index.ts`
- Create: `packages/shared/src/weekly-review/iso-week.ts` — `currentIsoWeek(date)`, `isoWeekRange(week)` helpers
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/errors.ts`

- [ ] **Step 1: `weekly-review/content.ts`** — the LLM output contract

```ts
import { z } from 'zod';

export const WeeklyReviewHighlight = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(60),    // e.g. "Rp 1.250.000" or "-32%"
  delta: z.string().nullable(),         // optional secondary metric, e.g. "vs minggu lalu"
});
export type WeeklyReviewHighlight = z.infer<typeof WeeklyReviewHighlight>;

export const WeeklyReviewContent = z.object({
  narrative_md: z.string().min(1).max(1200),    // markdown allowed (bold, lists)
  highlights: z.array(WeeklyReviewHighlight).max(4),
  suggestion: z.string().min(1).max(280),
});
export type WeeklyReviewContent = z.infer<typeof WeeklyReviewContent>;
```

- [ ] **Step 2: `weekly-review/iso-week.ts`**

```ts
/**
 * ISO 8601 week — Monday-start week with year-week format "YYYY-Www".
 * Used to key weekly review rows and to compute the range for a given week.
 */
export function currentIsoWeek(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // ISO weekday: Mon=1, Sun=7
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns Monday 00:00 UTC and Sunday 23:59:59.999 UTC for a given ISO week.
 * NOTE: caller must convert to Asia/Jakarta if they want WIB-aligned ranges.
 */
export function isoWeekRange(week: string): { start: Date; end: Date } {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) throw new Error(`invalid ISO week: ${week}`);
  const year = Number(m[1]);
  const wk = Number(m[2]);
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (wk - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  end.setUTCMilliseconds(-1);
  return { start, end };
}
```

- [ ] **Step 3: `weekly-review/schemas.ts`** — API DTOs

```ts
import { z } from 'zod';
import { WeeklyReviewContent } from './content.js';

export const WeeklyReviewDto = z.object({
  id: z.string(),
  week: z.string(),
  content: WeeklyReviewContent,
  created_at: z.string(),
});
export type WeeklyReviewDto = z.infer<typeof WeeklyReviewDto>;

export const ListWeeklyReviewsResponse = z.object({
  ok: z.literal(true),
  data: z.object({ reviews: z.array(WeeklyReviewDto) }),
});
export type ListWeeklyReviewsResponse = z.infer<typeof ListWeeklyReviewsResponse>;

export const GetWeeklyReviewResponse = z.object({
  ok: z.literal(true),
  data: z.object({ review: WeeklyReviewDto }),
});
export type GetWeeklyReviewResponse = z.infer<typeof GetWeeklyReviewResponse>;
```

- [ ] **Step 4: `weekly-review/index.ts`**

```ts
export * from './content.js';
export * from './iso-week.js';
export * from './schemas.js';
```

- [ ] **Step 5: Update `packages/shared/src/index.ts`**

```ts
export * from './weekly-review/index.js';
```

- [ ] **Step 6: Add error code**

```ts
'weekly_review.not_found': { http: 404, message: 'Review mingguan tidak ditemukan.' },
```

- [ ] **Step 7: Build + commit**

```bash
pnpm --filter @rapih/shared build
git add packages/shared/
git commit -m "$(cat <<'EOF'
feat(shared): weekly-review types + iso-week helpers

WeeklyReviewContent (LLM output contract: narrative_md + highlights + suggestion),
DTOs, and ISO week helpers shared between API, worker-ai, and worker-reminder.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: worker-reminder cron — broaden tier eligibility (Pro → Plus+Pro)

The existing `weekly-review` cron at `apps/worker-reminder/src/jobs/weekly-review.ts` filters `tier: 'pro'`. Per locked decision, broaden to include Plus.

**Files:**

- Modify: `apps/worker-reminder/src/jobs/weekly-review.ts`
- Modify: `apps/worker-reminder/tests/weekly-review.test.ts` — add Plus user case

- [ ] **Step 1: Update filter**

Change the eligibility query:

```ts
const eligible = await prisma.user.findMany({
  where: {
    tier: { in: ['plus', 'pro'] },
    onboarding_completed_at: { not: null },
    transactions: { some: { transacted_at: { gte: sinceCutoff }, deleted_at: null } },
  },
});
```

(Keep the rest of the handler unchanged — idempotency key + aiQueue.add still `weekly-review-gen` job.)

- [ ] **Step 2: Update tests**

- Existing test: "Pro user with recent activity → enqueued" stays.
- Add: "Plus user with recent activity → enqueued".
- Existing test: "Free user → skipped" stays.
- Update test that asserted "Plus skipped" if present — it should now be enqueued.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder test weekly-review
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): broaden weekly-review eligibility to Plus + Pro

Previously Pro-only; now Plus users also receive the Sunday weekly review.
Aligns with the broader "AI features = Plus floor" tier model.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: worker-ai — `ai.weekly-review-gen` handler

**Files:**

- Modify: `apps/worker-ai/src/config/env.ts` — add `OPENAI_WEEKLY_MODEL`
- Create: `apps/worker-ai/src/handlers/weekly-review-system-prompt.ts`
- Create: `apps/worker-ai/src/handlers/weekly-review.ts`
- Modify: `apps/worker-ai/src/server.ts` — register handler
- Create: `apps/worker-ai/tests/weekly-review.test.ts`

- [ ] **Step 1: Extend env**

```ts
OPENAI_WEEKLY_MODEL: z.string().default('gpt-4o-mini'),
```

Append `OPENAI_WEEKLY_MODEL=gpt-4o-mini` to `apps/worker-ai/.env.example`.

- [ ] **Step 2: `handlers/weekly-review-system-prompt.ts`**

```ts
export const WEEKLY_REVIEW_SYSTEM_PROMPT = `Kamu adalah analis keuangan untuk pengguna Rapih.

Tugas: tulis ringkasan keuangan satu minggu (Senin–Minggu, WIB) dalam Bahasa Indonesia yang hangat & singkat. Kembalikan JSON valid sesuai schema.

Schema:
{
  "narrative_md": string,    // 80-120 kata, markdown ringan (bold), 1 paragraf
  "highlights": [             // 2-4 item paling relevan
    { "label": string, "value": string, "delta": string | null }
  ],
  "suggestion": string       // 1 kalimat actionable, di bawah 200 karakter
}

Aturan:
- Format Rupiah: "Rp 1.250.000".
- narrative_md: highlight pola positif + flag area perhatian; jangan menggurui.
- highlights: angka konkret (mis. "Pengeluaran", "Rp 2.345.000", "+12% vs minggu lalu").
- suggestion: actionable, spesifik ke data minggu ini.
- Jangan mengarang data. Kalau metrik tidak ada, jangan dipakai.
`;
```

- [ ] **Step 3: `handlers/weekly-review.ts`** — full handler

Type:

```ts
type WeeklyReviewPayload = { user_id: string; week: string };
```

Flow:

```ts
export async function handleWeeklyReview(job: Job<WeeklyReviewPayload>) {
  const { user_id, week } = job.data;

  // Idempotent — if a row already exists for (user, week), skip.
  const existing = await prisma.weeklyReview.findUnique({
    where: { user_id_week: { user_id, week } },
  });
  if (existing) return;

  // Build context window: tx data for this week + prior week for delta.
  const { start, end } = isoWeekRange(week);
  const priorStart = new Date(start); priorStart.setUTCDate(priorStart.getUTCDate() - 7);
  const priorEnd = new Date(start); priorEnd.setUTCMilliseconds(-1);

  const [thisWeekTx, priorWeekTx, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { user_id, deleted_at: null, transacted_at: { gte: start, lte: end } },
      include: { category: true, wallet: true },
    }),
    prisma.transaction.findMany({
      where: { user_id, deleted_at: null, transacted_at: { gte: priorStart, lte: priorEnd } },
      select: { kind: true, amount: true, category_id: true },
    }),
    // Optional: this-month budgets for context
    prisma.budget.findMany({ where: { user_id, deleted_at: null } }),
    prisma.goal.findMany({ where: { user_id, deleted_at: null } }),
  ]);

  if (thisWeekTx.length === 0) {
    logger.info({ user_id, week }, 'weekly-review: skip (no transactions)');
    return;  // no push, no row — empty week
  }

  const context = buildContext({ thisWeekTx, priorWeekTx, budgets, goals });
  const userPrompt = JSON.stringify(context);

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_WEEKLY_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: WEEKLY_REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: `Data minggu ${week}:\n${userPrompt}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const parsed = safeJsonParse(raw);
  const validated = WeeklyReviewContent.safeParse(parsed);
  if (!validated.success) {
    logger.error({ user_id, week, raw }, 'weekly-review: parse failed');
    throw new Error('parse_failed');  // BullMQ marks failed; no push
  }

  // Persist + log usage in a single transaction
  const usage = completion.usage;
  await prisma.$transaction([
    prisma.weeklyReview.create({
      data: { user_id, week, content: validated.data as Prisma.InputJsonValue },
    }),
    prisma.aiUsageLog.create({
      data: {
        user_id,
        session_id: null,
        kind: 'weekly_review',
        model: env.OPENAI_WEEKLY_MODEL,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        cost_usd: computeCost(env.OPENAI_WEEKLY_MODEL, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      },
    }),
  ]);

  await getReminderQueue().add(
    'weekly-review.ready-push',
    { user_id, week },
    { jobId: `weekly-review-push:${user_id}:${week}` },
  );
}
```

`buildContext` (file-local helper):

```ts
function buildContext({ thisWeekTx, priorWeekTx, budgets, goals }: ...) {
  const sumBy = (rows: { kind: string; amount: bigint }[], kind: string) =>
    rows.filter((t) => t.kind === kind).reduce((s, t) => s + Number(t.amount), 0);

  const expenseThis = sumBy(thisWeekTx, 'expense');
  const expensePrior = sumBy(priorWeekTx, 'expense');
  const incomeThis = sumBy(thisWeekTx, 'income');

  const byCategory: Record<string, { name: string; total: number }> = {};
  for (const t of thisWeekTx) {
    if (t.kind !== 'expense') continue;
    const key = t.category_id;
    const name = t.category?.name ?? 'Lainnya';
    byCategory[key] = byCategory[key] ?? { name, total: 0 };
    byCategory[key].total += Number(t.amount);
  }
  const topCategories = Object.values(byCategory)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    week_expense_total: expenseThis,
    prior_week_expense_total: expensePrior,
    delta_pct: expensePrior > 0 ? Math.round(((expenseThis - expensePrior) / expensePrior) * 100) : null,
    week_income_total: incomeThis,
    transaction_count: thisWeekTx.length,
    top_categories: topCategories,
    active_budgets: budgets.map((b) => ({ category_id: b.category_id, limit: Number(b.limit_amount) })),
    active_goals: goals.map((g) => ({ name: g.name, target: Number(g.target_amount), saved: Number(g.saved_amount), deadline: g.deadline })),
  };
}
```

BigInt-to-Number coercion is OK here since the values are intermediate prompt context, not persisted financial state; for very large numbers (>2^53) this would lose precision, but personal finance Rupiah amounts are well within range. Document this assumption with a one-line comment.

- [ ] **Step 4: Register handler in `server.ts`**

```ts
startWorker({
  'tanya.chat-completion': handleTanyaChat,
  'ai.ocr-receipt': handleOcrReceipt,
  'ai.weekly-review-gen': handleWeeklyReview,
});
```

Note the job-name correction: worker-reminder enqueues `'weekly-review-gen'` (per Chunk A's reminder-worker spec § 5.4). Verify and reconcile — the dispatcher key must exactly match the enqueued job name. **Action:** read `apps/worker-reminder/src/jobs/weekly-review.ts` and confirm the name used in `aiQueue.add(...)`. If it's `'weekly-review-gen'` (no `ai.` prefix), register the handler under that exact key. Update this plan in-place if reconciliation is needed.

- [ ] **Step 5: Tests** — `tests/weekly-review.test.ts`

Use the existing `buildOpenAiCompletionMock` from Chunk B.

Tests (~8):

1. **Happy path**: seed 10 transactions for user across Mon–Sun of `2026-W22`; mock returns valid JSON → `weeklyReview` row created with content, `AiUsageLog` row written (kind='weekly_review'), reminder queue gains `weekly-review.ready-push` job.
2. **Empty week**: 0 transactions in the range → handler returns; no row created; no push enqueued; no AiUsageLog.
3. **Idempotent**: existing `weeklyReview` for `(user, week)` → handler returns early; no OpenAI call.
4. **Parse failure**: mock returns malformed JSON → handler throws; no row; no push.
5. **Zod failure**: mock returns JSON with `highlights.length > 4` → zod rejects → throws; no row.
6. **Prior-week delta**: seed prior-week transactions; context passed to OpenAI mock includes `delta_pct` computed correctly (spy on prompt).
7. **Cross-week isolation**: transactions outside `start..end` are not included in context (seed some on Sunday-of-prior-week and Monday-of-next-week).
8. **Cost log**: prompt/completion tokens match mock; `cost_usd` matches `computeCost('gpt-4o-mini', p, c)`.

- [ ] **Step 6: Run check + tests + commit**

```bash
pnpm --filter @rapih/worker-ai typecheck
pnpm --filter @rapih/worker-ai test weekly-review
git add apps/worker-ai/
git commit -m "$(cat <<'EOF'
feat(worker-ai): ai.weekly-review-gen handler

Consumes the weekly-review-gen jobs already enqueued by worker-reminder.
Pulls the user's transactions, budgets, and goals for the ISO week, asks
gpt-4o-mini to summarize via JSON mode, persists a WeeklyReview row, logs
token cost, and enqueues a push job on the reminder queue. Empty weeks
short-circuit without spend.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: worker-reminder — `weekly-review.ready-push` handler

**Files:**

- Create: `apps/worker-reminder/src/jobs/weekly-review-ready-push.ts`
- Modify: `apps/worker-reminder/src/worker.ts` — register
- Create: `apps/worker-reminder/tests/weekly-review-ready-push.test.ts`

- [ ] **Step 1: `weekly-review-ready-push.ts`**

```ts
import type { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { sendPushes } from '../lib/expo-push.js';
import { writeNotification } from '../lib/notification-write.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';

type Payload = { user_id: string; week: string };

export async function handleWeeklyReviewReadyPush(job: Job<Payload>) {
  const { user_id, week } = job.data;
  const key = `push:weekly-review:${user_id}:${week}`;
  if (!(await claim(key, 7 * 24 * 3600))) return;

  const review = await prisma.weeklyReview.findUnique({
    where: { user_id_week: { user_id, week } },
  });
  if (!review || review.deleted_at) {
    logger.warn({ user_id, week }, 'weekly-review-ready-push: review not found');
    return;
  }

  const tokens = await prisma.deviceToken.findMany({ where: { user_id } });
  if (tokens.length === 0) return;  // no devices → no notification row (spec rule)

  const title = 'Review mingguan kamu siap';
  const body = 'Ringkasan keuangan minggu ini sudah dibuat. Buka untuk lihat.';

  const notif = await writeNotification({
    user_id,
    kind: 'weekly_review',
    title,
    body,
    data: { kind: 'weekly_review', week },
  });

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { kind: 'weekly_review', week, notification_id: notif.id },
  }));

  const sendResult = await sendPushes(messages);
  if (sendResult.removeTokens.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: sendResult.removeTokens } } });
  }
}
```

- [ ] **Step 2: Register dispatcher**

In `apps/worker-reminder/src/worker.ts` dispatcher map:

```ts
'weekly-review.ready-push': handleWeeklyReviewReadyPush,
```

- [ ] **Step 3: Tests** (~4)

1. user with 2 devices → 2 messages sent + Notification row written (kind='weekly_review') + data payload includes `week`.
2. user with 0 devices → no row, no push.
3. Idempotent (run twice) → second is no-op.
4. DeviceNotRegistered → token deleted.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder typecheck
pnpm --filter @rapih/worker-reminder test weekly-review
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): weekly-review.ready-push handler

Sends the Expo push + writes Notification(kind='weekly_review') after
worker-ai persists a WeeklyReview row. Idempotent per (user, week).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: API — `/reviews` endpoints + tests

**Files:**

- Create: `apps/api/src/routes/weekly-reviews.ts`
- Modify: `apps/api/src/routes/index.ts` — register
- Modify: `apps/api/src/plugins/swagger.ts` — `weekly-reviews` tag
- Modify: `apps/api/tests/helpers/test-db.ts` — TRUNCATE `weekly_reviews`
- Create: `apps/api/tests/weekly-reviews.test.ts`

- [ ] **Step 1: `routes/weekly-reviews.ts`**

Two endpoints, both gated with `[app.authenticate, app.requireOnboarding, app.requirePlus]`:

```
GET    /reviews              query: { limit?: 1..100 }
                             → { reviews: WeeklyReviewDto[] }  (deleted_at IS NULL, desc by week)
GET    /reviews/:week        :week matches ^\d{4}-W\d{2}$
                             → { review: WeeklyReviewDto }
```

Implementation:

```ts
app.get('/reviews', { onRequest: [...] }, async (req) => {
  const reviews = await app.db.weeklyReview.findMany({
    where: { user_id: req.user.id, deleted_at: null },
    orderBy: { week: 'desc' },
    take: Math.min(req.query.limit ?? 26, 100),
  });
  return { ok: true, data: { reviews: reviews.map(toDto) } };
});

app.get('/reviews/:week', { onRequest: [...] }, async (req) => {
  const review = await app.db.weeklyReview.findFirst({
    where: { user_id: req.user.id, week: req.params.week, deleted_at: null },
  });
  if (!review) throw new AppError('weekly_review.not_found', '...', 404);
  return { ok: true, data: { review: toDto(review) } };
});
```

Param validation: `:week` schema = `z.string().regex(/^\d{4}-W\d{2}$/)`.

`toDto` maps `created_at` → ISO string, casts `content` as `WeeklyReviewContent`.

- [ ] **Step 2: Register + swagger tag**

- [ ] **Step 3: Update test-db helper**

Add `'weekly_reviews'` to TRUNCATE list.

- [ ] **Step 4: Tests** (~7)

1. Without token → 401.
2. Free user → 403 `tier.upgrade_required`.
3. Plus user, no reviews → empty list.
4. Plus user with 3 reviews → list desc by week; limit respected.
5. `GET /reviews/:week` returns own review.
6. `GET /reviews/:week` for cross-user week → 404 `weekly_review.not_found`.
7. `GET /reviews/2026-W22` for non-existent week → 404.
8. Invalid week format (e.g. `'2026-99'`) → 400 zod.

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @rapih/api typecheck
pnpm --filter @rapih/api test reviews
git add apps/api/
git commit -m "$(cat <<'EOF'
feat(api): GET /reviews and /reviews/:week

Plus+Pro users can list their weekly reviews and fetch one by ISO week
(YYYY-Www). Cross-user / not-found → 404.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Mobile — feature folder + screens

**Files:**

- Create: `apps/mobile/src/features/weekly-review/api.ts`
- Create: `apps/mobile/src/features/weekly-review/weekly-review-store.ts`
- Create: `apps/mobile/src/features/weekly-review/screens/reviews-list-screen.tsx`
- Create: `apps/mobile/src/features/weekly-review/screens/review-detail-screen.tsx`
- Create: `apps/mobile/src/features/weekly-review/components/highlight-card.tsx`
- Create: `apps/mobile/src/features/weekly-review/components/review-paywall-card.tsx`
- Create expo-router files: `apps/mobile/app/(app)/reviews/index.tsx`, `apps/mobile/app/(app)/reviews/[week].tsx` (verify exact router layout convention used in repo)
- Modify: `apps/mobile/src/features/profile/screens/notifikasi-screen.tsx` — handle `weekly_review` kind tap deep-link

- [ ] **Step 1: `api.ts`**

```ts
export async function listReviews(): Promise<WeeklyReviewDto[]> {
  const data = await apiRequest<ListWeeklyReviewsResponse['data']>('/reviews');
  return data.reviews;
}
export async function getReview(week: string): Promise<WeeklyReviewDto> {
  const data = await apiRequest<GetWeeklyReviewResponse['data']>(`/reviews/${week}`);
  return data.review;
}
```

- [ ] **Step 2: `weekly-review-store.ts`**

```ts
type State = {
  reviews: WeeklyReviewDto[];
  current: WeeklyReviewDto | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadList: () => Promise<void>;
  loadOne: (week: string) => Promise<void>;
};
```

Standard zustand pattern (mirror `notification-store.ts`).

- [ ] **Step 3: `reviews-list-screen.tsx`**

- Free user → render `<ReviewPaywallCard />`.
- Otherwise: header "Review mingguan", scroll list of cards.
- Each card: week label ("Minggu ke-22, 2026" — derive from `YYYY-Www`), 1-line truncated narrative preview, `created_at` formatted, tap → `router.push(\`/(app)/reviews/\${review.week}\`)`.
- Empty: "Belum ada review minggu ini. Pantengin terus aja — review otomatis dibuat tiap Minggu malam."
- Pull-to-refresh.

- [ ] **Step 4: `review-detail-screen.tsx`**

Layout:

- Header with back button + week label.
- Section 1: **Ringkasan** — render `narrative_md` with a small markdown renderer. Use `react-native-markdown-display` if not already present, OR write a minimal markdown helper that only handles `**bold**` and `\n` paragraphs (recommended — adding a dep for one screen is heavy). Pure-RN minimal renderer:

```ts
function renderNarrative(md: string): React.ReactNode {
  return md.split('\n').map((line, i) => (
    <Text key={i} variant="body" style={{ marginBottom: 8, lineHeight: 22 }}>
      {parseBold(line)}
    </Text>
  ));
}
function parseBold(line: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>
      : <Text key={i}>{p}</Text>,
  );
}
```

- Section 2: **Highlights** — grid of `<HighlightCard>` components, one per highlight. Card layout: label small caps, value figure-style, delta as small subtitle.
- Section 3: **Saran** — `suggestion` in a tinted card (e.g. `palette.limeSoft` bg + `palette.moss` text) with a lightbulb-style icon emoji.

- [ ] **Step 5: `highlight-card.tsx`** + `review-paywall-card.tsx`

Standard component patterns matching existing pastel palette.

- [ ] **Step 6: Extend `notifikasi-screen.tsx` tap handler**

For `kind === 'weekly_review'`: parse `data.week` and `router.push(\`/(app)/reviews/\${week}\`)`.

`weekly_review` is already in `KIND_TO_VARIANT` map (review). No changes needed there.

- [ ] **Step 7: Router registration**

Add expo-router files (verify exact pattern from `app/(app)/...` existing structure):

- `app/(app)/reviews/index.tsx` → `<ReviewsListScreen />`
- `app/(app)/reviews/[week].tsx` → `<ReviewDetailScreen />` (reads `useLocalSearchParams<{ week: string }>()`)

- [ ] **Step 8: Manual smoke**

```bash
pnpm --filter @rapih/mobile typecheck
```

Then expo dev:

- Free user → paywall on /reviews.
- Plus user → empty list initially.
- Manually insert a `WeeklyReview` row in dev DB → list shows it → tap → detail renders narrative/highlights/suggestion.
- Trigger a fake `weekly_review` notification (via DB insert + push) → tap → lands on detail.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/
git commit -m "$(cat <<'EOF'
feat(mobile): weekly review list + detail screens

New /reviews route stack: list of past weeks + detail with narrative,
highlights grid, and suggestion card. Notification tap deep-links to
detail. Free users see paywall. Markdown narrative rendered with a
minimal in-house parser (bold + paragraphs only) to avoid pulling in
a full markdown lib for one screen.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Spine Feature Atlas update + final integration check

**Files:**

- Modify: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — Atlas row

- [ ] **Step 1: Mark `weekly-review-gen consumer` row → done** in Feature Atlas.

- [ ] **Step 2: Full repo check**

```bash
pnpm check
pnpm --filter @rapih/api test
pnpm --filter @rapih/worker-ai test
pnpm --filter @rapih/worker-reminder test
pnpm --filter @rapih/mobile typecheck
```

- [ ] **Step 3: Branch state + report**

```bash
git status
git log --oneline main..HEAD
```

- [ ] **Step 4: Commit atlas update**

```bash
git add docs/superpowers/specs/2026-05-20-rapih-backend-spine.md
git commit -m "$(cat <<'EOF'
docs(spine): mark weekly-review-gen as done

Chunk C of ai-worker complete. ai-worker sub-project (Chunks A+B+C) now
fully shipped: Tanya chat, scan-struk OCR, and weekly review.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Hand off** — do NOT push or open PR. Report back with commit count, test summary, and any manual smoke results.

---

## Appendix A — Done criteria

- [ ] All 8 tasks committed on `feat/worker-ai-weekly-review`.
- [ ] `pnpm check` passes.
- [ ] `pnpm --filter @rapih/api test` passes — includes weekly-reviews tests.
- [ ] `pnpm --filter @rapih/worker-ai test` passes — includes weekly-review handler tests.
- [ ] `pnpm --filter @rapih/worker-reminder test` passes — includes cron eligibility + ready-push tests.
- [ ] `pnpm --filter @rapih/mobile typecheck` passes.
- [ ] Spine Feature Atlas updated.
- [ ] Manual smoke: list, detail, notif deep-link.

## Appendix B — Deferred from this chunk

- Manual "Generate now" button — out of scope (cron-driven only).
- Email digest of the same content — out of scope.
- "What changed since last week" comparison view — narrative already touches on this; dedicated UI deferred.
- Sharing review as image/screenshot — deferred.
- Weekly review settings (turn off, change day, change time) — out of scope; defer to pengaturan-screen toggles later.
- AI-prompted user check-in (interactive follow-up) — out of scope.
- Multi-language: English version of prompt + UI strings. Deferred until user base needs it.
