# worker-ai (Chunk B — Scan-struk OCR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Chunk B of `ai-worker`: receipt OCR end-to-end. User snaps/picks/shares an image → API issues presigned R2 PUT → client uploads → API enqueues `ai.ocr-receipt` → worker-ai calls gpt-4o-mini vision → parses JSON → enqueues a push job on `reminder` queue → user gets "Struk siap direview" notif → reviews + saves N transactions atomically with mobile-side tax/fee allocation.

**Architecture:** New `ReceiptScan` table tracking pending → processing → ready → consumed|failed. Object storage on Cloudflare R2 with presigned upload + presigned read. `worker-ai` gains an `ai.ocr-receipt` handler (image → OpenAI vision → DB update + AiUsageLog + push job enqueue). `worker-reminder` gains two new push handlers (`receipts.ready-push`, `receipts.failed-push`) — single push pipeline. Mobile gets a `receipt` feature folder with camera/gallery picker, share intent (EAS Dev Build), list/review screens, and live tax/fee allocation preview.

**Tech Stack:** Node 22 / TypeScript / Fastify / BullMQ / Prisma 6 / `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` / OpenAI SDK v4.x / Pino / Vitest. Mobile: Expo SDK 55 + Zustand + `expo-image-picker` + `expo-share-intent`.

**Spec:** `docs/superpowers/specs/2026-05-28-worker-ai-scan-struk-design.md` — reference for prompts, output schemas, R2 contracts, UX details.

**Branch:** Create `feat/worker-ai-scan-struk` from `main` AFTER Chunk A (`feat/worker-ai-tanya`) is merged. Until then, plan execution is blocked.

```bash
git checkout main
git pull --ff-only
git checkout -b feat/worker-ai-scan-struk
```

Do not merge this branch without explicit user approval (locked user constraint).

**Workflow note:** Batch file writes per task, run `pnpm check` + relevant `pnpm test` once at end of task, atomic commit per task. Match Biome (single quotes, semicolons, es5 trailing commas, alphabetical imports).

**Security locks:** never trust client `user_id`; cross-user → 404; scope by `user_id` AND `deleted_at: null`; gate routes with `[app.authenticate, app.requireOnboarding, app.requirePlus]`; BigInt over wire as numeric strings; R2 keys MUST embed `user_id` to enforce isolation; presigned URLs single-use with short TTL (5 min).

---

## Task 1: Schema migration — `receipt_scans` + NotificationKind extension

**Files:**

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_receipt_scans/migration.sql` (generated)

- [ ] **Step 1: Extend `NotificationKind` enum**

Append two values **at the end** (Prisma enum reorder = migration churn; keep additive):

```prisma
enum NotificationKind {
  recurring_due
  goal_deadline
  streak_nudge
  weekly_review
  receipt_ready
  receipt_failed
}
```

- [ ] **Step 2: Add new enums + `ReceiptScan` model**

```prisma
enum ReceiptScanStatus {
  pending
  processing
  ready
  consumed
  failed
}

enum ReceiptScanSource {
  in_app
  share_intent
}

model ReceiptScan {
  id            String             @id @default(cuid())
  user_id       String
  source        ReceiptScanSource
  status        ReceiptScanStatus  @default(pending)
  r2_key        String
  content_type  String
  size_bytes    Int
  ocr_result    Json?
  failed_reason String?
  consumed_at   DateTime?
  created_at    DateTime           @default(now())
  updated_at    DateTime           @updatedAt
  deleted_at    DateTime?

  user         User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  transactions Transaction[] @relation("ReceiptScanTransactions")

  @@index([user_id, deleted_at, created_at])
  @@map("receipt_scans")
}
```

- [ ] **Step 3: Add `receipt_scan_id` to `Transaction`**

In the `Transaction` model, add (alphabetical placement among scalars; relation block at bottom):

```prisma
receipt_scan_id String?
receipt_scan    ReceiptScan? @relation("ReceiptScanTransactions", fields: [receipt_scan_id], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Add back-ref on `User`**

```prisma
receipt_scans ReceiptScan[]
```

(Alphabetical placement; same block as `ai_sessions`, `notifications`, etc.)

- [ ] **Step 5: Generate + apply migration**

```bash
pnpm --filter @rapih/db exec prisma migrate dev --name add_receipt_scans --create-only
```

Inspect SQL: must create `ReceiptScanStatus`, `ReceiptScanSource` enums; `receipt_scans` table with all columns + index; add 2 values to `NotificationKind`; add `receipt_scan_id` column + FK to `transactions`.

```bash
pnpm --filter @rapih/db exec prisma migrate deploy
DATABASE_URL="postgresql://rapih:rapih@localhost:5433/rapih_test" pnpm --filter @rapih/db exec prisma migrate deploy
pnpm --filter @rapih/db build
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add receipt_scans + extend NotificationKind

Adds ReceiptScan table (pending → processing → ready → consumed|failed),
two enums, optional FK on Transaction for receipt linkage, and two new
notification kinds (receipt_ready, receipt_failed).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared types + error codes

**Files:**

- Create: `packages/shared/src/receipts/enums.ts`
- Create: `packages/shared/src/receipts/ocr.ts`
- Create: `packages/shared/src/receipts/schemas.ts`
- Create: `packages/shared/src/receipts/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/notifications/enums.ts` — extend `NotificationKindSchema`
- Modify: `packages/shared/src/errors.ts` — add 5 codes

- [ ] **Step 1: `receipts/enums.ts`**

```ts
import { z } from 'zod';

export const ReceiptScanStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'consumed',
  'failed',
]);
export type ReceiptScanStatus = z.infer<typeof ReceiptScanStatusSchema>;

export const ReceiptScanSourceSchema = z.enum(['in_app', 'share_intent']);
export type ReceiptScanSource = z.infer<typeof ReceiptScanSourceSchema>;

export const ReceiptConsumeModeSchema = z.enum(['per_item', 'total']);
export type ReceiptConsumeMode = z.infer<typeof ReceiptConsumeModeSchema>;
```

- [ ] **Step 2: `receipts/ocr.ts`**

```ts
import { z } from 'zod';

export const ReceiptOcrItem = z.object({
  name: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
});
export type ReceiptOcrItem = z.infer<typeof ReceiptOcrItem>;

export const ReceiptOcrResult = z.object({
  merchant: z.string().nullable(),
  transacted_at: z.string().nullable(),
  subtotal: z.number().int().nullable(),
  tax: z.number().int().nullable(),
  service_charge: z.number().int().nullable(),
  discount: z.number().int().nullable(),
  total: z.number().int().nonnegative(),
  currency: z.literal('IDR'),
  items: z.array(ReceiptOcrItem),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type ReceiptOcrResult = z.infer<typeof ReceiptOcrResult>;
```

- [ ] **Step 3: `receipts/schemas.ts`** — DTOs + request/response shapes per spec § 8

Full file per spec § 8 (`ReceiptScanDto`, `CreateScanBody`, `CreateScanResponse`, `FinalizeScanResponse`, `ListScansResponse`, `ScanDetailResponse`, `ConsumeBodyPerItem`, `ConsumeBodyTotal`, `ConsumeBody` discriminated union, `ConsumeResponse`).

- [ ] **Step 4: `receipts/index.ts`**

```ts
export * from './enums.js';
export * from './ocr.ts';
export * from './schemas.js';
```

- [ ] **Step 5: Extend `notifications/enums.ts`**

```ts
export const NotificationKindSchema = z.enum([
  'recurring_due',
  'goal_deadline',
  'streak_nudge',
  'weekly_review',
  'receipt_ready',
  'receipt_failed',
]);
```

- [ ] **Step 6: Update `packages/shared/src/index.ts`**

Add (alphabetical position):

```ts
export * from './receipts/index.js';
```

- [ ] **Step 7: Add error codes to `errors.ts`**

```ts
'receipt.already_consumed': { http: 409, message: 'Struk sudah disimpan.' },
'receipt.invalid_state': { http: 409, message: 'Struk tidak dalam status yang valid untuk aksi ini.' },
'receipt.scan_not_found': { http: 404, message: 'Struk tidak ditemukan.' },
'receipt.size_exceeded': { http: 413, message: 'Ukuran gambar melebihi batas.' },
'receipt.upload_missing': { http: 409, message: 'Upload struk belum selesai.' },
```

(Alphabetical placement; verify shape against existing entries.)

- [ ] **Step 8: Build + commit**

```bash
pnpm --filter @rapih/shared build
git add packages/shared/
git commit -m "$(cat <<'EOF'
feat(shared): receipt types + ocr schema + error codes

DTOs and request/response shapes for the receipt scan API (create/finalize/
list/get/consume) and the OCR JSON contract (gpt-4o-mini output). Extends
NotificationKindSchema with receipt_ready and receipt_failed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: R2 client + env wiring (API)

**Files:**

- Modify: `apps/api/src/config/env.ts` — R2_* vars
- Create: `apps/api/src/lib/r2.ts`
- Modify: `apps/api/.env.example`
- Modify root `.env.example`

- [ ] **Step 1: Install R2 SDK**

```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner && cd ../..
```

- [ ] **Step 2: Extend `apps/api/src/config/env.ts`**

Add fields (preserve existing):

```ts
R2_ACCOUNT_ID: z.string().min(1),
R2_ACCESS_KEY_ID: z.string().min(1),
R2_SECRET_ACCESS_KEY: z.string().min(1),
R2_BUCKET: z.string().min(1),
R2_ENDPOINT: z.string().url().optional(),  // override for MinIO/dev
```

- [ ] **Step 3: `apps/api/src/lib/r2.ts`**

```ts
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { loadEnv } from '../config/env.js';

let client: S3Client | null = null;

function endpoint(): string {
  const env = loadEnv();
  if (env.R2_ENDPOINT) return env.R2_ENDPOINT;
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export function getR2Client(): S3Client {
  if (!client) {
    const env = loadEnv();
    client = new S3Client({
      region: 'auto',
      endpoint: endpoint(),
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function presignPut(
  key: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ url: string; headers: Record<string, string> }> {
  const env = loadEnv();
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });
  const url = await getSignedUrl(getR2Client(), cmd, { expiresIn: 300 });
  return {
    url,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(sizeBytes),
    },
  };
}

export async function presignGet(key: string, ttlSeconds = 300): Promise<string> {
  const env = loadEnv();
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return getSignedUrl(getR2Client(), cmd, { expiresIn: ttlSeconds });
}

export async function headObject(
  key: string,
): Promise<{ exists: boolean; size: number; contentType: string }> {
  const env = loadEnv();
  try {
    const res = await getR2Client().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    );
    return {
      exists: true,
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) {
      return { exists: false, size: 0, contentType: '' };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Env example updates**

`apps/api/.env.example` + root `.env.example` append:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=rapih-receipts
# R2_ENDPOINT=  # optional — for MinIO/dev only
```

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @rapih/api typecheck
git add apps/api/ .env.example pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(api): R2 client wrapper — presignPut, presignGet, headObject

Cloudflare R2 (S3-compatible) integration for receipt image storage.
Presigned PUT (TTL 5min) for client direct upload; presigned GET for
mobile review screen. Endpoint configurable via R2_ENDPOINT for MinIO/dev.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API — `/receipts/scans` REST routes + tests

**Files:**

- Create: `apps/api/src/routes/receipts.ts`
- Modify: `apps/api/src/routes/index.ts` — register
- Modify: `apps/api/src/plugins/swagger.ts` — `receipts` tag
- Modify: `apps/api/tests/helpers/test-db.ts` — TRUNCATE `receipt_scans`
- Create: `apps/api/tests/helpers/mock-r2.ts`
- Create: `apps/api/tests/receipts.test.ts`

- [ ] **Step 1: Implement `routes/receipts.ts`**

Six endpoints per spec § 9. All wrapped `onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus]`. All `:id` lookups filter `user_id: req.user.id` AND `deleted_at: null`. Not found / cross-user → `404 receipt.scan_not_found`.

Critical handler details:

**`POST /receipts/scans`** (per spec § 9.1):

```ts
const ext = extFromContentType(req.body.content_type);   // jpg/png/webp/heic
if (!ext) throw new AppError('validation.invalid', 'content_type tidak didukung', 400);
const scan = await app.db.receiptScan.create({
  data: {
    user_id: req.user.id,
    source: req.body.source,
    content_type: req.body.content_type,
    size_bytes: req.body.size_bytes,
    r2_key: '',  // updated post-create with the cuid
  },
});
const r2_key = `users/${req.user.id}/receipts/${scan.id}.${ext}`;
await app.db.receiptScan.update({ where: { id: scan.id }, data: { r2_key } });
const upload = await presignPut(r2_key, req.body.content_type, req.body.size_bytes);
return { ok: true, data: { scan: toScanDto({ ...scan, r2_key }), upload } };
```

**`POST /receipts/scans/:id/finalize`** (per spec § 9.2):

```ts
const scan = await app.db.receiptScan.findFirst({
  where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
});
if (!scan) throw new AppError('receipt.scan_not_found', ..., 404);
if (scan.status !== 'pending') throw new AppError('receipt.invalid_state', ..., 409);
const head = await headObject(scan.r2_key);
if (!head.exists) throw new AppError('receipt.upload_missing', ..., 409);
// Size sanity: allow ±1KB tolerance for HEIC re-encode quirks (none for now)
if (head.size !== scan.size_bytes) {
  throw new AppError('receipt.invalid_state', 'Ukuran upload tidak cocok.', 409);
}
const updated = await app.db.receiptScan.update({
  where: { id: scan.id },
  data: { status: 'processing' },
});
await getAiQueue().add(
  'ai.ocr-receipt',
  { user_id: req.user.id, scan_id: scan.id },
  { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
);
return { ok: true, data: { scan: toScanDto(updated) } };
```

**`GET /receipts/scans`**: filter by optional `status`; `take: Math.min(limit ?? 50, 200)`; `orderBy: { created_at: 'desc' }`.

**`GET /receipts/scans/:id`**: return scan + `image_url: presignGet(scan.r2_key, 300)`.

**`POST /receipts/scans/:id/consume`** (per spec § 9.3):

```ts
const scan = await app.db.receiptScan.findFirst({
  where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
});
if (!scan) throw new AppError('receipt.scan_not_found', ..., 404);
if (scan.status === 'consumed') throw new AppError('receipt.already_consumed', ..., 409);
if (scan.status !== 'ready') throw new AppError('receipt.invalid_state', ..., 409);

const body = req.body;  // validated by zod discriminatedUnion
const txCreates: Prisma.TransactionCreateManyInput[] = [];
if (body.mode === 'per_item') {
  for (const it of body.items) {
    txCreates.push({
      user_id: req.user.id,
      kind: 'expense',
      wallet_id: body.wallet_id,
      category_id: it.category_id,
      amount: BigInt(it.amount),
      note: it.note ?? it.name,
      transacted_at: new Date(it.transacted_at),
      receipt_scan_id: scan.id,
    });
  }
} else {
  txCreates.push({
    user_id: req.user.id,
    kind: 'expense',
    wallet_id: body.wallet_id,
    category_id: body.category_id,
    amount: BigInt(body.amount),
    note: body.note ?? body.merchant ?? 'Struk',
    transacted_at: new Date(body.transacted_at),
    receipt_scan_id: scan.id,
  });
}

const ids = await app.db.$transaction(async (tx) => {
  const created: string[] = [];
  for (const data of txCreates) {
    const row = await tx.transaction.create({ data });
    created.push(row.id);
  }
  await tx.receiptScan.update({
    where: { id: scan.id },
    data: { status: 'consumed', consumed_at: new Date() },
  });
  return created;
});

return { ok: true, data: { transaction_ids: ids } };
```

Verify referenced `wallet_id` / `category_id` belong to user (do this inside the transaction — `findFirst` with user scope before creating each tx, fail with `404 wallet.not_found` / `category.not_found` to match existing patterns in `transactions.ts`).

**`DELETE /receipts/scans/:id`**: `updateMany where: { id, user_id, deleted_at: null }` → `deleted_at: new Date()`. If 0 affected → 404.

`toScanDto` serializes Date → ISO string; `ocr_result` already JSON-shaped.

- [ ] **Step 2: Register in `routes/index.ts` + add swagger tag**

Alphabetical placement (between `notifications` and `recurring` or similar).

- [ ] **Step 3: Update `tests/helpers/test-db.ts`**

Add `'receipt_scans'` to TRUNCATE list.

- [ ] **Step 4: Create `tests/helpers/mock-r2.ts`**

```ts
import { vi } from 'vitest';

type Stored = { contentType: string; size: number };

class MockR2 {
  store = new Map<string, Stored>();
  putShouldFail = false;
  uploadFromKey(key: string, size: number, contentType: string) {
    if (this.putShouldFail) throw new Error('mock-r2-put-failed');
    this.store.set(key, { size, contentType });
  }
  clear() { this.store.clear(); this.putShouldFail = false; }
}

export const mockR2 = new MockR2();

vi.mock('../../src/lib/r2.js', () => ({
  presignPut: vi.fn(async (key: string, contentType: string, sizeBytes: number) => ({
    url: `https://mock-r2.local/put/${encodeURIComponent(key)}?expires=300`,
    headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) },
  })),
  presignGet: vi.fn(async (key: string) => `https://mock-r2.local/get/${encodeURIComponent(key)}?expires=300`),
  headObject: vi.fn(async (key: string) => {
    const obj = mockR2.store.get(key);
    if (!obj) return { exists: false, size: 0, contentType: '' };
    return { exists: true, size: obj.size, contentType: obj.contentType };
  }),
}));
```

- [ ] **Step 5: `tests/receipts.test.ts`** — full coverage per spec § 14.1

Tests (~14):

1. `POST /receipts/scans` without token → 401.
2. Free user → 403 `tier.upgrade_required`.
3. Plus user, valid body → returns `{ scan: { status: 'pending', r2_key matches users/<id>/receipts/<id>.jpg }, upload: { url, headers } }`.
4. Invalid `content_type` (`application/pdf`) → 400.
5. `size_bytes > 10MB` → zod 400.
6. `POST /receipts/scans/:id/finalize` before upload → 409 `receipt.upload_missing`.
7. Finalize after mock R2 upload → `status: 'processing'`; ai-queue gains `ai.ocr-receipt` job with `{ user_id, scan_id }`.
8. Finalize size mismatch (mock store size differs from scan.size_bytes) → 409.
9. Finalize on already-processing scan → 409 `receipt.invalid_state`.
10. `GET /receipts/scans` lists user's scans, excludes deleted, excludes other users; supports `status` filter.
11. `GET /receipts/scans/:id` returns scan + `image_url` (mock presigned).
12. `GET /receipts/scans/:id` for cross-user scan → 404.
13. `POST /receipts/scans/:id/consume` (per_item, 3 items): inserts 3 Transactions linked via `receipt_scan_id`; `status: 'consumed'`, `consumed_at` set; returns 3 transaction_ids.
14. `POST /receipts/scans/:id/consume` (total): inserts 1 Transaction.
15. Consume on already-consumed → 409 `receipt.already_consumed`.
16. Consume with wallet_id from another user → 404.
17. Consume on `pending` scan → 409 `receipt.invalid_state`.
18. `DELETE /receipts/scans/:id` soft-deletes; subsequent GET → 404.

Setup: each test seeds a Plus user, creates a `receiptScan` row, then for some tests simulates upload by writing to `mockR2.store`. `beforeEach` truncates DB + `mockR2.clear()`.

- [ ] **Step 6: Run check + tests + commit**

```bash
pnpm --filter @rapih/api typecheck
pnpm --filter @rapih/api test receipts
```

```bash
git add apps/api/
git commit -m "$(cat <<'EOF'
feat(api): receipts REST — scan/finalize/list/get/consume

Six endpoints for the scan-struk flow. Create-scan issues presigned PUT to
R2 (5min TTL). Finalize verifies the upload landed and enqueues
ai.ocr-receipt. Consume atomically creates N transactions (per-item or
total mode) and marks the scan consumed.

Allocation of tax/service/discount happens mobile-side — server trusts the
item amounts as sent. Cross-user / not-found → 404; wrong state → 409.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: worker-ai — `ai.ocr-receipt` handler

**Files:**

- Modify: `apps/worker-ai/src/config/env.ts` — add R2_*, `OPENAI_OCR_MODEL`
- Create: `apps/worker-ai/src/lib/r2.ts` — download helper
- Create: `apps/worker-ai/src/queues/reminder.ts` — producer to reminder queue
- Create: `apps/worker-ai/src/handlers/ocr-system-prompt.ts`
- Create: `apps/worker-ai/src/handlers/ocr-receipt.ts`
- Modify: `apps/worker-ai/src/server.ts` — register `ai.ocr-receipt`
- Create: `apps/worker-ai/tests/ocr-receipt.test.ts`

- [ ] **Step 1: Extend worker-ai env**

```ts
R2_ACCOUNT_ID: z.string().min(1),
R2_ACCESS_KEY_ID: z.string().min(1),
R2_SECRET_ACCESS_KEY: z.string().min(1),
R2_BUCKET: z.string().min(1),
R2_ENDPOINT: z.string().url().optional(),
OPENAI_OCR_MODEL: z.string().default('gpt-4o-mini'),
```

Append same R2_* lines + `OPENAI_OCR_MODEL=gpt-4o-mini` to `apps/worker-ai/.env.example`.

```bash
pnpm --filter @rapih/worker-ai add @aws-sdk/client-s3
```

- [ ] **Step 2: `src/lib/r2.ts` (worker side — download only)**

```ts
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../config/env.js';

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    const env = loadEnv();
    client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function downloadAsBase64(
  key: string,
): Promise<{ b64: string; contentType: string }> {
  const env = loadEnv();
  const res = await getClient().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
  const bytes = await body.transformToByteArray();
  const b64 = Buffer.from(bytes).toString('base64');
  return { b64, contentType: res.ContentType ?? 'application/octet-stream' };
}
```

Add a `__setR2DownloadForTests(fn)` seam similar to OpenAI client.

- [ ] **Step 3: `src/queues/reminder.ts`** — producer to existing `reminder` queue

```ts
import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let queue: Queue | null = null;
export function getReminderQueue(): Queue {
  if (!queue) queue = new Queue('reminder', { connection: getRedis() });
  return queue;
}
```

- [ ] **Step 4: `src/handlers/ocr-system-prompt.ts`**

Copy the prompt text from spec § 5.1 verbatim into a `OCR_SYSTEM_PROMPT` const.

- [ ] **Step 5: `src/handlers/ocr-receipt.ts`** — full implementation per spec § 10

Type the payload:

```ts
type OcrReceiptPayload = { user_id: string; scan_id: string };
```

Implement per pseudocode. Key invariants:

- Idempotency: if `scan.status !== 'processing'` → return early (don't re-process).
- Use `ReceiptOcrResult.safeParse` from `@rapih/shared`.
- On any parse/zod failure → `markFailed(scan.id, 'parse_failed')` + `enqueueFailedPush`.
- On any exception → `markFailed(scan.id, 'internal')` + `enqueueFailedPush(reason: 'internal')` + `throw` (BullMQ marks failed).
- AiUsageLog: `kind: 'ocr'`, `session_id: null`.
- Cost: reuse `computeCost(model, prompt, completion)` from `lib/cost.ts`.

Helper functions inline (file-local):

```ts
async function markFailed(scan_id: string, reason: string) {
  await prisma.receiptScan.update({ where: { id: scan_id }, data: { status: 'failed', failed_reason: reason } });
}
async function enqueueReadyPush(user_id: string, scan_id: string) {
  await getReminderQueue().add('receipts.ready-push', { user_id, scan_id }, { jobId: `ready:${scan_id}` });
}
async function enqueueFailedPush(user_id: string, scan_id: string, reason: string) {
  await getReminderQueue().add('receipts.failed-push', { user_id, scan_id, reason }, { jobId: `failed:${scan_id}` });
}
```

Note: `jobId` set to `ready:${scan_id}` enforces BullMQ-side deduplication if the OCR job is retried.

- [ ] **Step 6: Register handler in `server.ts`**

```ts
import { handleOcrReceipt } from './handlers/ocr-receipt.js';
// ...
startWorker({
  'tanya.chat-completion': handleTanyaChat,
  'ai.ocr-receipt': handleOcrReceipt,
});
```

- [ ] **Step 7: `tests/ocr-receipt.test.ts`** — per spec § 14.2

Setup helpers:

- `seedScan(user_id, status='processing')` — inserts a ReceiptScan row.
- `captureReminderJobs()` — subscribes a fresh test redis client to the `reminder` queue events? Simpler: read the `reminder` queue contents directly after handler returns (`new Queue('reminder', { connection: testRedis }).getJobs(['waiting','delayed','active'])`).

R2 download mock via `__setR2DownloadForTests(async () => ({ b64: 'fake', contentType: 'image/jpeg' }))`.
OpenAI mock via `__setOpenAiForTests(buildOpenAiMock([...]))` — but we need a non-streaming completion shape here. Extend `openai-mock.ts` (or add `openai-mock-completion.ts`) to support `chat.completions.create` returning a resolved (non-stream) object when `stream` is not requested:

```ts
export function buildOpenAiCompletionMock(scriptedReplies: { content: string; usage: { prompt_tokens: number; completion_tokens: number } }[]): OpenAI {
  let i = 0;
  return {
    chat: {
      completions: {
        create: async () => {
          const r = scriptedReplies[i++] ?? scriptedReplies[scriptedReplies.length - 1];
          return {
            choices: [{ message: { role: 'assistant', content: r.content } }],
            usage: { ...r.usage, total_tokens: r.usage.prompt_tokens + r.usage.completion_tokens },
          };
        },
      },
    },
  } as unknown as OpenAI;
}
```

Tests (~7):

1. **Happy path**: mock returns valid JSON → scan.status='ready', ocr_result persisted, AiUsageLog written (kind='ocr', tokens correct), reminder queue has `receipts.ready-push` job with `{ user_id, scan_id }`.
2. **Malformed JSON**: mock returns `'not json{{'` → status='failed', failed_reason='parse_failed', failed-push enqueued.
3. **Zod validation fail**: mock returns JSON without `total` → status='failed' reason='parse_failed'.
4. **Wrong state (idempotent)**: scan.status='ready' → handler returns; no DB change; no queue add.
5. **Scan deleted (not found)**: scan.deleted_at set → handler throws scan_not_found; no push.
6. **OpenAI throws**: mock raises → status='failed' reason='internal', failed-push enqueued, throw propagated.
7. **AiUsageLog**: verify prompt_tokens/completion_tokens/total_tokens match mocked usage; cost_usd matches `computeCost('gpt-4o-mini', p, c)`.

- [ ] **Step 8: Run check + tests + commit**

```bash
pnpm --filter @rapih/worker-ai typecheck
pnpm --filter @rapih/worker-ai test
git add apps/worker-ai/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(worker-ai): ai.ocr-receipt handler

Downloads the receipt image from R2, calls gpt-4o-mini vision with JSON
mode, validates the result against ReceiptOcrResult, and marks the scan
ready (or failed with reason). Enqueues a push job on the reminder queue
so worker-reminder owns the actual Expo Push call. Cost + tokens logged
in AiUsageLog with kind='ocr'.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: worker-reminder — two new push handlers

**Files:**

- Create: `apps/worker-reminder/src/jobs/receipts-ready-push.ts`
- Create: `apps/worker-reminder/src/jobs/receipts-failed-push.ts`
- Modify: `apps/worker-reminder/src/worker.ts` — register handlers
- Create: `apps/worker-reminder/tests/receipts-ready-push.test.ts`
- Create: `apps/worker-reminder/tests/receipts-failed-push.test.ts`

- [ ] **Step 1: `src/jobs/receipts-ready-push.ts`**

```ts
import type { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { sendPushes } from '../lib/expo-push.js';
import { writeNotification } from '../lib/notification-write.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { formatRupiah } from '@rapih/shared';  // if not present, format inline

type Payload = { user_id: string; scan_id: string };

export async function handleReceiptsReadyPush(job: Job<Payload>) {
  const { user_id, scan_id } = job.data;
  const key = `push:receipt-ready:${scan_id}`;
  if (!(await claim(key, 7 * 24 * 3600))) return;

  const scan = await prisma.receiptScan.findFirst({
    where: { id: scan_id, user_id, deleted_at: null },
  });
  if (!scan || scan.status !== 'ready') {
    logger.warn({ scan_id }, 'receipts-ready-push: scan missing or wrong state');
    return;
  }

  const tokens = await prisma.deviceToken.findMany({ where: { user_id } });
  if (tokens.length === 0) return;  // skip — no devices = no notification row (spec rule)

  const result = scan.ocr_result as { merchant: string | null; total: number } | null;
  const merchant = result?.merchant ?? 'Struk';
  const total = result?.total ?? 0;
  const title = 'Struk siap direview';
  const body = `${merchant} · ${formatRupiah(total)}`;

  const notif = await writeNotification({
    user_id,
    kind: 'receipt_ready',
    title,
    body,
    data: { kind: 'receipt_ready', scan_id },
  });

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { kind: 'receipt_ready', scan_id, notification_id: notif.id },
  }));
  const sendResult = await sendPushes(messages);
  await cleanupTokens(sendResult.removeTokens);
}

async function cleanupTokens(toRemove: string[]) {
  if (toRemove.length === 0) return;
  await prisma.deviceToken.deleteMany({ where: { token: { in: toRemove } } });
}
```

If `formatRupiah` is not present in `@rapih/shared`, add a small helper here:

```ts
function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}
```

- [ ] **Step 2: `src/jobs/receipts-failed-push.ts`**

Same pattern, copy text differs:

- title: `'Struk gagal dibaca'`
- body: `'Coba foto ulang atau pilih dari galeri.'`
- kind: `'receipt_failed'`
- data: `{ kind: 'receipt_failed', scan_id, reason }`
- idempotency key: `push:receipt-failed:${scan_id}` (TTL 7 days)
- guard: `scan.status === 'failed'` (else warn + return)

- [ ] **Step 3: Register dispatcher**

In `worker-reminder/src/worker.ts`, add to dispatcher map:

```ts
'receipts.ready-push': handleReceiptsReadyPush,
'receipts.failed-push': handleReceiptsFailedPush,
```

- [ ] **Step 4: Tests** — mirror existing push test patterns

For each handler (~4 tests):

1. user with 2 devices → 2 messages sent + 1 Notification row written.
2. user with 0 devices → no Notification row, no push call.
3. Idempotent (run twice with same `scan_id`) → second run is a no-op.
4. DeviceNotRegistered ticket → token row deleted.

Use Expo mock from existing worker-reminder test infra. Seed a ReceiptScan + DeviceTokens.

- [ ] **Step 5: Run check + tests + commit**

```bash
pnpm --filter @rapih/worker-reminder typecheck
pnpm --filter @rapih/worker-reminder test receipts
git add apps/worker-reminder/
git commit -m "$(cat <<'EOF'
feat(worker-reminder): receipts.ready-push and receipts.failed-push handlers

Worker-ai enqueues these jobs after OCR completes (or fails). Both follow
the existing pattern: idempotency claim, skip if 0 devices, write
Notification row, send Expo push, hard-delete DeviceNotRegistered tokens.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Mobile — `receipt` feature folder (api, store, share intent)

**Files:**

- Create: `apps/mobile/src/features/receipt/api.ts`
- Create: `apps/mobile/src/features/receipt/receipt-store.ts`
- Create: `apps/mobile/src/features/receipt/share-intent.ts`
- Create: `apps/mobile/src/features/receipt/allocation.ts` (pure helpers)

- [ ] **Step 1: Install image picker + share intent**

```bash
cd apps/mobile && pnpm add expo-image-picker expo-share-intent && cd ../..
```

- [ ] **Step 2: `api.ts`**

Functions:

```ts
createScan({ source, content_type, size_bytes }): Promise<{ scan, upload: { url, headers } }>
uploadToR2(url, headers, fileUri): Promise<void>      // raw PUT of the file blob
finalizeScan(id): Promise<ReceiptScanDto>
listScans(opts?: { status?, limit? }): Promise<ReceiptScanDto[]>
getScan(id): Promise<{ scan, image_url }>
consumeScan(id, body): Promise<{ transaction_ids }>
deleteScan(id): Promise<void>
```

`uploadToR2` uses `expo-file-system` to read the file as binary blob:

```ts
import * as FileSystem from 'expo-file-system';
export async function uploadToR2(url: string, headers: Record<string, string>, fileUri: string): Promise<void> {
  const upload = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  if (upload.status >= 300) throw new Error(`R2 upload failed: ${upload.status}`);
}
```

- [ ] **Step 3: `allocation.ts`** — pure helpers (testable)

```ts
export type RawItem = { name: string; qty: number; unit_price: number; subtotal: number };

/**
 * Distribute `total` across items proportionally to their subtotal.
 * Returns integer Rupiah per item; last row absorbs the residual so the
 * sum exactly equals `total`. Used in per-item save mode to allocate
 * tax/service/discount baked into the receipt total.
 */
export function allocateProportional(items: RawItem[], total: number): number[] {
  const sumSubtotal = items.reduce((s, it) => s + it.subtotal, 0);
  if (sumSubtotal === 0) return items.map(() => 0);
  const out = items.map((it) => Math.round((it.subtotal / sumSubtotal) * total));
  const diff = total - out.reduce((s, x) => s + x, 0);
  out[out.length - 1] += diff;
  return out;
}
```

(Pure function — no React; can unit-test with vitest if mobile gets a test runner later.)

- [ ] **Step 4: `receipt-store.ts`**

Zustand store:

```ts
type State = {
  scans: ReceiptScanDto[];
  current: { scan: ReceiptScanDto; image_url: string } | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;

  loadScans: () => Promise<void>;
  loadScan: (id: string) => Promise<void>;
  startScan: (fileUri: string, source: ReceiptScanSource, contentType: string, sizeBytes: number) => Promise<string>; // returns scan id
  consume: (id: string, body: ConsumeBody) => Promise<string[]>;
  remove: (id: string) => Promise<void>;
};
```

`startScan`:

```ts
1. createScan({ source, content_type, size_bytes })
2. uploadToR2(upload.url, upload.headers, fileUri)
3. finalizeScan(scan.id)
4. push the pending scan into state.scans (status='processing')
5. return scan.id
```

- [ ] **Step 5: `share-intent.ts`**

```ts
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { useReceiptStore } from './receipt-store';
import { useAuthStore } from '@/features/auth/auth-store';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';

export function useReceiptShareIntent() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const user = useAuthStore((s) => s.user);
  const startScan = useReceiptStore((s) => s.startScan);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent.files?.length) return;
    const file = shareIntent.files[0];
    if (!file.mimeType?.startsWith('image/')) { resetShareIntent(); return; }

    if (!user) {
      // Defer until login — for v1 we drop and toast. Future: persist a pending share.
      Toast.show('Login dulu untuk simpan struk.');
      resetShareIntent();
      return;
    }
    if (user.tier === 'free') {
      Toast.show('Scan struk hanya untuk Rapih Plus.');
      resetShareIntent();
      return;
    }

    (async () => {
      const info = await FileSystem.getInfoAsync(file.path, { size: true });
      const id = await startScan(file.path, 'share_intent', file.mimeType!, info.size ?? 0);
      Toast.show('Struk dikirim — kabari kalau selesai.');
      router.push('/(app)/receipts');
      resetShareIntent();
    })();
  }, [hasShareIntent]);
}
```

Wire in root `_layout.tsx`:

```ts
import { useReceiptShareIntent } from '@/features/receipt/share-intent';
// inside RootLayout
useReceiptShareIntent();
```

- [ ] **Step 6: `app.config.ts`**

Add the share-intent plugin per the package README. Document EAS Dev Build requirement in `apps/mobile/README.md`.

- [ ] **Step 7: Typecheck + commit**

```bash
pnpm --filter @rapih/mobile typecheck
git add apps/mobile/ pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(mobile): receipt feature — api, store, allocation, share intent

REST helpers, zustand store for the receipt list and active scan, the
pure allocateProportional helper for per-item save mode, and the
expo-share-intent wiring that handles inbound images from other apps.
Share intent requires EAS Dev Build (documented in README).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Mobile — screens + components

**Files:**

- Create: `apps/mobile/src/features/receipt/screens/scan-receipt-screen.tsx`
- Create: `apps/mobile/src/features/receipt/screens/receipt-list-screen.tsx`
- Create: `apps/mobile/src/features/receipt/screens/receipt-review-screen.tsx`
- Create: `apps/mobile/src/features/receipt/components/receipt-card.tsx`
- Create: `apps/mobile/src/features/receipt/components/line-item-row.tsx`
- Create: `apps/mobile/src/features/receipt/components/allocation-summary.tsx`
- Create: `apps/mobile/src/features/receipt/components/scan-paywall-card.tsx`
- Modify: `apps/mobile/src/features/profile/screens/notifikasi-screen.tsx` — extend kind map + tap handler
- Modify: expo-router file tree — add `/(app)/receipts/*` routes (or similar; verify existing router layout)

- [ ] **Step 1: `scan-paywall-card.tsx`**

Centered card visible for Free users. Title "Scan struk hanya untuk Plus", body 1-liner, CTA "Upgrade" → routes to pengaturan/upgrade screen.

- [ ] **Step 2: `scan-receipt-screen.tsx`**

Two-button screen: "Kamera" and "Galeri". Each launches the corresponding `expo-image-picker` method, then calls `useReceiptStore().startScan(...)`, then navigates to receipt list. Free user → paywall card.

```ts
async function handleCamera() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return Toast.show('Izinkan akses kamera.');
  const result = await ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: 'Images' });
  if (result.canceled) return;
  const asset = result.assets[0];
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  const id = await startScan(asset.uri, 'in_app', asset.mimeType ?? 'image/jpeg', info.size ?? 0);
  router.push(`/(app)/receipts`);
}
```

`handleGallery` mirrors with `launchImageLibraryAsync`. Use `Screen` + `palette` for visual language consistent with existing app.

- [ ] **Step 3: `receipt-list-screen.tsx`**

Pull-to-refresh list grouped by status (or single list with status chips per card). Use `<RefreshControl>` like `notifikasi-screen.tsx`. Empty state: "Belum ada struk · Foto struk pertama biar Rapih bisa parse-in."

`receipt-card.tsx` per row:

- Top: merchant (or "Struk baru" if unknown) + status chip (`processing` → spinner + "Memproses…"; `ready` → "Siap direview"; `failed` → "Gagal"; `consumed` → "Tersimpan").
- Sub: total (if available) + created_at.
- Tap behavior:
  - `processing` → toast "Sebentar lagi siap…" (no-op).
  - `ready` / `consumed` → push `/(app)/receipts/${id}`.
  - `failed` → push `/(app)/receipts/${id}` (review screen will show failure UI with "Coba lagi" → triggers new scan with same image? Defer — for now just show reason).

- [ ] **Step 4: `receipt-review-screen.tsx`** — the heart of the chunk

State:

```ts
const { current, loadScan, consume } = useReceiptStore();
const [mode, setMode] = useState<'per_item' | 'total'>('per_item');
const [merchant, setMerchant] = useState('');
const [transactedAt, setTransactedAt] = useState<Date>(new Date());
const [walletId, setWalletId] = useState<string | null>(null);
// per-item mode:
const [items, setItems] = useState<EditableItem[]>([]);   // pre-filled from ocr_result.items
// total mode:
const [totalAmount, setTotalAmount] = useState('0');
const [totalCategoryId, setTotalCategoryId] = useState<string | null>(null);
```

On mount: `loadScan(id)`. When `current` resolves and `mode === 'per_item'`, pre-fill `items` from `ocr_result.items`, default each item's category to user's "Other" category (or last-used). `setMerchant(ocr_result.merchant ?? '')`. Set `transactedAt` from `ocr_result.transacted_at` (parse or default `created_at`).

**Live allocation summary** (per-item mode): compute `allocateProportional(items.map(toRaw), ocr_result.total)` whenever items change → display per-row "Rp X.XXX" beside each line. Show summary box: subtotal, tax, service, discount, **total = sum of allocated amounts (must equal ocr_result.total)**.

**Save handler**:

```ts
async function onSave() {
  if (!walletId) return Toast.show('Pilih wallet dulu.');
  if (mode === 'per_item') {
    const allocated = allocateProportional(items.map(toRaw), current!.scan.ocr_result!.total);
    const body: ConsumeBody = {
      mode: 'per_item',
      wallet_id: walletId,
      items: items.map((it, i) => ({
        name: it.name,
        amount: String(allocated[i]),
        category_id: it.categoryId!,
        transacted_at: transactedAt.toISOString(),
        note: it.note ?? it.name,
      })),
    };
    await consume(current!.scan.id, body);
  } else {
    if (!totalCategoryId) return Toast.show('Pilih kategori dulu.');
    const body: ConsumeBody = {
      mode: 'total',
      wallet_id: walletId,
      category_id: totalCategoryId,
      amount: totalAmount,
      transacted_at: transactedAt.toISOString(),
      note: merchant || 'Struk',
      merchant: merchant || undefined,
    };
    await consume(current!.scan.id, body);
  }
  router.back();
  Toast.show(mode === 'per_item' ? `${items.length} transaksi disimpan.` : 'Transaksi disimpan.');
}
```

Validate before save: every per-item row has `categoryId`, name non-empty, qty > 0, subtotal > 0. Disable button while submitting.

Failure state UI: if `scan.status === 'failed'`, show error card with `failed_reason` mapped to friendly copy + "Hapus" button (calls `remove(id)`).

- [ ] **Step 5: Update `notifikasi-screen.tsx`**

Extend `KIND_TO_VARIANT`:

```ts
receipt_ready: 'review',
receipt_failed: 'budget',
```

Extend `TYPE_META` if a dedicated emoji/color is desired — but reusing existing variants keeps the styling minimal.

Tap handler: when item.kind starts with `receipt_`, parse `item.data.scan_id` and `router.push(\`/(app)/receipts/\${scan_id}\`)`.

- [ ] **Step 6: Route registration**

Add expo-router files under `apps/mobile/app/(app)/receipts/` (mirror existing pattern):

- `index.tsx` → renders `ReceiptListScreen`
- `[id].tsx` → renders `ReceiptReviewScreen`
- `scan.tsx` → renders `ScanReceiptScreen`

(Or whichever layout convention the repo uses — verify by reading existing routes like the tanya/notif ones.)

- [ ] **Step 7: Manual smoke**

```bash
pnpm --filter @rapih/mobile typecheck
```

Then `eas build --profile development` (requires share intent) → install on device. Smoke checklist from spec § 14.4:

- Free user paywall.
- Camera → list shows processing → wait for notif → tap → review screen → save per-item → 3 transactions visible in transactions list, linked to scan.
- Gallery → same.
- Share image from Photos → notif arrives.
- Failed scan (use blurry non-receipt image) → notif "Struk gagal dibaca" → tap → review screen shows failure → delete.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/
git commit -m "$(cat <<'EOF'
feat(mobile): receipt scan UX — camera, gallery, list, review, share intent

Three screens (scan, list, review) plus components. Per-item save mode
shows live tax/fee allocation; total mode is a single transaction. Failed
scans surface the reason and offer delete. Share intent (EAS Dev Build)
handles inbound images from the OS share sheet.

Smoke tested on dev build: paywall, camera, gallery, share intent, per-item
save (3 transactions), total save, failed scan, deep-link from notif.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Spine Feature Atlas update + final integration check

**Files:**

- Modify: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — atlas row

- [ ] **Step 1: Mark `scan-struk OCR` row as `done`** in Feature Atlas.

- [ ] **Step 2: Full repo check**

```bash
pnpm check
pnpm --filter @rapih/api test
pnpm --filter @rapih/worker-ai test
pnpm --filter @rapih/worker-reminder test
pnpm --filter @rapih/mobile typecheck
```

All green expected.

- [ ] **Step 3: Verify branch state + report**

```bash
git status        # clean
git log --oneline main..HEAD
```

- [ ] **Step 4: Commit atlas update**

```bash
git add docs/superpowers/specs/2026-05-20-rapih-backend-spine.md
git commit -m "$(cat <<'EOF'
docs(spine): mark scan-struk OCR as done

Chunk B of ai-worker (receipt scan + OCR + per-item/total save) landed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Hand off to user**

Do NOT push or open a PR — per locked user constraint. Surface the branch and let the user review/push.

Report back: commit count, test summary, any deferred items + manual smoke results.

---

## Appendix A — Done criteria

- [ ] All 9 tasks committed on `feat/worker-ai-scan-struk`.
- [ ] `pnpm check` passes (root).
- [ ] `pnpm --filter @rapih/api test` passes — includes new receipts tests.
- [ ] `pnpm --filter @rapih/worker-ai test` passes — includes ocr-receipt tests.
- [ ] `pnpm --filter @rapih/worker-reminder test` passes — includes 2 new push handler tests.
- [ ] `pnpm --filter @rapih/mobile typecheck` passes.
- [ ] Spine Feature Atlas updated.
- [ ] Manual smoke on dev build done (camera, gallery, share intent, per-item save, total save, failed flow).

## Appendix B — Deferred from this chunk

- HEIC re-encode (only if OpenAI rejects in production).
- Multi-page receipts.
- R2 cleanup cron for soft-deleted scans.
- `POST /receipts/scans/:id/retry` endpoint.
- LLM-suggested category per line (pass category list in prompt).
- Receipt sharing between users (household).
- Auto-categorization model fine-tune.
