# worker-reminder — Design Spec

**Status:** draft · **Date:** 2026-05-28 · **Owner:** @ridhoidris
**Sub-project:** reminder-worker (per Spine § 15.5)
**References:** [Spine](./2026-05-20-rapih-backend-spine.md) § 2 (stack), § 10 (async jobs), § 10.2 (reminder jobs), § 11 (push notifications)

This spec covers the entire `reminder-worker` sub-project in one chunk: all 4 cron jobs, push notification plumbing, Expo Push integration, and the user-facing notification feed (API + mobile UI rewire).

## 1. Goals

Ship a self-contained `apps/worker-reminder` BullMQ worker that:

1. Auto-creates transactions when recurring bills come due (daily 00:05 WIB).
2. Pushes reminders for upcoming recurring bills (H-1) and goal deadlines (H-7, H-1).
3. Pushes a streak-nudge if the user logged no transaction today (daily 20:00 WIB).
4. Enqueues a weekly review generation job for Pro users (Sunday 22:00 WIB) — the future ai-worker will consume.

Plus the **notification feed** users can read in-app:

5. Every push is also persisted to a `notifications` table.
6. API exposes `GET /notifications` + `POST /notifications/mark-read`.
7. Mobile `notifikasi-screen.tsx` is rewired from dummy data to live API.

Out of scope: ai-worker itself, scan-struk OCR, billing webhooks, admin CMS.

## 2. Locked Decisions

| Concern | Choice | Reasoning |
|---|---|---|
| Cron scheduler | **BullMQ `JobScheduler`** (repeatable jobs) | Redis-locked, multi-replica safe, single source of truth in code. No external cron. |
| Idempotency store | **Redis SET NX + EX** (TTL 48h) | Zero migration. Sufficient for daily/hourly cadence. |
| Recurring due push | **H-1 only** | Klasik reminder; multi-day notification can come later. |
| Goal nudge | **Deadline H-7 + H-1** | Calendar-based, simple — no progress-ratio math. |
| Streak rule | **No transaction today by 20:00 WIB → push** | Simplest meaningful trigger; no streak-counter table needed. |
| Notification feed | **Persist every push** → mobile reads from table | One implementation, doubles as audit + dedupe surface. |
| Weekly review | **Cron enqueues `ai.weekly-review-gen`** | Jobs sit in Redis until ai-worker is built. Cron is ready day one. |
| Testing | **Real Redis (DB 15) + real Postgres + mocked Expo HTTP** | High fidelity, fast enough for vitest. |
| Device token cleanup | **Hard-delete on Expo `DeviceNotRegistered`** | Matches existing `device_tokens` table (no soft-delete column). |

## 3. App Structure

New app: `apps/worker-reminder/`.

```
apps/worker-reminder/
  src/
    config/
      env.ts                 zod-validated env (REDIS_URL, EXPO_ACCESS_TOKEN, DATABASE_URL, TZ, LOG_LEVEL)
    lib/
      logger.ts              pino, JSON logs (match API)
      redis.ts               ioredis singleton (BullMQ requires ioredis)
      prisma.ts              @rapih/db PrismaClient singleton
      expo-push.ts           POST exp.host/--/api/v2/push/send, batches of 100,
                             returns per-ticket result so caller can act on DeviceNotRegistered
      idempotency.ts         claim(key, ttlSeconds): boolean (SET NX + EX)
      notification-write.ts  helper: create Notification row + return its id for push data payload
    jobs/
      recurring-create.ts    handler — find recurring with next_due_date <= today,
                             $transaction([create Transaction, update RecurringTransaction]) per row
      due-push.ts            handler — H-1 recurring + H-7/H-1 goals → push + Notification rows
      streak-nudge.ts        handler — users with onboarding done + no tx today → push + Notification rows
      weekly-review.ts       handler — Pro users with ≥1 tx in last 30d → enqueue to 'ai' queue
    queues/
      reminder.ts            export const reminderQueue = new Queue('reminder', { connection })
      ai.ts                  export const aiQueue = new Queue('ai', { connection })  ← producer only
    worker.ts                new Worker('reminder', dispatcher, { connection })
                             dispatcher switches on job.name → calls handler from jobs/
    scheduler.ts             registerSchedules(): adds 4 JobScheduler entries with tz='Asia/Jakarta'
    server.ts                main entrypoint: connect, registerSchedules, start worker,
                             minimal HTTP /health endpoint (Dokploy probe)
  tests/
    helpers/
      test-redis.ts          ioredis to redis://localhost:6379/15; flushdb in beforeEach
      test-db.ts             copy of apps/api/tests/helpers/test-db.ts + 'notifications' in TRUNCATE
      test-env.ts            sets test env vars
      expo-mock.ts           vi.fn() wrapper, return shaped tickets or throw injected errors
    recurring-create.test.ts ~6 tests
    due-push.test.ts         ~8 tests
    streak-nudge.test.ts     ~5 tests
    weekly-review.test.ts    ~3 tests
    idempotency.test.ts      ~3 tests
    expo-push.test.ts        ~4 tests (batching, DeviceNotRegistered cleanup)
  package.json
  tsconfig.json
  Dockerfile                 multi-stage, entry: node dist/server.js
  .env.example
```

**Single queue `reminder`** with named jobs (`recurring-create`, `due-push`, `streak-nudge`, `weekly-review`). Worker dispatches by `job.name`. `ai` queue is producer-only here.

**Workers do not import from `apps/api`** (Spine § 3 rule). Shared logic lives in `packages/shared` or `packages/db`.

## 4. Schema Additions

Add to `packages/db/prisma/schema.prisma`:

```prisma
enum NotificationKind {
  recurring_due
  goal_deadline
  streak_nudge
  weekly_review
}

model Notification {
  id         String           @id @default(cuid())
  user_id    String
  kind       NotificationKind
  title      String
  body       String
  data       Json?
  read_at    DateTime?
  created_at DateTime         @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, created_at])
  @@index([user_id, read_at])
  @@map("notifications")
}
```

Add to `User`:
```prisma
notifications Notification[]
```

Migration name: `add_notifications`.

`device_tokens` table needs no change. Hard-delete on Expo `DeviceNotRegistered`.

## 5. Cron Schedules & Job Logic

All schedules are `tz: 'Asia/Jakarta'`.

### 5.1 `recurring-create` (cron `5 0 * * *` — daily 00:05 WIB)

```ts
const today = startOfDay(now);
const due = await prisma.recurringTransaction.findMany({
  where: { next_due_date: { lte: endOfDay(today) }, deleted_at: null },
});
for (const r of due) {
  const key = `recurring-create:${ymd(today)}:${r.id}`;
  if (!(await idempotency.claim(key, 48 * 3600))) continue;
  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        user_id: r.user_id, kind: r.kind, wallet_id: r.wallet_id,
        category_id: r.category_id, amount: r.amount,
        note: r.note, transacted_at: r.next_due_date,
      },
    }),
    prisma.recurringTransaction.update({
      where: { id: r.id },
      data: {
        last_paid_at: now,
        next_due_date: advanceDueDate(r.next_due_date, r.period),
      },
    }),
  ]);
}
```

`advanceDueDate()` already exists in `apps/api/src/routes/recurring.ts` — extract to `packages/shared/src/recurring/advance-due-date.ts` so the worker can import it without depending on the API.

### 5.2 `due-push` (cron `0 9 * * *` — daily 09:00 WIB)

Find candidates:
- Recurring H-1: `next_due_date BETWEEN start(tomorrow) AND end(tomorrow)` AND `deleted_at IS NULL`.
- Goal H-7: `deadline = today + 7 days` (date-only equality) AND `deleted_at IS NULL`.
- Goal H-1: `deadline = today + 1 day` AND `deleted_at IS NULL`.

For each candidate, idempotency key:
- `push:recurring-due:{YYYYMMDD}:{recurring_id}`
- `push:goal-due:{YYYYMMDD}:{goal_id}:H7`
- `push:goal-due:{YYYYMMDD}:{goal_id}:H1`

For each claim, fetch user's device tokens, build Expo message + write Notification row. Batch all messages, send via `expo-push.ts`, handle errors (see § 6).

Copy templates (Bahasa Indonesia):
- Recurring: title `"{name} jatuh tempo besok"`, body `"Bayar Rp {amount} besok"`.
- Goal H-7: title `"Goal {name} tinggal 7 hari"`, body `"Tersisa Rp {gap} dari target"`.
- Goal H-1: title `"Goal {name} besok!"`, body `"Tersisa Rp {gap} dari target"`.

`data` payload: `{ kind, recurring_id|goal_id, notification_id }`.

### 5.3 `streak-nudge` (cron `0 20 * * *` — daily 20:00 WIB)

```ts
const today = startOfDay(now);
const candidates = await prisma.user.findMany({
  where: {
    onboarding_completed_at: { not: null },
    transactions: { none: { transacted_at: { gte: today }, deleted_at: null } },
  },
  include: { device_tokens: true },
});
for (const u of candidates) {
  const key = `push:streak:${ymd(today)}:${u.id}`;
  if (!(await idempotency.claim(key, 48 * 3600))) continue;
  // build message + notification row + queue for batch
}
```

Copy: title `"Belum catat pengeluaran hari ini"`, body `"Yuk catat satu hal — biar streak gak putus."`. `data: { kind: 'streak_nudge', notification_id }`.

If the candidate has no device tokens, skip entirely — do NOT write a Notification row. (Streak nudges only matter if the user can be reached; the feed already shows other notifications they can interact with.)

### 5.4 `weekly-review` (cron `0 22 * * 0` — Sunday 22:00 WIB)

```ts
const sinceCutoff = subDays(now, 30);
const eligible = await prisma.user.findMany({
  where: {
    tier: 'pro',
    transactions: { some: { transacted_at: { gte: sinceCutoff }, deleted_at: null } },
  },
});
for (const u of eligible) {
  const week = isoWeek(now);  // e.g. "2026-W22"
  const key = `weekly-review-enqueue:${week}:${u.id}`;
  if (!(await idempotency.claim(key, 7 * 24 * 3600))) continue;
  await aiQueue.add('weekly-review-gen', { user_id: u.id, week });
}
```

No push from this cron. ai-worker (future) will generate the content and push.

## 6. Expo Push Integration

`apps/worker-reminder/src/lib/expo-push.ts`:

```ts
type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type SendResult = {
  ok: { to: string }[];
  removeTokens: string[];  // DeviceNotRegistered → caller deletes
  errors: { to: string; error: string }[];
};

export async function sendPushes(messages: PushMessage[]): Promise<SendResult>;
```

- POST `https://exp.host/--/api/v2/push/send` with `Authorization: Bearer ${EXPO_ACCESS_TOKEN}` (when set).
- Chunk messages into groups of 100 (Expo's documented limit).
- Parse response per ticket: `status === 'error'` + `details.error === 'DeviceNotRegistered'` → add to `removeTokens`.
- Other ticket errors (rate limit, network) → log + add to `errors`; no retry inside the worker process (next cron run will re-attempt because idempotency key persists per day).
- After all chunks complete, caller hard-deletes `device_tokens` whose token is in `removeTokens`.

If `EXPO_ACCESS_TOKEN` is unset (dev/test), `sendPushes` calls the injected mock instead.

## 7. Idempotency

`apps/worker-reminder/src/lib/idempotency.ts`:

```ts
export async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}
```

TTLs:
- `recurring-create:*` → 48h
- `push:recurring-due:*`, `push:goal-due:*`, `push:streak:*` → 48h
- `weekly-review-enqueue:*` → 7 days

Pattern: claim BEFORE doing any side effect (DB write, push). If claim fails → skip silently.

## 8. API endpoints (apps/api)

New file: `apps/api/src/routes/notifications.ts`.

```
GET    /notifications              query: { unread?: boolean, kind?: NotificationKind, limit?: 1..200 }
                                   response: { ok: true, data: { notifications: NotificationDto[] } }
POST   /notifications/mark-read    body: { ids: string[] } | { all: true }
                                   response: { ok: true, data: { updated: number } }
```

Auth: both endpoints require `app.authenticate` + `app.requireOnboarding`. Always scope by `req.user.id`.

`POST /notifications/mark-read`:
- If `{ ids }`: `updateMany where: { id: in ids, user_id: req.user.id, read_at: null }`.
- If `{ all: true }`: `updateMany where: { user_id: req.user.id, read_at: null }`.
- Returns `{ updated: count }`.

## 9. Shared types (packages/shared)

New folder: `packages/shared/src/notifications/`.

```ts
// enums.ts
export const NotificationKindSchema = z.enum([
  'recurring_due', 'goal_deadline', 'streak_nudge', 'weekly_review',
]);

// schemas.ts
export const NotificationDto = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export const NotificationListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ notifications: z.array(NotificationDto) }),
});

export const MarkReadBody = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1) }),
  z.object({ all: z.literal(true) }),
]);

export const MarkReadResponse = z.object({
  ok: z.literal(true),
  data: z.object({ updated: z.number().int().nonnegative() }),
});
```

Also extract `packages/shared/src/recurring/advance-due-date.ts` from `apps/api/src/routes/recurring.ts` so both api and worker can import.

Add `notification.not_found` to `packages/shared/src/errors.ts`.

Add `export * from './notifications/index.js'` to `packages/shared/src/index.ts`.

## 10. Mobile UI rewire

New folder: `apps/mobile/src/features/notification/`.

```
api.ts                 listNotifications(opts), markRead(ids), markAllRead()
notification-store.ts  Zustand: { status, error, items, fetch(), markRead(ids), markAllRead() }
```

Rewire `apps/mobile/src/features/profile/screens/notifikasi-screen.tsx`:

1. Replace `GROUPS` const with `useNotificationStore()` items.
2. Group client-side by `created_at`:
   - "Hari ini" — `created_at >= startOfToday`
   - "Minggu ini" — `created_at >= startOfWeek` (Mon, Asia/Jakarta)
   - "Lebih lama" — older
3. Kind→variant map (existing TYPE_META retains `ai`/`budget` for future):
   - `recurring_due → 'tx'`
   - `goal_deadline → 'goal'`
   - `streak_nudge → 'streak'`
   - `weekly_review → 'review'`
4. `isNew = item.read_at === null`.
5. Tap item → `markRead([item.id])` (deep-link navigation deferred).
6. "Baca semua" → `markAllRead()`.
7. Wrap in `<ScrollView refreshControl={<RefreshControl onRefresh={fetch} />}>`.
8. Empty state: friendly Bahasa Indonesia copy ("Belum ada notifikasi · Catat pengeluaran biar Rapih bisa kirim insight.").
9. Loading: simple skeleton (3 placeholder rows) matching the existing card style.

Time display `tm`: format `created_at` as `HH:mm` if today, `Jum, HH:mm` if this week, `dd MMM` if older.

## 11. Environment

New: `apps/worker-reminder/.env.example`

```
NODE_ENV=development
DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih
REDIS_URL=redis://localhost:6379
EXPO_ACCESS_TOKEN=
TZ=Asia/Jakarta
LOG_LEVEL=info
```

Root `.env.example`: add `REDIS_URL`, `EXPO_ACCESS_TOKEN`.

API does NOT yet need Redis (no producer code lives there in this chunk).

## 12. Testing strategy

**Test infra:**
- `redis://localhost:6379/15` — Vitest beforeEach `FLUSHDB`.
- Postgres test DB shared with api (same `rapih_test` database, but worker tests use a different table set + their own truncate helper that includes `notifications`).
- Expo Push: every test injects a `vi.fn()` mock via a factory; the real HTTP client is only used in prod.

**Coverage targets per file:**

- `recurring-create.test.ts`:
  - creates transaction when due
  - advances next_due_date by period
  - skips deleted recurring
  - idempotent (run twice → still one transaction)
  - handles wallet with `Restrict` onDelete (existing FK) — must not crash if wallet missing? (Test: recurring with deleted wallet → skip + log, no crash)
  - amount/kind/note copied correctly

- `due-push.test.ts`:
  - recurring H-1 → push sent + Notification row + idempotency key set
  - goal H-7 → push sent + correct copy
  - goal H-1 → push sent + correct copy
  - user with 2 devices → 2 messages in batch
  - user with 0 devices → no push, no Notification row
  - DeviceNotRegistered ticket → token row deleted
  - same job run twice → second is no-op
  - >100 messages → multiple chunks to Expo

- `streak-nudge.test.ts`:
  - user with no tx today → push
  - user with tx today → no push
  - user without onboarding → no push
  - 0 devices → Notification row still created? **Decision: no — skip entirely if no tokens.** (Don't pollute feed with notifications the user can't act on.)
  - idempotency

- `weekly-review.test.ts`:
  - Pro user with recent activity → ai job enqueued
  - Free user → skipped
  - Pro user inactive 30+ days → skipped
  - idempotent per week

- `idempotency.test.ts`:
  - claim returns true first time, false second time
  - TTL set correctly
  - independent keys don't collide

- `expo-push.test.ts`:
  - 1 message → 1 chunk
  - 250 messages → 3 chunks
  - DeviceNotRegistered → token in `removeTokens`
  - generic error → in `errors`, others still succeed

**API tests** (in `apps/api/tests/`):
- `notifications.test.ts` — list (auth/onboarding guards, empty, filter unread, filter kind, limit), mark-read (by ids, all, cross-user isolation, returns 0 for already-read).

**Mobile**: no test infra exists yet → manual smoke test via expo dev.

## 13. Deployment

`apps/worker-reminder/Dockerfile` — multi-stage like api:
1. base: node:22-alpine, pnpm
2. deps: install workspace deps
3. build: tsc
4. runner: copy dist + node_modules, `CMD ["node", "dist/server.js"]`

Dokploy: 1 new service `worker-reminder`. Same Postgres + Redis as api. Health probe via `/health`.

Logs: pino → stdout JSON. Dokploy collects.

## 14. Rollout

Order:
1. `packages/db` migration (add notifications + enum).
2. `packages/shared` — notifications types + extract advanceDueDate.
3. `apps/api` — `/notifications` routes + tests.
4. `apps/worker-reminder` — full build + tests.
5. `apps/mobile` — feature folder + screen rewire.
6. Update Spine Feature Atlas (rows 385-388 → done).

Each step lands on `feat/reminder-worker`. One feature branch, one PR — coherent chunk.

## 15. Open questions (deferred — handled at implementation time)

- Notification feed pagination: current spec uses `limit` only. Cursor pagination can come later if mobile needs it.
- Notification copy localization: only Bahasa Indonesia for v1. If second locale is added, lift to `packages/shared` copy table.
- Goal deadline notification when `deadline IS NULL`: skip (no deadline → no nudge).
- User-level notification preferences (turn off streak nudge, etc.): out of scope; handled by `pengaturan-screen.tsx` toggles later.
- Daylight savings / TZ edge cases: Indonesia has no DST, so `Asia/Jakarta` is stable.

---

## Appendix A — File checklist

**packages/db:**
- [ ] `prisma/schema.prisma` — add `NotificationKind` enum + `Notification` model + `User.notifications` relation
- [ ] migration `add_notifications`

**packages/shared:**
- [ ] `src/notifications/enums.ts`
- [ ] `src/notifications/schemas.ts`
- [ ] `src/notifications/index.ts`
- [ ] `src/recurring/advance-due-date.ts` (extracted)
- [ ] `src/index.ts` — add notifications export
- [ ] `src/errors.ts` — add `notification.not_found`

**apps/api:**
- [ ] `src/routes/notifications.ts`
- [ ] `src/routes/index.ts` — register
- [ ] `src/routes/recurring.ts` — import advanceDueDate from shared
- [ ] `src/plugins/swagger.ts` — add `notifications` tag
- [ ] `tests/helpers/test-db.ts` — add `notifications` to TRUNCATE
- [ ] `tests/notifications.test.ts`

**apps/worker-reminder/** (entire new app — see § 3)

**apps/mobile:**
- [ ] `src/features/notification/api.ts`
- [ ] `src/features/notification/notification-store.ts`
- [ ] `src/features/profile/screens/notifikasi-screen.tsx` — rewire

**docs:**
- [ ] Update Spine Feature Atlas rows 385-388 status → `done`
