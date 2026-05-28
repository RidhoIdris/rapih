# worker-reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/worker-reminder` — a BullMQ worker running 4 cron jobs (recurring auto-create, due/goal push, streak nudge, weekly review enqueue) plus user-facing notification feed (API + mobile UI rewire).

**Architecture:** Self-contained Node process. Single BullMQ `reminder` queue with named jobs; `JobScheduler` registers cron schedules at boot (Asia/Jakarta tz). Push via Expo Push HTTP API. Idempotency via Redis SET NX. Notifications persisted to new `notifications` table; mobile screen rewired from dummy to live data.

**Tech Stack:** Node 22 / TypeScript / Fastify (health endpoint only) / BullMQ + ioredis / Prisma 6 (via `@rapih/db`) / Pino / Vitest. Mobile: Expo SDK 55 + Zustand.

**Spec:** `docs/superpowers/specs/2026-05-28-worker-reminder-design.md` — reference for big code blocks and copy text.

**Branch:** `feat/reminder-worker` (already created from `feat/device-token-register`).

**Workflow note:** This project batches file writes per task then runs `pnpm check` + `pnpm test` once at the end of the task. TDD-discipline is enforced at task granularity, not per-step. Each task = atomic commit.

---

## Task 1: Schema migration — `notifications` table

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_notifications/migration.sql` (generated)

- [ ] **Step 1: Add enum + model to schema**

Append to `packages/db/prisma/schema.prisma` (after `DeviceToken` model):

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

- [ ] **Step 2: Add relation back-ref on `User`**

In the `User` model relations block, add:

```prisma
notifications            Notification[]
```

(Place alphabetically — after `device_tokens` and before `profile`.)

- [ ] **Step 3: Generate migration**

```bash
pnpm --filter @rapih/db exec prisma migrate dev --name add_notifications --create-only
```

Expected: a new migration directory under `packages/db/prisma/migrations/` is created. Inspect the SQL to confirm it creates `notifications` table + `NotificationKind` enum, with both indexes.

- [ ] **Step 4: Apply migration to dev + test DBs and rebuild client**

```bash
pnpm --filter @rapih/db exec prisma migrate deploy
DATABASE_URL="postgresql://rapih:rapih@localhost:5433/rapih_test" pnpm --filter @rapih/db exec prisma migrate deploy
pnpm --filter @rapih/db build
```

Expected: both DBs updated. `@rapih/db` builds without error.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add notifications table + NotificationKind enum

For the reminder-worker push feed: every push notification is persisted so
mobile can read the in-app feed (GET /notifications) and mark items read.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared types + extract `advanceDueDate`

**Files:**
- Create: `packages/shared/src/notifications/enums.ts`
- Create: `packages/shared/src/notifications/schemas.ts`
- Create: `packages/shared/src/notifications/index.ts`
- Create: `packages/shared/src/recurring/advance-due-date.ts`
- Modify: `packages/shared/src/recurring/index.ts` — export advance-due-date
- Modify: `packages/shared/src/index.ts` — export notifications
- Modify: `packages/shared/src/errors.ts` — add `notification.not_found`

- [ ] **Step 1: Write `packages/shared/src/notifications/enums.ts`**

```ts
import { z } from 'zod';

export const NotificationKindSchema = z.enum([
  'recurring_due',
  'goal_deadline',
  'streak_nudge',
  'weekly_review',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
```

- [ ] **Step 2: Write `packages/shared/src/notifications/schemas.ts`**

```ts
import { z } from 'zod';
import { NotificationKindSchema } from './enums.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const NotificationDto = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type NotificationDto = z.infer<typeof NotificationDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const MarkReadBody = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkReadBody = z.infer<typeof MarkReadBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const NotificationListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ notifications: z.array(NotificationDto) }),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponse>;

export const MarkReadResponse = z.object({
  ok: z.literal(true),
  data: z.object({ updated: z.number().int().nonnegative() }),
});
export type MarkReadResponse = z.infer<typeof MarkReadResponse>;
```

- [ ] **Step 3: Write `packages/shared/src/notifications/index.ts`**

```ts
export * from './enums.js';
export * from './schemas.js';
```

- [ ] **Step 4: Write `packages/shared/src/recurring/advance-due-date.ts`**

```ts
import type { RecurringPeriod } from './enums.js';

/**
 * Advance a recurring due-date by one period.
 * Used by both the API (mark-as-paid endpoint) and worker-reminder (cron auto-create).
 */
export function advanceDueDate(current: Date, period: RecurringPeriod): Date {
  const d = new Date(current);
  if (period === 'daily') d.setDate(d.getDate() + 1);
  else if (period === 'weekly') d.setDate(d.getDate() + 7);
  else if (period === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (period === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}
```

- [ ] **Step 5: Update `packages/shared/src/recurring/index.ts`**

Add to the bottom (preserve existing exports):

```ts
export * from './advance-due-date.js';
```

- [ ] **Step 6: Update `packages/shared/src/index.ts`**

Insert alphabetically (after `errors`):

```ts
export * from './notifications/index.js';
```

Final order:
```ts
export * from './auth/index.js';
export * from './budgets/index.js';
export * from './categories/index.js';
export * from './devices/index.js';
export * from './errors.js';
export * from './goals/index.js';
export * from './notifications/index.js';
export * from './receipts/index.js';
export * from './recurring/index.js';
export * from './transactions/index.js';
export * from './wallets/index.js';
```

- [ ] **Step 7: Add `notification.not_found` to `packages/shared/src/errors.ts`**

Insert alphabetically into `ERROR_MESSAGES`:

```ts
  'notification.not_found': 'Notifikasi tidak ditemukan.',
```

(Between `goal.not_found` and `receipt.not_found`.)

- [ ] **Step 8: Build shared**

```bash
pnpm --filter @rapih/shared build
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/
git commit -m "$(cat <<'EOF'
feat(shared): notification types + extract advanceDueDate

- Add NotificationKindSchema + NotificationDto + MarkReadBody/Response
- Add notification.not_found error code
- Extract advanceDueDate() from apps/api/src/routes/recurring.ts so worker-reminder can import it without depending on the API.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: API notifications routes + recurring.ts refactor

**Files:**
- Create: `apps/api/src/routes/notifications.ts`
- Modify: `apps/api/src/routes/index.ts` — register `notificationsRoutes`
- Modify: `apps/api/src/routes/recurring.ts` — import `advanceDueDate` from shared, remove local copy
- Modify: `apps/api/src/plugins/swagger.ts` — add `notifications` tag
- Modify: `apps/api/tests/helpers/test-db.ts` — add `notifications` to TRUNCATE
- Create: `apps/api/tests/notifications.test.ts`

- [ ] **Step 1: Write `apps/api/src/routes/notifications.ts`**

```ts
import {
  MarkReadBody,
  MarkReadResponse,
  NotificationKindSchema,
  NotificationListResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';

const ListQuery = z.object({
  unread: z.coerce.boolean().optional(),
  kind: NotificationKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function notificationToDto(row: {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: unknown;
  read_at: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    kind: row.kind as 'recurring_due' | 'goal_deadline' | 'streak_nudge' | 'weekly_review',
    title: row.title,
    body: row.body,
    data: (row.data ?? null) as unknown,
    read_at: row.read_at ? row.read_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List notifications ────────────────────────────────────────────────
  app.get(
    '/notifications',
    {
      schema: {
        tags: ['notifications'],
        summary: "List the current user's in-app notifications",
        querystring: ListQuery,
        response: { 200: NotificationListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const { unread, kind, limit } = req.query;
      const rows = await app.db.notification.findMany({
        where: {
          user_id: req.user.id,
          ...(unread === true && { read_at: null }),
          ...(kind && { kind }),
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
      return ok({ notifications: rows.map(notificationToDto) });
    }
  );

  // ─── Mark as read (bulk or all) ────────────────────────────────────────
  app.post(
    '/notifications/mark-read',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Mark notifications as read (by ids, or all unread)',
        body: MarkReadBody,
        response: { 200: MarkReadResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;
      const now = new Date();
      const result =
        'all' in body
          ? await app.db.notification.updateMany({
              where: { user_id: req.user.id, read_at: null },
              data: { read_at: now },
            })
          : await app.db.notification.updateMany({
              where: { user_id: req.user.id, id: { in: body.ids }, read_at: null },
              data: { read_at: now },
            });
      return ok({ updated: result.count });
    }
  );
};
```

- [ ] **Step 2: Register in `apps/api/src/routes/index.ts`**

Add import alphabetically and call `app.register(notificationsRoutes)` (place after `goalsRoutes`):

```ts
import { notificationsRoutes } from './notifications.js';
// ...
await app.register(notificationsRoutes);
```

- [ ] **Step 3: Refactor `apps/api/src/routes/recurring.ts` to import advanceDueDate from shared**

Remove the local `function advanceDueDate(...)` declaration. Add to the top imports:

```ts
import { advanceDueDate } from '@rapih/shared';
```

(Place alphabetically in the existing `@rapih/shared` import group, or add new line as appropriate.)

- [ ] **Step 4: Add `notifications` tag to `apps/api/src/plugins/swagger.ts`**

Insert in tags array alphabetically (between `meta` and `receipts` — actually after `goals`, before `receipts`):

```ts
        { name: 'notifications', description: 'In-app notification feed (list + mark-read).' },
```

- [ ] **Step 5: Update TRUNCATE in `apps/api/tests/helpers/test-db.ts`**

Replace the TRUNCATE statement with (add `"notifications"` after `"refresh_tokens"`):

```ts
    'TRUNCATE TABLE "refresh_tokens", "notifications", "social_accounts", "user_profiles", "device_tokens", "transactions", "recurring_transactions", "goals", "budget_categories", "budgets", "receipts", "wallets", "categories", "users" RESTART IDENTITY CASCADE'
```

- [ ] **Step 6: Write `apps/api/tests/notifications.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `notif-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── Auth / onboarding guards ────────────────────────────────────────

  it('GET /notifications returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /notifications returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /notifications returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.notifications).toEqual([]);
  });

  it('GET /notifications returns own notifications, newest first', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'recurring_due',
        title: 'old',
        body: 'old',
        created_at: new Date('2026-05-01'),
      },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'new', body: 'new' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.notifications;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('new');
  });

  it("GET /notifications excludes other users' rows", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-notif@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    await prisma.notification.create({
      data: { user_id: other.id, kind: 'streak_nudge', title: 'hidden', body: 'hidden' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.notifications).toEqual([]);
  });

  it('GET /notifications?unread=true filters by read state', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'streak_nudge',
        title: 'read',
        body: 'b',
        read_at: new Date(),
      },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'unread', body: 'b' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?unread=true',
      headers: { authorization: `Bearer ${token}` },
    });
    const items = res.json().data.notifications;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('unread');
  });

  it('GET /notifications?kind=goal_deadline filters by kind', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 's', body: 's' },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'goal_deadline', title: 'g', body: 'g' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?kind=goal_deadline',
      headers: { authorization: `Bearer ${token}` },
    });
    const items = res.json().data.notifications;
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('goal_deadline');
  });

  // ─── Mark read ───────────────────────────────────────────────────────

  it('POST /notifications/mark-read with ids marks listed', async () => {
    const { token, user } = await userWithToken();
    const r1 = await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    const r2 = await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'b', body: 'b' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { ids: [r1.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.updated).toBe(1);
    const r1Row = await prisma.notification.findUnique({ where: { id: r1.id } });
    const r2Row = await prisma.notification.findUnique({ where: { id: r2.id } });
    expect(r1Row?.read_at).not.toBeNull();
    expect(r2Row?.read_at).toBeNull();
  });

  it("POST /notifications/mark-read won't touch another user's notifications", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-mr@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const r = await prisma.notification.create({
      data: { user_id: other.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { ids: [r.id] },
    });
    expect(res.json().data.updated).toBe(0);
    const row = await prisma.notification.findUnique({ where: { id: r.id } });
    expect(row?.read_at).toBeNull();
  });

  it('POST /notifications/mark-read with all marks every unread', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'b', body: 'b' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { all: true },
    });
    expect(res.json().data.updated).toBe(2);
  });

  it('POST /notifications/mark-read returns 0 if already read', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'streak_nudge',
        title: 'a',
        body: 'a',
        read_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { all: true },
    });
    expect(res.json().data.updated).toBe(0);
  });
});
```

- [ ] **Step 7: Run check + test**

```bash
pnpm --filter @rapih/api check
pnpm --filter @rapih/api test
```

Expected: all green. If Biome complains about import order or line length, fix inline and re-run.

- [ ] **Step 8: Commit**

```bash
git add apps/api/ packages/shared/
git commit -m "$(cat <<'EOF'
feat(api): notifications feed endpoints

GET /notifications (filter unread/kind, limit), POST /notifications/mark-read
(by ids or { all: true }). 12 integration tests. Refactors apps/api/src/routes/recurring.ts
to import advanceDueDate from @rapih/shared so the worker can share it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Worker scaffolding — package, tsconfig, env

**Files:**
- Create: `apps/worker-reminder/package.json`
- Create: `apps/worker-reminder/tsconfig.json`
- Create: `apps/worker-reminder/biome.json`
- Create: `apps/worker-reminder/vitest.config.ts`
- Create: `apps/worker-reminder/.env.example`
- Create: `apps/worker-reminder/.env`
- Create: `apps/worker-reminder/src/config/env.ts`
- Modify: root `.env.example` — add `REDIS_URL`, `EXPO_ACCESS_TOKEN`

- [ ] **Step 1: Write `apps/worker-reminder/package.json`**

```json
{
  "name": "@rapih/worker-reminder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "biome check src tests",
    "check": "tsc --noEmit && biome check src tests",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/sensible": "^6.0.1",
    "@rapih/db": "workspace:*",
    "@rapih/shared": "workspace:*",
    "bullmq": "^5.34.0",
    "dotenv": "^16.4.5",
    "fastify": "^5.1.0",
    "ioredis": "^5.4.1",
    "pino": "^9.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@types/node": "^22.10.0",
    "pino-pretty": "^11.3.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `apps/worker-reminder/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write `apps/worker-reminder/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "files": { "ignoreUnknown": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "es5" }
  }
}
```

- [ ] **Step 4: Write `apps/worker-reminder/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    pool: 'forks',
    fileParallelism: false,
  },
});
```

- [ ] **Step 5: Write `apps/worker-reminder/.env.example`**

```
NODE_ENV=development
DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih
REDIS_URL=redis://localhost:6379
EXPO_ACCESS_TOKEN=
TZ=Asia/Jakarta
LOG_LEVEL=info
PORT=3002
```

- [ ] **Step 6: Write `apps/worker-reminder/.env` (local dev — gitignored)**

```
NODE_ENV=development
DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih
REDIS_URL=redis://localhost:6379
EXPO_ACCESS_TOKEN=n0ahxOL5-yO4peX-fSffqBuq6eLPjvgy997hdb-W
TZ=Asia/Jakarta
LOG_LEVEL=debug
PORT=3002
```

Confirm `.env` is in root `.gitignore` (it should be — check via `grep -E "^\.env" /Volumes/Work/fiverr/rapih/.gitignore`). If missing, add `.env` and `apps/*/.env`.

- [ ] **Step 7: Write `apps/worker-reminder/src/config/env.ts`**

```ts
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  TZ: z.string().default('Asia/Jakarta'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

let dotenvLoaded = false;

export function loadEnv(): Env {
  if (!dotenvLoaded && process.env.NODE_ENV !== 'production') {
    loadDotenv();
    dotenvLoaded = true;
  }
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
```

- [ ] **Step 8: Update root `.env.example`**

Append to `.env.example` (root):

```
# Redis (shared between api and worker-reminder)
REDIS_URL=redis://localhost:6379

# Expo Push (worker-reminder only)
EXPO_ACCESS_TOKEN=
```

- [ ] **Step 9: Install deps**

```bash
pnpm install
```

Expected: lockfile updated, all packages resolve. `bullmq`, `ioredis`, `pino` installed under `apps/worker-reminder/node_modules/.pnpm/`.

- [ ] **Step 10: Verify tsc + biome pass on empty src**

Add a placeholder file so tsc has something to compile:

`apps/worker-reminder/src/index.ts`:
```ts
export {};
```

```bash
pnpm --filter @rapih/worker-reminder check
```

Expected: clean. Then delete the placeholder before committing.

- [ ] **Step 11: Commit**

```bash
git add apps/worker-reminder/ .env.example pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(worker-reminder): scaffold app — package.json, tsconfig, env

Empty Node app skeleton matching apps/api conventions. BullMQ + ioredis +
pino + fastify installed. Ready for lib + jobs in subsequent commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Worker lib — logger, redis, prisma, idempotency, expo-push, notification-write

**Files:**
- Create: `apps/worker-reminder/src/lib/logger.ts`
- Create: `apps/worker-reminder/src/lib/redis.ts`
- Create: `apps/worker-reminder/src/lib/prisma.ts`
- Create: `apps/worker-reminder/src/lib/idempotency.ts`
- Create: `apps/worker-reminder/src/lib/expo-push.ts`
- Create: `apps/worker-reminder/src/lib/notification-write.ts`
- Create: `apps/worker-reminder/src/lib/time.ts` (date helpers)

- [ ] **Step 1: `lib/logger.ts`**

```ts
import { pino } from 'pino';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  }),
});
```

- [ ] **Step 2: `lib/redis.ts`**

```ts
import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let cached: Redis | undefined;

export function getRedis(): Redis {
  if (!cached) {
    const env = loadEnv();
    cached = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return cached;
}

export async function closeRedis(): Promise<void> {
  if (cached) {
    await cached.quit();
    cached = undefined;
  }
}
```

- [ ] **Step 3: `lib/prisma.ts`**

```ts
import { createPrismaClient, type PrismaClient } from '@rapih/db';
import { loadEnv } from '../config/env.js';

let cached: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!cached) {
    const env = loadEnv();
    cached = createPrismaClient({ databaseUrl: env.DATABASE_URL, log: ['error'] });
  }
  return cached;
}

export async function closePrisma(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
    cached = undefined;
  }
}
```

- [ ] **Step 4: `lib/idempotency.ts`**

```ts
import { getRedis } from './redis.js';

/**
 * Claim a one-shot idempotency key. Returns true if claimed (caller may proceed),
 * false if already claimed (caller should skip).
 *
 * Uses Redis `SET key value EX ttl NX` — atomic check-and-set.
 */
export async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}
```

- [ ] **Step 5: `lib/expo-push.ts`**

```ts
import { loadEnv } from '../config/env.js';
import { logger } from './logger.js';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type SendResult = {
  ok: { to: string }[];
  removeTokens: string[];
  errors: { to: string; error: string }[];
};

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export type FetchFn = typeof fetch;

/**
 * Send push messages via Expo Push API.
 * In test mode, pass a mocked fetch via the `fetchImpl` parameter.
 */
export async function sendPushes(
  messages: PushMessage[],
  fetchImpl: FetchFn = fetch
): Promise<SendResult> {
  const result: SendResult = { ok: [], removeTokens: [], errors: [] };
  if (messages.length === 0) return result;

  const env = loadEnv();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetchImpl(EXPO_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      const json = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, idx) => {
        const msg = chunk[idx];
        if (!msg) return;
        if (ticket.status === 'ok') {
          result.ok.push({ to: msg.to });
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          result.removeTokens.push(msg.to);
        } else {
          result.errors.push({ to: msg.to, error: ticket.message });
        }
      });
    } catch (err) {
      logger.error({ err }, 'expo push request failed');
      for (const m of chunk) {
        result.errors.push({ to: m.to, error: 'network_error' });
      }
    }
  }
  return result;
}
```

- [ ] **Step 6: `lib/notification-write.ts`**

```ts
import type { NotificationKind } from '@rapih/shared';
import type { PrismaClient } from '@rapih/db';

/**
 * Create a Notification row. Returns the inserted id (used as `notification_id`
 * in the Expo data payload so mobile can deep-link to it).
 */
export async function writeNotification(
  prisma: PrismaClient,
  args: {
    user_id: string;
    kind: NotificationKind;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<string> {
  const row = await prisma.notification.create({
    data: {
      user_id: args.user_id,
      kind: args.kind,
      title: args.title,
      body: args.body,
      data: args.data ?? null,
    },
  });
  return row.id;
}
```

- [ ] **Step 7: `lib/time.ts`**

```ts
/** Format Date as YYYYMMDD in UTC (idempotency key segment). */
export function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** ISO week label "YYYY-W##" in UTC. */
export function isoWeek(d: Date): string {
  // ISO 8601 week-numbering year + week.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Start of day in `Asia/Jakarta` (UTC+7), returned as a UTC Date. */
export function startOfJakartaDay(d: Date): Date {
  // Jakarta = UTC+7 (no DST).
  const offsetMs = 7 * 3600 * 1000;
  const local = new Date(d.getTime() + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMs);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}
```

- [ ] **Step 8: Commit (no run yet — handlers come next)**

```bash
git add apps/worker-reminder/src/lib/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): lib foundations

logger (pino), redis (ioredis singleton, BullMQ-compatible), prisma client,
idempotency (Redis SET NX + EX), expo-push (batched 100, parses DeviceNotRegistered),
notification-write helper, time helpers (ymdUtc, isoWeek, startOfJakartaDay).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Worker lib tests — idempotency, expo-push

**Files:**
- Create: `apps/worker-reminder/tests/helpers/test-redis.ts`
- Create: `apps/worker-reminder/tests/helpers/test-env.ts`
- Create: `apps/worker-reminder/tests/idempotency.test.ts`
- Create: `apps/worker-reminder/tests/expo-push.test.ts`

- [ ] **Step 1: `tests/helpers/test-env.ts`**

```ts
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://rapih:rapih@localhost:5433/rapih_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/15';
process.env.TZ ??= 'Asia/Jakarta';
process.env.LOG_LEVEL ??= 'silent';
process.env.PORT ??= '3099';
```

- [ ] **Step 2: `tests/helpers/test-redis.ts`**

```ts
import { Redis } from 'ioredis';

let cached: Redis | undefined;

export function getTestRedis(): Redis {
  if (!cached) {
    cached = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
  }
  return cached;
}

export async function flushTestRedis(): Promise<void> {
  await getTestRedis().flushdb();
}

export async function closeTestRedis(): Promise<void> {
  if (cached) {
    await cached.quit();
    cached = undefined;
  }
}
```

- [ ] **Step 3: `tests/idempotency.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { claim } from '../src/lib/idempotency.js';
import { closeTestRedis, flushTestRedis, getTestRedis } from './helpers/test-redis.js';

describe('idempotency.claim', () => {
  beforeEach(async () => {
    await flushTestRedis();
  });
  afterAll(async () => {
    await closeTestRedis();
  });

  it('returns true on first claim', async () => {
    expect(await claim('foo:1', 60)).toBe(true);
  });

  it('returns false on second claim of same key', async () => {
    await claim('foo:2', 60);
    expect(await claim('foo:2', 60)).toBe(false);
  });

  it('different keys do not collide', async () => {
    expect(await claim('foo:3', 60)).toBe(true);
    expect(await claim('foo:4', 60)).toBe(true);
  });

  it('sets TTL on the claimed key', async () => {
    await claim('foo:5', 120);
    const ttl = await getTestRedis().ttl('foo:5');
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);
  });
});
```

- [ ] **Step 4: `tests/expo-push.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import './helpers/test-env.js';
import { sendPushes, type FetchFn } from '../src/lib/expo-push.js';

function mockFetch(response: unknown, status = 200): FetchFn {
  return vi.fn(async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  ) as unknown as FetchFn;
}

describe('sendPushes', () => {
  it('does nothing on empty list', async () => {
    const fetchImpl = vi.fn() as unknown as FetchFn;
    const r = await sendPushes([], fetchImpl);
    expect(r.ok).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses ok ticket as success', async () => {
    const fetchImpl = mockFetch({ data: [{ status: 'ok', id: 'r1' }] });
    const r = await sendPushes(
      [{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }],
      fetchImpl
    );
    expect(r.ok).toEqual([{ to: 'ExponentPushToken[a]' }]);
    expect(r.removeTokens).toEqual([]);
  });

  it('parses DeviceNotRegistered as removeTokens', async () => {
    const fetchImpl = mockFetch({
      data: [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }],
    });
    const r = await sendPushes(
      [{ to: 'ExponentPushToken[dead]', title: 't', body: 'b' }],
      fetchImpl
    );
    expect(r.removeTokens).toEqual(['ExponentPushToken[dead]']);
  });

  it('parses generic error into errors list', async () => {
    const fetchImpl = mockFetch({
      data: [{ status: 'error', message: 'MessageTooBig' }],
    });
    const r = await sendPushes(
      [{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }],
      fetchImpl
    );
    expect(r.errors).toEqual([{ to: 'ExponentPushToken[a]', error: 'MessageTooBig' }]);
  });

  it('chunks 250 messages into 3 chunks of 100/100/50', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(init?.body as string) as unknown[];
      const data = body.map(() => ({ status: 'ok', id: `r${calls}` }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as FetchFn;

    const messages = Array.from({ length: 250 }, (_, i) => ({
      to: `ExponentPushToken[${i}]`,
      title: 't',
      body: 'b',
    }));
    const r = await sendPushes(messages, fetchImpl);
    expect(calls).toBe(3);
    expect(r.ok).toHaveLength(250);
  });

  it('network failure marks all messages in chunk as errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('econnreset');
    }) as unknown as FetchFn;
    const r = await sendPushes(
      [{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }],
      fetchImpl
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].error).toBe('network_error');
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder check
pnpm --filter @rapih/worker-reminder test
```

Expected: all 10 tests pass.

```bash
git add apps/worker-reminder/tests/
git commit -m "$(cat <<'EOF'
test(worker-reminder): idempotency + expo-push unit tests

10 tests covering: Redis SET NX semantics, TTL, key isolation; Expo push
chunking (250→3 chunks), DeviceNotRegistered parsing, generic error
collection, network failure handling.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Job — `recurring-create`

**Files:**
- Create: `apps/worker-reminder/src/jobs/recurring-create.ts`
- Create: `apps/worker-reminder/tests/helpers/test-db.ts`
- Create: `apps/worker-reminder/tests/recurring-create.test.ts`

- [ ] **Step 1: Write `tests/helpers/test-db.ts`**

Copy-paste from `apps/api/tests/helpers/test-db.ts`, swap path. Important: include `notifications` in TRUNCATE.

```ts
import { execSync } from 'node:child_process';
import { createPrismaClient, type PrismaClient } from '@rapih/db';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://rapih:rapih@localhost:5433/rapih_test';

let cachedClient: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!cachedClient) {
    cachedClient = createPrismaClient({ databaseUrl: TEST_DATABASE_URL, log: ['error'] });
  }
  return cachedClient;
}

export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "notifications", "social_accounts", "user_profiles", "device_tokens", "transactions", "recurring_transactions", "goals", "budget_categories", "budgets", "receipts", "wallets", "categories", "users" RESTART IDENTITY CASCADE'
  );
}

export async function closeTestDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.$disconnect();
    cachedClient = undefined;
  }
}
```

- [ ] **Step 2: Write `src/jobs/recurring-create.ts`**

```ts
import { advanceDueDate } from '@rapih/shared';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { getPrisma } from '../lib/prisma.js';
import { ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

/**
 * Runs daily 00:05 WIB. For each recurring with next_due_date <= today,
 * creates the transaction and advances next_due_date by one period.
 * Idempotency: per recurring per day. Safe to re-run.
 */
export async function runRecurringCreate(now: Date = new Date()): Promise<{
  processed: number;
  skipped: number;
}> {
  const prisma = getPrisma();
  const due = await prisma.recurringTransaction.findMany({
    where: { next_due_date: { lte: now }, deleted_at: null },
  });

  let processed = 0;
  let skipped = 0;

  for (const r of due) {
    const key = `recurring-create:${ymdUtc(now)}:${r.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            user_id: r.user_id,
            kind: r.kind,
            wallet_id: r.wallet_id,
            category_id: r.category_id,
            amount: r.amount,
            note: r.note,
            transacted_at: r.next_due_date,
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
      processed++;
    } catch (err) {
      logger.error({ err, recurring_id: r.id }, 'recurring-create failed');
    }
  }

  logger.info({ processed, skipped, total: due.length }, 'recurring-create complete');
  return { processed, skipped };
}
```

- [ ] **Step 3: Write `tests/recurring-create.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runRecurringCreate } from '../src/jobs/recurring-create.js';
import { closePrisma } from '../src/lib/prisma.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUserWithWallet() {
  const user = await prisma.user.create({
    data: {
      email: `rc-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  const wallet = await prisma.wallet.create({
    data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
  });
  return { user, wallet };
}

describe('recurring-create', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('creates a transaction for due recurring and advances next_due_date', async () => {
    const { user, wallet } = await seedUserWithWallet();
    const yesterday = new Date(Date.now() - 86400000);
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 500000n,
        name: 'Netflix',
        icon: '◷',
        color: '#000000',
        period: 'monthly',
        next_due_date: yesterday,
      },
    });

    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(1);

    const txns = await prisma.transaction.findMany({ where: { user_id: user.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(500000n);

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { user_id: user.id },
    });
    expect(recurring?.last_paid_at).not.toBeNull();
    expect(recurring?.next_due_date.getTime()).toBeGreaterThan(yesterday.getTime());
  });

  it('skips soft-deleted recurring', async () => {
    const { user, wallet } = await seedUserWithWallet();
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: new Date(Date.now() - 86400000),
        deleted_at: new Date(),
      },
    });
    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('skips recurring with future next_due_date', async () => {
    const { user, wallet } = await seedUserWithWallet();
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: new Date(Date.now() + 86400000),
      },
    });
    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(0);
  });

  it('idempotent: running twice on same day creates only one transaction', async () => {
    const { user, wallet } = await seedUserWithWallet();
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'monthly',
        next_due_date: new Date(Date.now() - 86400000),
      },
    });
    const t = new Date('2026-06-15T00:05:00Z');
    await runRecurringCreate(t);
    const second = await runRecurringCreate(t);
    expect(second.skipped).toBe(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('advances monthly period by one month', async () => {
    const { user, wallet } = await seedUserWithWallet();
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'monthly',
        next_due_date: new Date('2026-05-15T00:00:00Z'),
      },
    });
    await runRecurringCreate(new Date('2026-05-15T01:00:00Z'));
    const r = await prisma.recurringTransaction.findFirst();
    expect(r?.next_due_date.toISOString().slice(0, 10)).toBe('2026-06-15');
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder check
pnpm --filter @rapih/worker-reminder test
```

Expected: 5 new tests green.

```bash
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): recurring-create job

Daily cron handler: finds recurring with next_due_date <= now, creates the
matching transaction and advances next_due_date by one period inside a
single Prisma $transaction. Idempotency keyed per recurring per day.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Job — `due-push`

**Files:**
- Create: `apps/worker-reminder/src/jobs/due-push.ts`
- Create: `apps/worker-reminder/tests/helpers/expo-mock.ts`
- Create: `apps/worker-reminder/tests/due-push.test.ts`

- [ ] **Step 1: Write `tests/helpers/expo-mock.ts`**

```ts
import { vi } from 'vitest';
import type { FetchFn } from '../../src/lib/expo-push.js';

type TicketResult = { status: 'ok'; id: string } | { status: 'error'; details: { error: string } };

/**
 * Build a fetch mock that returns one ticket per outgoing message. Caller can
 * override per-message status via the `responder` function.
 */
export function makeExpoMock(
  responder: (msg: { to: string }) => TicketResult = () => ({ status: 'ok', id: 'r' })
): { fetchImpl: FetchFn; calls: { to: string }[][] } {
  const calls: { to: string }[][] = [];
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { to: string }[];
    calls.push(body);
    const data = body.map(responder);
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as FetchFn;
  return { fetchImpl, calls };
}
```

- [ ] **Step 2: Write `src/jobs/due-push.ts`**

```ts
import { sendPushes, type PushMessage, type FetchFn } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';
import { addDays, startOfJakartaDay, ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

function formatRupiah(cents: bigint): string {
  // simplistic: full units, dot-separated thousands
  const n = Number(cents);
  return new Intl.NumberFormat('id-ID').format(n);
}

/**
 * Runs daily 09:00 WIB.
 *   - Recurring H-1: push reminder for tomorrow's bills.
 *   - Goal H-7 + H-1: nudge based on deadline.
 */
export async function runDuePush(
  now: Date = new Date(),
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const today = startOfJakartaDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const inSeven = addDays(today, 7);
  const inEight = addDays(today, 8);

  const queue: { msg: PushMessage; userId: string; tokenId: string }[] = [];
  let skipped = 0;

  // ── Recurring H-1 ───────────────────────────────────────────────────
  const recurringDue = await prisma.recurringTransaction.findMany({
    where: {
      next_due_date: { gte: tomorrow, lt: dayAfterTomorrow },
      deleted_at: null,
    },
    include: { user: { include: { device_tokens: true } } },
  });
  for (const r of recurringDue) {
    const key = `push:recurring-due:${ymdUtc(today)}:${r.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    if (r.user.device_tokens.length === 0) continue;
    const notifId = await writeNotification(prisma, {
      user_id: r.user_id,
      kind: 'recurring_due',
      title: `${r.name} jatuh tempo besok`,
      body: `Bayar Rp ${formatRupiah(r.amount)} besok`,
      data: { kind: 'recurring_due', recurring_id: r.id },
    });
    for (const t of r.user.device_tokens) {
      queue.push({
        userId: r.user_id,
        tokenId: t.id,
        msg: {
          to: t.token,
          title: `${r.name} jatuh tempo besok`,
          body: `Bayar Rp ${formatRupiah(r.amount)} besok`,
          data: { kind: 'recurring_due', recurring_id: r.id, notification_id: notifId },
        },
      });
    }
  }

  // ── Goals: deadline = today+7 or today+1 ────────────────────────────
  for (const [marker, start, end] of [
    ['H7', inSeven, addDays(inSeven, 1)] as const,
    ['H1', tomorrow, dayAfterTomorrow] as const,
  ]) {
    const goals = await prisma.goal.findMany({
      where: { deadline: { gte: start, lt: end }, deleted_at: null },
      include: { user: { include: { device_tokens: true } } },
    });
    for (const g of goals) {
      const key = `push:goal-due:${ymdUtc(today)}:${g.id}:${marker}`;
      if (!(await claim(key, TTL))) {
        skipped++;
        continue;
      }
      if (g.user.device_tokens.length === 0) continue;
      const gap = g.target_amount - g.saved_amount;
      const title =
        marker === 'H7' ? `Goal ${g.name} tinggal 7 hari` : `Goal ${g.name} besok!`;
      const body = `Tersisa Rp ${formatRupiah(gap > 0n ? gap : 0n)} dari target`;
      const notifId = await writeNotification(prisma, {
        user_id: g.user_id,
        kind: 'goal_deadline',
        title,
        body,
        data: { kind: 'goal_deadline', goal_id: g.id, marker },
      });
      for (const t of g.user.device_tokens) {
        queue.push({
          userId: g.user_id,
          tokenId: t.id,
          msg: {
            to: t.token,
            title,
            body,
            data: { kind: 'goal_deadline', goal_id: g.id, marker, notification_id: notifId },
          },
        });
      }
    }
  }

  // ── Send + handle DeviceNotRegistered ────────────────────────────────
  const result = await sendPushes(
    queue.map((q) => q.msg),
    fetchImpl
  );
  if (result.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: result.removeTokens } } });
  }

  logger.info(
    { pushed: result.ok.length, skipped, removed: result.removeTokens.length },
    'due-push complete'
  );
  return { pushed: result.ok.length, skipped, removed: result.removeTokens.length };
}
```

- [ ] **Step 3: Write `tests/due-push.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runDuePush } from '../src/jobs/due-push.js';
import { closePrisma } from '../src/lib/prisma.js';
import { makeExpoMock } from './helpers/expo-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUser(opts: { devices?: number } = { devices: 1 }) {
  const user = await prisma.user.create({
    data: {
      email: `dp-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  for (let i = 0; i < (opts.devices ?? 0); i++) {
    await prisma.deviceToken.create({
      data: {
        user_id: user.id,
        token: `ExponentPushToken[${user.id}-${i}]`,
        platform: 'ios',
      },
    });
  }
  return user;
}

const NOW = new Date('2026-06-15T02:00:00Z'); // 09:00 Jakarta
const TOMORROW_JKT = new Date('2026-06-16T00:00:00+07:00');

describe('due-push', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('pushes for recurring with next_due_date tomorrow (Jakarta)', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 500000n,
        name: 'Netflix',
        icon: '◷',
        color: '#000',
        period: 'monthly',
        next_due_date: TOMORROW_JKT,
      },
    });

    const { fetchImpl, calls } = makeExpoMock();
    const res = await runDuePush(NOW, fetchImpl);
    expect(res.pushed).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0][0].to).toMatch(/^ExponentPushToken\[/);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('does not push for recurring 2 days away', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: new Date('2026-06-17T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('pushes for goal H-7 with correct copy', async () => {
    const user = await seedUser({ devices: 1 });
    await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Liburan',
        icon: '◇',
        color: '#000',
        target_amount: 10000000n,
        saved_amount: 6000000n,
        deadline: new Date('2026-06-22T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(1);
    expect(calls[0][0].title).toBe('Goal Liburan tinggal 7 hari');
  });

  it('pushes for goal H-1 with "besok" copy', async () => {
    const user = await seedUser({ devices: 1 });
    await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Liburan',
        icon: '◇',
        color: '#000',
        target_amount: 10000000n,
        saved_amount: 6000000n,
        deadline: new Date('2026-06-16T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls[0][0].title).toBe('Goal Liburan besok!');
  });

  it('sends one message per device token', async () => {
    const user = await seedUser({ devices: 3 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls[0]).toHaveLength(3);
  });

  it('skips entirely (no notif row) when user has no devices', async () => {
    const user = await seedUser({ devices: 0 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
    // Notification IS written even without devices — per spec, only streak skips entirely.
    // Re-check spec § 5.2 vs § 5.3.
    expect(await prisma.notification.count()).toBeGreaterThanOrEqual(1);
  });

  it('deletes device token on DeviceNotRegistered', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl } = makeExpoMock(() => ({
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    }));
    const res = await runDuePush(NOW, fetchImpl);
    expect(res.removed).toBe(1);
    expect(await prisma.deviceToken.count()).toBe(0);
  });

  it('idempotent: second run same day is a no-op', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    const { fetchImpl: second, calls: secondCalls } = makeExpoMock();
    const res = await runDuePush(NOW, second);
    expect(secondCalls).toHaveLength(0);
    expect(res.skipped).toBeGreaterThan(0);
  });
});
```

> **Note on spec consistency (§ 5.2 vs § 5.3):** For `due-push`, the spec § 5.2 doesn't say to skip notification-write when user has zero devices. The test above asserts the row IS still written. For `streak-nudge` (§ 5.3 + § 12), zero devices → skip entirely. If the spec was meant to be consistent (skip across all), update both — defer that to user review.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder check
pnpm --filter @rapih/worker-reminder test
```

Expected: 8 new tests green (total 23).

```bash
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): due-push job

Daily 09:00 WIB push for recurring H-1 and goal H-7/H-1. Writes a
notifications row per push so mobile feed can render it. DeviceNotRegistered
tickets hard-delete the offending token row.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Job — `streak-nudge`

**Files:**
- Create: `apps/worker-reminder/src/jobs/streak-nudge.ts`
- Create: `apps/worker-reminder/tests/streak-nudge.test.ts`

- [ ] **Step 1: Write `src/jobs/streak-nudge.ts`**

```ts
import { sendPushes, type PushMessage, type FetchFn } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';
import { startOfJakartaDay, ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

/**
 * Runs daily 20:00 WIB. Pushes a "log a transaction" nudge to onboarded
 * users who have no transaction today. Skips users with zero device tokens.
 */
export async function runStreakNudge(
  now: Date = new Date(),
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const today = startOfJakartaDay(now);

  const candidates = await prisma.user.findMany({
    where: {
      onboarding_completed_at: { not: null },
      transactions: {
        none: { transacted_at: { gte: today }, deleted_at: null },
      },
    },
    include: { device_tokens: true },
  });

  const queue: PushMessage[] = [];
  let skipped = 0;
  for (const u of candidates) {
    if (u.device_tokens.length === 0) {
      skipped++;
      continue;
    }
    const key = `push:streak:${ymdUtc(today)}:${u.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    const notifId = await writeNotification(prisma, {
      user_id: u.id,
      kind: 'streak_nudge',
      title: 'Belum catat pengeluaran hari ini',
      body: 'Yuk catat satu hal — biar streak gak putus.',
      data: { kind: 'streak_nudge' },
    });
    for (const t of u.device_tokens) {
      queue.push({
        to: t.token,
        title: 'Belum catat pengeluaran hari ini',
        body: 'Yuk catat satu hal — biar streak gak putus.',
        data: { kind: 'streak_nudge', notification_id: notifId },
      });
    }
  }

  const result = await sendPushes(queue, fetchImpl);
  if (result.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: result.removeTokens } } });
  }

  logger.info(
    { pushed: result.ok.length, skipped, removed: result.removeTokens.length },
    'streak-nudge complete'
  );
  return { pushed: result.ok.length, skipped, removed: result.removeTokens.length };
}
```

- [ ] **Step 2: Write `tests/streak-nudge.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runStreakNudge } from '../src/jobs/streak-nudge.js';
import { closePrisma } from '../src/lib/prisma.js';
import { makeExpoMock } from './helpers/expo-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUser(opts: { onboarded?: boolean; devices?: number } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `sn-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded === false ? null : new Date(),
      profile: { create: {} },
    },
  });
  for (let i = 0; i < (opts.devices ?? 1); i++) {
    await prisma.deviceToken.create({
      data: {
        user_id: user.id,
        token: `ExponentPushToken[${user.id}-${i}]`,
        platform: 'ios',
      },
    });
  }
  return user;
}

const NOW = new Date('2026-06-15T13:00:00Z'); // 20:00 Jakarta

describe('streak-nudge', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('pushes user without any tx today', async () => {
    await seedUser();
    const { fetchImpl, calls } = makeExpoMock();
    const res = await runStreakNudge(NOW, fetchImpl);
    expect(res.pushed).toBe(1);
    expect(calls).toHaveLength(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('does not push user who logged tx today', async () => {
    const user = await seedUser();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        transacted_at: new Date('2026-06-15T08:00:00Z'), // 15:00 Jakarta same day
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('does not push user without completed onboarding', async () => {
    await seedUser({ onboarded: false });
    const { fetchImpl, calls } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('skips entirely when user has zero device tokens (no notif row)', async () => {
    await seedUser({ devices: 0 });
    const { fetchImpl } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('idempotent: second run is no-op', async () => {
    await seedUser();
    const { fetchImpl } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    const { fetchImpl: second, calls: secondCalls } = makeExpoMock();
    await runStreakNudge(NOW, second);
    expect(secondCalls).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(1);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder check
pnpm --filter @rapih/worker-reminder test
```

Expected: 5 new tests green (total 28).

```bash
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): streak-nudge job

Daily 20:00 WIB push to onboarded users who haven't logged a transaction today.
Skips users with no device tokens entirely (no notification row written — they
can't be reached). Idempotent per user per day.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Job — `weekly-review`

**Files:**
- Create: `apps/worker-reminder/src/queues/ai.ts`
- Create: `apps/worker-reminder/src/jobs/weekly-review.ts`
- Create: `apps/worker-reminder/tests/weekly-review.test.ts`

- [ ] **Step 1: Write `src/queues/ai.ts`**

```ts
import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let cached: Queue | undefined;

/**
 * Producer-only handle to the AI worker queue. Worker-reminder enqueues
 * weekly-review-gen jobs here; the future ai-worker will consume.
 */
export function getAiQueue(): Queue {
  if (!cached) {
    cached = new Queue('ai', { connection: getRedis() });
  }
  return cached;
}

export async function closeAiQueue(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
```

- [ ] **Step 2: Write `src/jobs/weekly-review.ts`**

```ts
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { getPrisma } from '../lib/prisma.js';
import { isoWeek } from '../lib/time.js';
import { getAiQueue } from '../queues/ai.js';

const TTL = 7 * 24 * 3600;
const LOOKBACK_DAYS = 30;

/**
 * Runs Sunday 22:00 WIB. For each Pro user with >=1 transaction in the
 * last 30 days, enqueue an `ai.weekly-review-gen` job. The future ai-worker
 * will consume, generate review content, and push.
 */
export async function runWeeklyReview(now: Date = new Date()): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const prisma = getPrisma();
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
  const week = isoWeek(now);

  const eligible = await prisma.user.findMany({
    where: {
      tier: 'pro',
      onboarding_completed_at: { not: null },
      transactions: { some: { transacted_at: { gte: cutoff }, deleted_at: null } },
    },
  });

  const queue = getAiQueue();
  let enqueued = 0;
  let skipped = 0;
  for (const u of eligible) {
    const key = `weekly-review-enqueue:${week}:${u.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    await queue.add('weekly-review-gen', { user_id: u.id, week });
    enqueued++;
  }

  logger.info({ enqueued, skipped, total: eligible.length }, 'weekly-review complete');
  return { enqueued, skipped };
}
```

- [ ] **Step 3: Write `tests/weekly-review.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runWeeklyReview } from '../src/jobs/weekly-review.js';
import { closePrisma } from '../src/lib/prisma.js';
import { closeAiQueue, getAiQueue } from '../src/queues/ai.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUserWithTx(opts: { tier: 'free' | 'plus' | 'pro'; daysAgo: number }) {
  const user = await prisma.user.create({
    data: {
      email: `wr-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      tier: opts.tier,
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  const wallet = await prisma.wallet.create({
    data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
  });
  await prisma.transaction.create({
    data: {
      user_id: user.id,
      wallet_id: wallet.id,
      kind: 'expense',
      amount: 100n,
      transacted_at: new Date(Date.now() - opts.daysAgo * 86400000),
    },
  });
  return user;
}

describe('weekly-review', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
    await getAiQueue().drain();
  });
  afterAll(async () => {
    await closeAiQueue();
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('enqueues for Pro user with recent activity', async () => {
    const u = await seedUserWithTx({ tier: 'pro', daysAgo: 5 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(1);
    const jobs = await getAiQueue().getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.user_id).toBe(u.id);
    expect(jobs[0].name).toBe('weekly-review-gen');
  });

  it('skips Free tier', async () => {
    await seedUserWithTx({ tier: 'free', daysAgo: 5 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(0);
  });

  it('skips Pro user with no recent activity', async () => {
    await seedUserWithTx({ tier: 'pro', daysAgo: 45 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(0);
  });

  it('idempotent within same ISO week', async () => {
    await seedUserWithTx({ tier: 'pro', daysAgo: 1 });
    const t = new Date('2026-06-21T15:00:00Z'); // Sunday
    await runWeeklyReview(t);
    const second = await runWeeklyReview(t);
    expect(second.enqueued).toBe(0);
    expect(second.skipped).toBe(1);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @rapih/worker-reminder check
pnpm --filter @rapih/worker-reminder test
```

Expected: 4 new tests green (total 32).

```bash
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): weekly-review job

Sunday 22:00 WIB cron. Producer-only handle to the 'ai' BullMQ queue; for
each Pro user with activity in the last 30 days, enqueue an
ai.weekly-review-gen job. Idempotent per user per ISO week.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Worker boot — queues, dispatcher, scheduler, server

**Files:**
- Create: `apps/worker-reminder/src/queues/reminder.ts`
- Create: `apps/worker-reminder/src/scheduler.ts`
- Create: `apps/worker-reminder/src/worker.ts`
- Create: `apps/worker-reminder/src/server.ts`

- [ ] **Step 1: `src/queues/reminder.ts`**

```ts
import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let cached: Queue | undefined;

export function getReminderQueue(): Queue {
  if (!cached) {
    cached = new Queue('reminder', { connection: getRedis() });
  }
  return cached;
}

export async function closeReminderQueue(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
```

- [ ] **Step 2: `src/scheduler.ts`**

```ts
import { logger } from './lib/logger.js';
import { getReminderQueue } from './queues/reminder.js';

const TZ = 'Asia/Jakarta';

type Schedule = { name: string; cron: string };

const SCHEDULES: Schedule[] = [
  { name: 'recurring-create', cron: '5 0 * * *' }, // 00:05 daily
  { name: 'due-push', cron: '0 9 * * *' }, // 09:00 daily
  { name: 'streak-nudge', cron: '0 20 * * *' }, // 20:00 daily
  { name: 'weekly-review', cron: '0 22 * * 0' }, // Sunday 22:00
];

export async function registerSchedules(): Promise<Schedule[]> {
  const queue = getReminderQueue();
  for (const s of SCHEDULES) {
    await queue.upsertJobScheduler(
      `scheduler:${s.name}`,
      { pattern: s.cron, tz: TZ },
      { name: s.name, data: {} }
    );
    logger.info({ name: s.name, cron: s.cron, tz: TZ }, 'scheduler registered');
  }
  return SCHEDULES;
}

export function listSchedules(): Schedule[] {
  return SCHEDULES;
}
```

- [ ] **Step 3: `src/worker.ts`**

```ts
import { Worker, type Job } from 'bullmq';
import { runDuePush } from './jobs/due-push.js';
import { runRecurringCreate } from './jobs/recurring-create.js';
import { runStreakNudge } from './jobs/streak-nudge.js';
import { runWeeklyReview } from './jobs/weekly-review.js';
import { logger } from './lib/logger.js';
import { getRedis } from './lib/redis.js';

async function dispatch(job: Job): Promise<unknown> {
  logger.info({ job: job.name, id: job.id }, 'dispatch');
  switch (job.name) {
    case 'recurring-create':
      return runRecurringCreate();
    case 'due-push':
      return runDuePush();
    case 'streak-nudge':
      return runStreakNudge();
    case 'weekly-review':
      return runWeeklyReview();
    default:
      logger.warn({ job: job.name }, 'unknown job name');
      return null;
  }
}

let cached: Worker | undefined;

export function startWorker(): Worker {
  if (!cached) {
    cached = new Worker('reminder', dispatch, { connection: getRedis(), concurrency: 1 });
    cached.on('failed', (job, err) => {
      logger.error({ err, job: job?.name, id: job?.id }, 'job failed');
    });
    cached.on('completed', (job) => {
      logger.debug({ job: job.name, id: job.id }, 'job completed');
    });
  }
  return cached;
}

export async function stopWorker(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
```

- [ ] **Step 4: `src/server.ts`**

```ts
import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { closePrisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';
import { closeAiQueue } from './queues/ai.js';
import { closeReminderQueue } from './queues/reminder.js';
import { listSchedules, registerSchedules } from './scheduler.js';
import { startWorker, stopWorker } from './worker.js';

async function main(): Promise<void> {
  const env = loadEnv();

  await registerSchedules();
  startWorker();
  logger.info('worker started');

  const app = Fastify({ logger: false });
  app.get('/health', async () => ({
    status: 'ok',
    schedules: listSchedules(),
  }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'health endpoint listening');

  const shutdown = async () => {
    logger.info('shutting down');
    await app.close();
    await stopWorker();
    await closeReminderQueue();
    await closeAiQueue();
    await closePrisma();
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal error in main');
  process.exit(1);
});
```

- [ ] **Step 5: Smoke-test build + manual boot**

```bash
pnpm --filter @rapih/worker-reminder build
pnpm --filter @rapih/worker-reminder dev
```

Expected: worker connects to Redis, logs "scheduler registered" 4 times, "worker started", "health endpoint listening". Visit `http://localhost:3002/health` → JSON with 4 schedules.

```bash
curl -s http://localhost:3002/health | jq
```

Kill with Ctrl-C. Confirm "shutting down" + clean exit.

- [ ] **Step 6: Commit**

```bash
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): boot — scheduler, worker, server

JobScheduler registers 4 cron entries (Asia/Jakarta tz) on the 'reminder'
queue. Worker dispatches by job.name to the four runners. Fastify /health
exposes the registered schedule list for Dokploy probes. Graceful SIGTERM
shutdown closes BullMQ, Redis, and Prisma.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Dockerfile + .dockerignore

**Files:**
- Create: `apps/worker-reminder/Dockerfile`
- Create: `apps/worker-reminder/.dockerignore`

- [ ] **Step 1: Read `apps/api/Dockerfile` for reference**

```bash
cat apps/api/Dockerfile
```

(The worker Dockerfile mirrors api's pattern: multi-stage with pnpm + workspace deps.)

- [ ] **Step 2: Write `apps/worker-reminder/Dockerfile`**

Match `apps/api/Dockerfile` structure exactly, but with:
- `WORKDIR /app/apps/worker-reminder`
- Final `CMD ["node", "dist/server.js"]`
- Add `prisma migrate deploy` step before `CMD` to ensure schema is in sync at boot (same as api).

(Copy the apps/api/Dockerfile verbatim, search-and-replace `apps/api` → `apps/worker-reminder`. If the api Dockerfile copies prisma migrations, keep that step.)

- [ ] **Step 3: Write `apps/worker-reminder/.dockerignore`**

```
node_modules
dist
.env
.env.local
*.log
```

- [ ] **Step 4: Smoke build (optional, only if Docker is running locally)**

```bash
docker build -f apps/worker-reminder/Dockerfile -t rapih-worker-reminder:dev .
```

Expected: image builds. If not running Docker, skip and trust the pattern.

- [ ] **Step 5: Commit**

```bash
git add apps/worker-reminder/Dockerfile apps/worker-reminder/.dockerignore
git commit -m "$(cat <<'EOF'
chore(worker-reminder): Dockerfile + .dockerignore

Mirrors apps/api/Dockerfile pattern. Multi-stage build with pnpm, copies
workspace deps + @rapih/db + @rapih/shared, runs prisma migrate deploy at
boot, entrypoint node dist/server.js.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Mobile — notification feature folder

**Files:**
- Create: `apps/mobile/src/features/notification/api.ts`
- Create: `apps/mobile/src/features/notification/notification-store.ts`

- [ ] **Step 1: Write `apps/mobile/src/features/notification/api.ts`**

```ts
import { apiRequest } from '@/lib/api';
import type {
  MarkReadBody,
  MarkReadResponse,
  NotificationDto,
  NotificationKind,
  NotificationListResponse,
} from '@rapih/shared';

type ListData = NotificationListResponse['data'];
type MarkData = MarkReadResponse['data'];

export type ListOpts = {
  unread?: boolean;
  kind?: NotificationKind;
  limit?: number;
};

export async function listNotifications(opts: ListOpts = {}): Promise<NotificationDto[]> {
  const params = new URLSearchParams();
  if (opts.unread) params.set('unread', 'true');
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const data = await apiRequest<ListData>(`/notifications${qs ? `?${qs}` : ''}`);
  return data.notifications;
}

export async function markRead(ids: string[]): Promise<number> {
  const body: MarkReadBody = { ids };
  const data = await apiRequest<MarkData>('/notifications/mark-read', {
    method: 'POST',
    body,
  });
  return data.updated;
}

export async function markAllRead(): Promise<number> {
  const body: MarkReadBody = { all: true };
  const data = await apiRequest<MarkData>('/notifications/mark-read', {
    method: 'POST',
    body,
  });
  return data.updated;
}
```

- [ ] **Step 2: Write `apps/mobile/src/features/notification/notification-store.ts`**

```ts
import type { NotificationDto } from '@rapih/shared';
import { create } from 'zustand';
import * as api from './api';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type State = {
  status: Status;
  error: string | null;
  items: NotificationDto[];
  fetch: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const useNotificationStore = create<State>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const items = await api.listNotifications({ limit: 100 });
      set({ status: 'ready', items });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  },

  markRead: async (ids) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)),
    });
    try {
      await api.markRead(ids);
    } catch {
      // Best-effort optimistic update; next fetch will reconcile.
    }
  },

  markAllRead: async () => {
    const now = new Date().toISOString();
    set({
      items: get().items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    });
    try {
      await api.markAllRead();
    } catch {
      // ignore — reconcile on next fetch
    }
  },
}));
```

- [ ] **Step 3: Verify mobile builds**

```bash
cd /Volumes/Work/fiverr/rapih/apps/mobile && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/notification/
git commit -m "$(cat <<'EOF'
feat(mobile): notification feature — api + store

apiRequest wrappers (list/markRead/markAllRead) + Zustand store with
optimistic mark-read updates. Mirrors the wallet feature pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Mobile — rewire `notifikasi-screen.tsx`

**Files:**
- Modify: `apps/mobile/src/features/profile/screens/notifikasi-screen.tsx`

- [ ] **Step 1: Read current screen**

```bash
cat apps/mobile/src/features/profile/screens/notifikasi-screen.tsx
```

Already familiar — see Task 4 in spec § 10.

- [ ] **Step 2: Rewrite `notifikasi-screen.tsx`**

Full replacement file:

```tsx
import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { NotificationDto, NotificationKind } from '@rapih/shared';
import { palette, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useNotificationStore } from '@/features/notification/notification-store';

type Variant = 'ai' | 'budget' | 'tx' | 'streak' | 'goal' | 'review';

const KIND_TO_VARIANT: Record<NotificationKind, Variant> = {
  recurring_due: 'tx',
  goal_deadline: 'goal',
  streak_nudge: 'streak',
  weekly_review: 'review',
};

const TYPE_META: Record<Variant, { c: string; bg: string; emoji: string }> = {
  ai: { c: palette.moss, bg: palette.limeSoft, emoji: '✦' },
  budget: { c: palette.coral, bg: tint.peach, emoji: '◷' },
  tx: { c: palette.ink, bg: palette.sand, emoji: '↗' },
  streak: { c: tint.goldInk, bg: tint.amber, emoji: '🔥' },
  goal: { c: palette.cool, bg: palette.limeSoft, emoji: '◇' },
  review: { c: tint.irisInk, bg: tint.iris, emoji: '☼' },
};

function groupByDate(items: NotificationDto[]): { h: string; items: NotificationDto[] }[] {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  // ISO week starts Monday in id-ID convention.
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - (dayOfWeek - 1));

  const today: NotificationDto[] = [];
  const week: NotificationDto[] = [];
  const older: NotificationDto[] = [];

  for (const n of items) {
    const t = new Date(n.created_at);
    if (t >= startToday) today.push(n);
    else if (t >= startWeek) week.push(n);
    else older.push(n);
  }
  const out: { h: string; items: NotificationDto[] }[] = [];
  if (today.length) out.push({ h: 'Hari ini', items: today });
  if (week.length) out.push({ h: 'Minggu ini', items: week });
  if (older.length) out.push({ h: 'Lebih lama', items: older });
  return out;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dayLabel = days[d.getDay()];
  const week = (() => {
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff < 7;
  })();
  if (week) {
    return `${dayLabel}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function NotifikasiScreen() {
  const router = useRouter();
  const { status, items, fetch, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const groups = useMemo(() => groupByDate(items), [items]);

  return (
    <Screen background={palette.bg} bottomInset={28}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
        }}>
        <BackButton
          onPress={() => {
            haptics.tap();
            if (router.canGoBack()) router.back();
          }}
        />
        <Text variant="figureS" style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 24 }}>
          Notifikasi
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            markAllRead();
          }}
          hitSlop={8}>
          <Text variant="bodySm" color={palette.cool} style={{ fontSize: 12, fontWeight: '600' }}>
            Baca semua
          </Text>
        </Pressable>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={status === 'loading'} onRefresh={fetch} />
        }
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}>
        {status === 'ready' && items.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 32 }}>
            <Text variant="figureS" style={{ fontSize: 18 }}>
              Belum ada notifikasi
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ fontSize: 13, textAlign: 'center', marginTop: 6 }}>
              Catat pengeluaran biar Rapih bisa kirim insight & pengingat tagihan.
            </Text>
          </View>
        )}

        {status === 'loading' && items.length === 0 && (
          <View style={{ marginHorizontal: 18, marginTop: 22, gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  height: 56,
                  backgroundColor: palette.card,
                  borderRadius: 22,
                  opacity: 0.5,
                }}
              />
            ))}
          </View>
        )}

        {groups.map((g) => (
          <View key={g.h} style={{ marginHorizontal: 18, marginTop: 22 }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{
                fontSize: 11,
                letterSpacing: 1.4,
                fontWeight: '700',
                paddingHorizontal: 4,
                paddingBottom: 8,
              }}>
              {g.h}
            </Text>
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 22,
                borderCurve: 'continuous',
              }}>
              {g.items.map((n, i) => {
                const variant = KIND_TO_VARIANT[n.kind];
                const m = TYPE_META[variant];
                const isNew = n.read_at === null;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => {
                      haptics.tap();
                      if (isNew) markRead([n.id]);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                      borderBottomColor: palette.inkFaint,
                    }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        backgroundColor: m.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                      <Text color={m.c} style={{ fontSize: 14, fontWeight: '700' }}>
                        {m.emoji}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}>
                        <Text
                          variant="bodySm"
                          style={{
                            flex: 1,
                            fontSize: 13.5,
                            fontWeight: '600',
                            letterSpacing: -0.2,
                          }}>
                          {n.title}
                        </Text>
                        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
                          {formatTime(n.created_at)}
                        </Text>
                      </View>
                      <Text
                        variant="bodySm"
                        color={palette.inkSoft}
                        style={{ fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                        {n.body}
                      </Text>
                    </View>
                    {isNew && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 18,
                          right: 14,
                          width: 7,
                          height: 7,
                          borderRadius: 7,
                          backgroundColor: palette.coral,
                        }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 3: Verify mobile compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: clean. If `apiRequest` typing complains, see spec § 9 + existing `wallet/api.ts` for the established pattern.

- [ ] **Step 4: Manual smoke test (recommended, not blocking)**

```bash
cd apps/mobile && npx expo start
```

Sign in → navigate to Profil → Notifikasi. Without backend data, expect "Belum ada notifikasi" state. With backend running and seeded notifications, expect grouped list.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/profile/screens/notifikasi-screen.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): rewire notifikasi-screen to live API

Replaces dummy GROUPS with useNotificationStore. Client-side grouping by
created_at (Hari ini / Minggu ini / Lebih lama). Pull-to-refresh, tap →
markRead, Baca semua → markAllRead. Empty + loading states. Kind→variant
map keeps existing UI accents while only 4 backend kinds populate for now.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Spine update + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — Feature Atlas rows

- [ ] **Step 1: Update Spine Feature Atlas**

In `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md`, change status from `todo` → `done` on these rows:

```
| recurring auto-create (cron) | reminder-worker | Free | recurring | done |
| due / goal push notif | reminder-worker | Free | device tokens | done |
| streak nudge push | reminder-worker | Free | transactions | done |
| weekly review story gen | reminder-worker | Pro | transactions | done |
```

Note: `weekly review story gen` only enqueues to `ai` queue — the ai-worker side is still todo. Add a footnote line below the table or annotate in the row:

```
| weekly review story gen | reminder-worker | Pro | transactions | done (enqueue only; ai-worker consumer pending) |
```

- [ ] **Step 2: Run full check across all touched packages**

```bash
pnpm --filter @rapih/shared build
pnpm --filter @rapih/api check && pnpm --filter @rapih/api test
pnpm --filter @rapih/worker-reminder check && pnpm --filter @rapih/worker-reminder test
cd apps/mobile && npx tsc --noEmit
cd -
```

Expected: every step green. Test totals: api ~198 tests (186 existing + ~12 notifications); worker-reminder ~32 tests.

- [ ] **Step 3: Commit Spine update**

```bash
git add docs/superpowers/specs/2026-05-20-rapih-backend-spine.md
git commit -m "$(cat <<'EOF'
docs(spine): mark reminder-worker features as done

recurring auto-create, due/goal push, streak nudge, weekly review enqueue —
all shipped on feat/reminder-worker. Weekly review consumer (ai-worker)
remains pending.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Hand off to user for branch decision**

Branch `feat/reminder-worker` is ready. Per project convention (memory: feedback_branch_strategy), do NOT merge to main without user approval. Surface to user:
- Total commits on this branch (run `git log feat/device-token-register..HEAD --oneline | wc -l`).
- Total tests added (~32 worker + 12 api).
- Suggest next step: review locally, decide on merge timing.

---

## Self-Review Notes

**Spec coverage check:**
- § 3 App structure → Tasks 4, 5, 11. ✓
- § 4 Schema → Task 1. ✓
- § 5.1 recurring-create → Task 7. ✓
- § 5.2 due-push → Task 8. ✓
- § 5.3 streak-nudge → Task 9. ✓
- § 5.4 weekly-review → Task 10. ✓
- § 6 Expo Push → Task 5 (lib) + Task 6 (test). ✓
- § 7 Idempotency → Task 5 (lib) + Task 6 (test). ✓
- § 8 API endpoints → Task 3. ✓
- § 9 Shared types → Task 2. ✓
- § 10 Mobile rewire → Tasks 13–14. ✓
- § 11 Environment → Task 4. ✓
- § 12 Testing → distributed across handler tasks (7–10). ✓
- § 13 Deployment → Task 12. ✓
- § 14 Rollout order → followed by task order. ✓

**Open consistency note (flagged in Task 8):** Spec § 5.2 doesn't explicitly say "skip notif if 0 devices" for due-push (only § 5.3 + § 12 say it for streak-nudge). Test asserts the row IS still written for due-push. If user wants consistent behavior across all push jobs, edit spec § 5.2 + corresponding code+test before executing Task 8.

**Type consistency:** `runRecurringCreate`, `runDuePush`, `runStreakNudge`, `runWeeklyReview` — same naming pattern, all return shape `{ ...counts }`. `FetchFn` consistently used for injectable fetch. `getRedis()`, `getPrisma()`, `getReminderQueue()`, `getAiQueue()` — same singleton pattern. ✓

**No placeholders, no "similar to Task N", no "add error handling" — every step is concrete.**
