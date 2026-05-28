## worker-ai (Chunk B — Scan-struk OCR) — Design Spec

**Status:** draft · **Date:** 2026-05-28 · **Owner:** @ridhoidris
**Sub-project:** ai-worker (per Spine § 15.6) · **Chunk:** B of 3 (Chunk A = Tanya, Chunk C = weekly-review-gen)
**References:** [Spine](./2026-05-20-rapih-backend-spine.md) § 9 (receipts), § 10 (async jobs), § 12 (AI); [Chunk A spec](./2026-05-28-worker-ai-tanya-design.md) (worker boot pattern, OpenAI client, cost log); [worker-reminder spec](./2026-05-28-worker-reminder-design.md) (push pattern, notifications feed)

This spec covers **Chunk B** of the `ai-worker`: scan-struk OCR end-to-end. Receipts ingested from in-app camera, gallery, or OS share intent → uploaded to object storage → processed asynchronously by the existing `worker-ai` → user reviewed in a draft form → saved as one or many transactions with proportional tax/fee allocation.

## 1. Goals

1. New `ai.ocr-receipt` job handler in `apps/worker-ai`, consuming the existing `ai` queue.
2. New `receipts` resource in `apps/api` — create scan, list, get detail, consume (save-as-transactions), delete.
3. Image storage on **Cloudflare R2** via presigned upload URL (client uploads directly).
4. OCR via **gpt-4o-mini vision** — single OpenAI provider, structured JSON output.
5. Push notification "Struk siap direview" via worker-reminder's existing push pipeline.
6. Mobile: camera + gallery picker, share intent inbox (EAS Dev Build), receipt list, receipt review form with per-item and total save modes + proportional tax/fee allocation.

Out of scope: ML re-training, multi-page receipts, receipt merchant taxonomy/categorization beyond what the LLM returns, receipt search.

## 2. Locked Decisions

| Concern | Choice | Reasoning |
|---|---|---|
| OCR engine | **`gpt-4o-mini`** with `image_url` content part | Single provider (OpenAI key shared with Tanya). ~$0.001-0.003/struk. JSON mode for structured output. |
| Image storage | **Cloudflare R2** (S3-compatible) | Cheap, fast, no egress fees. Audit-friendly: user can re-open original. |
| Upload pattern | **Presigned PUT URL** from API → client uploads to R2 directly | No API bandwidth burn. API only holds metadata. |
| Processing flow | **Always async** via `ai.ocr-receipt` job | Consistent path for in-app + share intent. UX: notif "Struk siap direview" when done. |
| Job→client signal | **Push notification + notifications feed row** (no SSE) | OCR is short and one-shot; SSE adds complexity without UX gain. Reuses worker-reminder push pipeline. |
| Share intent | **`expo-share-intent`** — requires **EAS Dev Build** (no Expo Go) | User already accepted this constraint in prior session. |
| Save endpoint | **`POST /receipts/:id/consume`** — bulk create N transactions atomically | New endpoint; clearer than overloading `/transactions`. Marks receipt `consumed_at`. |
| Per-item vs total | **Both modes**, user picks at consume time | Per `scan-struk-flow` memory. Per-item: 1 transaction per line. Total: 1 transaction = receipt total. |
| Tax/fee allocation | **Proportional to line subtotal** (per-item mode) | Memory-locked. Round-half-up per line; last line absorbs residual cent so sum matches exactly. |
| Receipt status | `pending` → `processing` → `ready` → `consumed` (terminal) \| `failed` (terminal) | Linear state machine. `consumed_at` and `failed_reason` columns capture terminal info. |
| Tier gate | **Plus + Pro** — Free users see paywall | Consistent with Tanya. Same `app.requirePlus` decorator. |
| Cost logging | **Re-use `AiUsageLog`** with `kind: 'ocr'` | Schema added in Chunk A already supports this. |
| Failure handling | Job fails → `status = 'failed'`, `failed_reason` set, notif kind `receipt_failed` (Plus users) | Visible to user — they can retry by re-uploading. |
| Image retention | **Soft-delete with `deleted_at`**; physical R2 object remains for now | Cleanup job deferred (out of scope). |

## 3. Architecture & Flow

### 3.1 In-app camera / gallery flow

```text
mobile picks image
   │  (expo-image-picker — camera or gallery)
   ▼
mobile POST /receipts/scans
   │  body: { content_type: 'image/jpeg', size_bytes }
   ▼
apps/api/routes/receipts.ts
   ├─ inserts ReceiptScan { status: 'pending', source: 'in_app' }
   ├─ generates presigned PUT URL for R2 key `users/${user_id}/receipts/${scan_id}.jpg`
   └─ returns { scan: ReceiptScanDto, upload: { url, headers } }

mobile PUT <presigned url> (multipart? no — single PUT with raw bytes)
   │
   ▼
R2 stores object

mobile POST /receipts/scans/:id/finalize
   │  signals upload complete
   ▼
api:
   ├─ verifies object exists in R2 (HEAD)
   ├─ updates ReceiptScan.status = 'processing'
   └─ enqueues ai.ocr-receipt job { user_id, scan_id }
```

### 3.2 Share intent flow

```text
OS shares image to Rapih (Android: ACTION_SEND, iOS: share extension)
   │  (expo-share-intent)
   ▼
mobile share handler — runs in-app or via background launch
   ├─ if user not logged in / not Plus → save image to local cache, prompt login on next open
   └─ else → same as in-app flow (POST /scans → upload → finalize)
```

### 3.3 Worker job (`ai.ocr-receipt`)

```text
worker dispatcher picks tanya/ai.ocr-receipt
   ▼
handlers/ocr-receipt.ts
   ├─ load ReceiptScan; assert status === 'processing'
   ├─ fetch image from R2 as bytes (signed GET URL or SDK) → base64
   ├─ call openai.chat.completions.create with vision content + JSON mode
   ├─ validate output with zod (graceful: any parse failure = falsy fields)
   ├─ update ReceiptScan { status: 'ready', ocr_result }
   ├─ insert AiUsageLog { kind: 'ocr', tokens, cost }
   ├─ enqueue push job on reminder queue: 'receipts.ready-push' { user_id, scan_id }
   │   (alternative: write Notification + send push inline here — see § 6 decision)
   └─ on error: update status='failed', failed_reason, enqueue 'receipts.failed-push'
```

### 3.4 Consume flow

```text
mobile opens receipt review screen
   ├─ GET /receipts/scans/:id → { scan, ocr_result }
   ├─ user edits line items, picks mode (per-item | total), confirms category/wallet
   └─ POST /receipts/scans/:id/consume
        body: { mode: 'per_item' | 'total', wallet_id, category_id (total) | items: [...] (per-item) }
   ▼
api inserts N Transaction rows atomically + sets ReceiptScan.consumed_at + linked_transaction_ids
```

## 4. Schema Additions

Add to `packages/db/prisma/schema.prisma`:

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
  id              String             @id @default(cuid())
  user_id         String
  source          ReceiptScanSource
  status          ReceiptScanStatus  @default(pending)
  r2_key          String             // object key in R2 — full path
  content_type    String
  size_bytes      Int
  ocr_result      Json?              // ReceiptOcrResult shape (see § 5.2)
  failed_reason   String?
  consumed_at     DateTime?
  created_at      DateTime           @default(now())
  updated_at      DateTime           @updatedAt
  deleted_at      DateTime?

  user         User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  transactions Transaction[] @relation('ReceiptScanTransactions')

  @@index([user_id, deleted_at, created_at])
  @@map("receipt_scans")
}
```

Modify `Transaction`:

```prisma
receipt_scan_id String?
receipt_scan    ReceiptScan? @relation('ReceiptScanTransactions', fields: [receipt_scan_id], references: [id], onDelete: SetNull)
```

Add to `User`:

```prisma
receipt_scans ReceiptScan[]
```

Extend `NotificationKind` enum (additive — keep order, add at end):

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

Migration name: `add_receipt_scans`.

## 5. OCR Contract

### 5.1 Prompt strategy

System message: locks output language, JSON mode requirements, item structure. Sample:

```text
Kamu adalah parser struk belanja Indonesia. Ekstrak field-field berikut dari gambar struk dan kembalikan JSON valid sesuai schema. Kalau field tidak terbaca, isi null. Semua angka dalam Rupiah sebagai INTEGER (tanpa pemisah ribuan, tanpa desimal).

Schema:
{
  "merchant": string | null,
  "transacted_at": ISO date | null  // YYYY-MM-DD; gunakan tanggal di struk
  "subtotal": int | null,
  "tax": int | null,
  "service_charge": int | null,
  "discount": int | null,           // positif (bukan negatif)
  "total": int,
  "currency": "IDR",
  "items": [
    { "name": string, "qty": number, "unit_price": int, "subtotal": int }
  ],
  "confidence": "high" | "medium" | "low"
}

Aturan:
- Kalau struk tidak terbaca jelas (blur/miring) → confidence: "low".
- Total HARUS terisi. Kalau total tidak terbaca, kembalikan total: 0 dan confidence: "low".
- Items boleh kosong [].
- Tanggal: bila hanya hari tanpa tahun, asumsikan tahun berjalan.
```

API call:

```ts
openai.chat.completions.create({
  model: 'gpt-4o-mini',
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Ekstrak data struk berikut.' },
        { type: 'image_url', image_url: { url: `data:${contentType};base64,${b64}`, detail: 'high' } },
      ],
    },
  ],
});
```

### 5.2 Output zod schema (in `packages/shared/src/receipts/`)

```ts
export const ReceiptOcrItem = z.object({
  name: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
});

export const ReceiptOcrResult = z.object({
  merchant: z.string().nullable(),
  transacted_at: z.string().nullable(),  // YYYY-MM-DD; api validates parse
  subtotal: z.number().int().nullable(),
  tax: z.number().int().nullable(),
  service_charge: z.number().int().nullable(),
  discount: z.number().int().nullable(),
  total: z.number().int().nonnegative(),
  currency: z.literal('IDR'),
  items: z.array(ReceiptOcrItem),
  confidence: z.enum(['high', 'medium', 'low']),
});
```

Worker validates with `.safeParse`. On failure:

- Log raw output + zod error.
- Build a best-effort partial result if `total` is parseable from raw; otherwise mark scan `failed` with reason `'parse_failed'`.

## 6. Push notifications

The worker-reminder push path is the canonical push pipeline (Expo Push API + `device_tokens` cleanup). Two options:

- **A.** worker-ai writes the Notification row + sends Expo push directly (duplicates worker-reminder's `expo-push.ts` logic).
- **B.** worker-ai enqueues a `receipts.ready-push` job on the `reminder` queue; worker-reminder handles the send.

**Locked: Option B** — keeps push logic in one place. Worker-ai is a producer to the `reminder` queue here. Worker-reminder adds two new job names:

```text
'receipts.ready-push'   { user_id, scan_id }
'receipts.failed-push'  { user_id, scan_id, reason }
```

Both handlers in worker-reminder follow the existing pattern (write Notification row + send push if user has devices, else skip). Copy:

- Ready: title `"Struk siap direview"`, body `"{merchant or 'Struk'} · Rp {total}"`.
- Failed: title `"Struk gagal dibaca"`, body `"Coba foto ulang atau pilih dari galeri."`.

Data payload: `{ kind, scan_id }` → mobile uses this to deep-link to the review screen.

## 7. R2 integration

### 7.1 Env vars

API + worker-ai both need R2 credentials (read for worker, write-presign for API):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=rapih-receipts
R2_PUBLIC_BASE=  # optional — only if bucket is public; we use presigned GET in this chunk so leave empty
```

### 7.2 SDK

Use `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. R2 endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.

`apps/api/src/lib/r2.ts`:

```ts
export function getR2Client(): S3Client { ... singleton }
export async function presignPut(key: string, contentType: string, sizeBytes: number): Promise<{ url: string; headers: Record<string, string> }>;
export async function headObject(key: string): Promise<{ exists: boolean; size: number; contentType: string }>;
export async function presignGet(key: string, ttlSeconds: number): Promise<string>;
```

Worker `apps/worker-ai/src/lib/r2.ts`:

```ts
export async function downloadAsBase64(key: string): Promise<{ b64: string; contentType: string }>;
```

### 7.3 Object naming

```
users/{user_id}/receipts/{scan_id}.{ext}
```

`ext` derived from `content_type` (`image/jpeg` → `jpg`, `image/png` → `png`, `image/heic` → `heic`).

### 7.4 Upload constraints (enforced by API)

- `content_type`: must be one of `image/jpeg`, `image/png`, `image/webp`, `image/heic`. Heic from iOS is allowed; worker re-encodes if OpenAI rejects (defer for now — if user reports issue, add `sharp` conversion).
- `size_bytes`: max 10 MB. Presigned URL only valid up to that size.
- Presigned URL TTL: 5 minutes.
- Presigned URL is single-use (R2 enforces this naturally via x-amz-signature; we additionally check `headObject` size matches at `finalize` time).

## 8. Shared types

New folder: `packages/shared/src/receipts/`.

```ts
// enums.ts
export const ReceiptScanStatusSchema = z.enum(['pending', 'processing', 'ready', 'consumed', 'failed']);
export const ReceiptScanSourceSchema = z.enum(['in_app', 'share_intent']);
export const ReceiptConsumeModeSchema = z.enum(['per_item', 'total']);

// ocr.ts — exports ReceiptOcrResult, ReceiptOcrItem (see § 5.2)

// schemas.ts
export const ReceiptScanDto = z.object({
  id: z.string(),
  status: ReceiptScanStatusSchema,
  source: ReceiptScanSourceSchema,
  content_type: z.string(),
  size_bytes: z.number().int(),
  ocr_result: ReceiptOcrResult.nullable(),
  failed_reason: z.string().nullable(),
  consumed_at: z.string().nullable(),
  created_at: z.string(),
});

export const CreateScanBody = z.object({
  source: ReceiptScanSourceSchema,
  content_type: z.string(),
  size_bytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

export const CreateScanResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    scan: ReceiptScanDto,
    upload: z.object({ url: z.string().url(), headers: z.record(z.string(), z.string()) }),
  }),
});

export const FinalizeScanResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scan: ReceiptScanDto }),
});

export const ListScansResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scans: z.array(ReceiptScanDto) }),
});

export const ScanDetailResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scan: ReceiptScanDto, image_url: z.string().url() }),
});

// Consume body — discriminated union by mode
export const ConsumeBodyPerItem = z.object({
  mode: z.literal('per_item'),
  wallet_id: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),         // BigInt wire format
      category_id: z.string(),
      transacted_at: z.string(),  // ISO date
      note: z.string().optional(),
    }),
  ).min(1),
});

export const ConsumeBodyTotal = z.object({
  mode: z.literal('total'),
  wallet_id: z.string(),
  category_id: z.string(),
  amount: z.string(),
  transacted_at: z.string(),
  note: z.string().optional(),
  merchant: z.string().optional(),
});

export const ConsumeBody = z.discriminatedUnion('mode', [ConsumeBodyPerItem, ConsumeBodyTotal]);

export const ConsumeResponse = z.object({
  ok: z.literal(true),
  data: z.object({ transaction_ids: z.array(z.string()) }),
});
```

Errors to add: `receipt.scan_not_found` (404), `receipt.upload_missing` (409, when finalize called before object exists), `receipt.invalid_state` (409, e.g. consume on non-ready), `receipt.already_consumed` (409), `receipt.size_exceeded` (413).

## 9. API endpoints

All wrapped with `onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus]`. Cross-user → 404.

```
POST   /receipts/scans                  body: CreateScanBody
                                        → { scan, upload: { url, headers } }
POST   /receipts/scans/:id/finalize     body: {} — signals upload done
                                        → { scan } with status='processing'
GET    /receipts/scans                  query: { status?, limit?: 1..200 }
                                        → { scans: ReceiptScanDto[] } (deleted_at IS NULL, desc by created_at)
GET    /receipts/scans/:id              → { scan, image_url: presigned-GET (TTL 5min) }
POST   /receipts/scans/:id/consume      body: ConsumeBody → { transaction_ids: string[] }
DELETE /receipts/scans/:id              soft-delete (allowed in any non-consumed state)
                                        → { ok: true }
```

### 9.1 `POST /receipts/scans` — handler outline

1. Validate `content_type` is in allowlist.
2. Insert `ReceiptScan { status: 'pending', source, r2_key: 'users/${user_id}/receipts/${scanId}.${ext}', content_type, size_bytes }`.
3. `presignPut(r2_key, content_type, size_bytes)` → `{ url, headers }`.
4. Return `{ scan, upload }`.

### 9.2 `POST /receipts/scans/:id/finalize` — handler outline

1. Look up scan by `id` + `user_id` + `deleted_at: null`.
2. Reject if `status !== 'pending'` → 409 `receipt.invalid_state`.
3. `headObject(scan.r2_key)`:
   - missing → 409 `receipt.upload_missing`
   - size mismatch → 409 `receipt.invalid_state` (with `reason: 'size_mismatch'`)
4. `$transaction`: update scan → `status: 'processing'`. Enqueue `ai.ocr-receipt` job on `ai` queue.
5. Return updated scan.

### 9.3 `POST /receipts/scans/:id/consume` — handler outline

1. Look up scan; reject if `status !== 'ready'` (404 if not found; 409 if wrong state).
2. Per mode:
   - **per_item**: For each item, build `Transaction { user_id, kind: 'expense', wallet_id, category_id, amount: BigInt(item.amount), note: item.note ?? item.name, transacted_at, receipt_scan_id: scan.id }`.
   - **total**: Build single `Transaction { ...same shape, note: note ?? merchant ?? 'Struk', amount: BigInt(amount), receipt_scan_id: scan.id }`.
3. `$transaction([ ...creates, update ReceiptScan { status: 'consumed', consumed_at: now } ])`.
4. Return `{ transaction_ids }`.

**Proportional tax/fee allocation**: not done server-side. Mobile computes adjusted line amounts before sending — server trusts the items as provided. Reasoning: mobile lets user tweak; server stays simple. (Documented contract: tax + service − discount must be reflected in the items the client sends.)

## 10. Worker — `ai.ocr-receipt` handler

`apps/worker-ai/src/handlers/ocr-receipt.ts`:

```ts
export async function handleOcrReceipt(job: Job<{ user_id: string; scan_id: string }>) {
  const { user_id, scan_id } = job.data;
  const scan = await prisma.receiptScan.findFirst({
    where: { id: scan_id, user_id, deleted_at: null },
  });
  if (!scan) throw new Error('scan_not_found');  // BullMQ will mark failed; no notif (orphan job)
  if (scan.status !== 'processing') return;       // idempotent — already handled

  try {
    const { b64, contentType } = await downloadAsBase64(scan.r2_key);
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_OCR_MODEL,  // default gpt-4o-mini
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: 'Ekstrak data struk berikut.' },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${b64}`, detail: 'high' } },
        ] },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = safeJsonParse(raw);
    const validated = ReceiptOcrResult.safeParse(parsed);
    if (!validated.success) {
      await markFailed(scan.id, 'parse_failed', { raw });
      await enqueueFailedPush(user_id, scan.id, 'parse_failed');
      return;
    }

    await prisma.receiptScan.update({
      where: { id: scan.id },
      data: { status: 'ready', ocr_result: validated.data as Prisma.InputJsonValue },
    });

    const usage = completion.usage;
    await prisma.aiUsageLog.create({
      data: {
        user_id, session_id: null, kind: 'ocr', model: env.OPENAI_OCR_MODEL,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        cost_usd: computeCost(env.OPENAI_OCR_MODEL, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      },
    });

    await enqueueReadyPush(user_id, scan.id);
  } catch (err) {
    logger.error({ err, scan_id }, 'ocr-receipt failed');
    await markFailed(scan.id, 'internal');
    await enqueueFailedPush(user_id, scan.id, 'internal');
    throw err;
  }
}
```

`enqueueReadyPush` / `enqueueFailedPush` add a job to the `reminder` queue (worker-ai becomes a producer for it). The worker-reminder code in this chunk gains two new handlers (`receipts.ready-push`, `receipts.failed-push`) that follow the existing push pattern.

OCR pricing entry in `cost.ts`: `gpt-4o-mini` (already there from Chunk A). Image tokens are billed by OpenAI based on `detail: 'high'` and image size — `usage.prompt_tokens` already includes image cost, so no special handling needed.

## 11. worker-reminder — two new push handlers

`apps/worker-reminder/src/jobs/receipts-ready-push.ts` and `receipts-failed-push.ts`:

- Per existing pattern (load user device tokens → if 0, skip without Notification row, else build push + write Notification row + send via `sendPushes`).
- Copy templates from § 6.
- Idempotency keys: `push:receipt-ready:{scan_id}` and `push:receipt-failed:{scan_id}` (TTL 7 days). Prevents double-push if the worker-ai job retries.

Register both in `worker-reminder/src/worker.ts` dispatcher map.

## 12. Mobile

### 12.1 Feature folder structure

```
apps/mobile/src/features/receipt/
  api.ts                        createScan, finalizeScan, listScans, getScan, consumeScan, deleteScan, uploadToR2
  receipt-store.ts              zustand: { scans, current, status, fetch, create, consume, ... }
  share-intent.ts               wires expo-share-intent; on incoming → upload + finalize + nav to review
  screens/
    scan-receipt-screen.tsx     entry — choose camera or gallery
    receipt-list-screen.tsx     "Inbox" — pending/ready/failed/consumed
    receipt-review-screen.tsx   editable form with per-item / total toggle
  components/
    receipt-card.tsx
    line-item-row.tsx
    allocation-summary.tsx      shows total, tax, service, discount, and live-recomputed per-item amounts
```

### 12.2 Image picker

Use `expo-image-picker`:

- Camera: `launchCameraAsync({ allowsEditing: false, quality: 0.85, base64: false, mediaTypes: 'Images' })`
- Gallery: `launchImageLibraryAsync({ allowsMultipleSelection: false, quality: 0.85, mediaTypes: 'Images' })`

After picking, read file size + content_type; call `createScan({ source: 'in_app', content_type, size_bytes })`; PUT bytes to `upload.url` with `upload.headers`; call `finalizeScan(id)`; navigate to receipt list (it will show the in-flight scan as `processing`).

### 12.3 Share intent

`expo-share-intent` setup in `app.config.ts`:

```ts
plugins: [
  ['expo-share-intent', { iosActivationRules: [{ NSExtensionActivationSupportsImageWithMaxCount: 1 }], androidIntentFilters: ['image/*'] }],
],
```

In root layout: `useShareIntent()` hook → on incoming image, if user logged in + Plus → run same upload flow; else cache locally, prompt on next launch. Show a toast: "Struk dikirim — kabari kalau selesai."

**Important:** this requires **EAS Dev Build** (`eas build --profile development`). Not available in Expo Go. Document this in `apps/mobile/README.md`.

### 12.4 Review screen

Layout:

- Top: receipt image thumbnail (tap → fullscreen) — uses `image_url` from `getScan`.
- Header row: merchant input (editable), transacted_at picker.
- Mode toggle: "Per item" | "Total".
- **Per item mode:**
  - List of line items (editable name, qty, unit_price; category per row; transacted_at default = receipt date).
  - Allocation summary at bottom: subtotal, +tax, +service, −discount = total.
  - Computed per-item amount = `round((item_subtotal / sum_subtotals) * (total))` per spec memory.
  - Last row absorbs residual integer cent (`total − sum(others)`).
  - Wallet picker (single, applies to all rows).
- **Total mode:**
  - Single amount field (default = `ocr_result.total`).
  - Category picker.
  - Wallet picker.
- "Simpan" button → calls `consumeScan(id, body)`.

### 12.5 Paywall

Free users entering the scan flow → render `<ScanPaywallCard />` (similar to TanyaPaywallCard). Plus check: `useAuthStore().user.tier !== 'free'`.

### 12.6 Notification deep-link

In `notifikasi-screen.tsx`, when item with `kind === 'receipt_ready'` or `'receipt_failed'` is tapped → `markRead([id])` + navigate to `/(app)/receipts/${data.scan_id}`.

Extend the `KIND_TO_VARIANT` + `TYPE_META` maps in `notifikasi-screen.tsx`:

```ts
receipt_ready:  variant 'review' (re-use), emoji '🧾'
receipt_failed: variant 'budget' (coral), emoji '⚠'
```

## 13. Environment

### 13.1 New vars

Root `.env.example`:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=rapih-receipts
```

`apps/api/.env.example` and `apps/worker-ai/.env.example`: same R2_* set.

`apps/worker-ai/.env.example` additionally: `OPENAI_OCR_MODEL=gpt-4o-mini` (defaults to same as chat).

### 13.2 Dev setup

Local dev can use **MinIO** as S3-compatible alternative (`docker compose` service `minio:RELEASE.2024-…`). Set `R2_ACCOUNT_ID` → not used in dev, endpoint override via `R2_ENDPOINT` (new optional env: if set, use it instead of constructing from account ID). Document in `apps/api/README.md`.

For tests: a `mock-r2.ts` that implements the `r2.ts` interface against an in-memory map.

## 14. Testing strategy

### 14.1 API tests (`apps/api/tests/receipts.test.ts`)

- auth/onboarding/tier guards (3 sanity tests)
- create scan returns presigned URL with correct content_type + max-size header
- finalize without upload → 409 `receipt.upload_missing` (mock R2 HEAD returns missing)
- finalize succeeds → status='processing' + ai-queue gains job (verify via `aiQueue.getJob`)
- list scans: filters by status, soft-deleted excluded, cross-user excluded
- get scan: returns presigned GET image_url; cross-user 404
- consume (per-item): inserts N transactions + sets consumed_at + transactions linked via receipt_scan_id
- consume (total): inserts 1 transaction
- consume on non-ready → 409
- consume twice → second returns 409 `receipt.already_consumed`
- delete on consumed → still allowed (soft-delete); on processing → allowed (will orphan the job — accepted)

R2 mocked at the `lib/r2.ts` module boundary.

### 14.2 Worker tests (`apps/worker-ai/tests/ocr-receipt.test.ts`)

- Happy path: scripted OpenAI returns valid JSON → status='ready', ocr_result persisted, AiUsageLog written, reminder queue gains `receipts.ready-push` job
- Parse failure: OpenAI returns malformed JSON → status='failed' with reason='parse_failed', failed-push enqueued
- Zod failure: OpenAI returns JSON missing `total` → status='failed' with reason='parse_failed'
- Scan in wrong state (status='ready' already): handler returns early (idempotent)
- Scan deleted: handler throws scan_not_found (BullMQ marks failed; no push)
- OpenAI throws: status='failed' reason='internal', failed-push enqueued
- Cost log: tokens recorded correctly

R2 download mocked. OpenAI client injected via `__setOpenAiForTests` (from Chunk A).

### 14.3 worker-reminder tests (add to existing suite)

- `receipts-ready-push.test.ts`: writes Notification(kind='receipt_ready'); sends Expo push with correct payload; idempotency key prevents double-push.
- `receipts-failed-push.test.ts`: same shape but `kind='receipt_failed'`.

### 14.4 Mobile

Manual smoke test only. Checklist:

- Free user → paywall on scan screen.
- Plus user, camera → take photo → list shows `processing` chip → wait → notif arrives → tap notif → review screen opens.
- Plus user, gallery → same.
- Per-item mode: edit items, allocation summary recomputes live; save → check API call payload includes adjusted amounts.
- Total mode: save → 1 transaction created.
- Share intent (requires Dev Build): share image from Photos → app receives → upload → notif arrives.
- Failed scan: feed it a non-receipt image → wait → notif "Struk gagal dibaca" → tap → review screen shows failure state with "Coba ulang" button (re-upload).

## 15. Deployment

No new service. `worker-ai` already deployed for Chunk A — Chunk B only adds a new handler + R2 deps.

API gets R2 envs in Dokploy; worker-ai too. R2 bucket created out-of-band; access keys stored in Dokploy secrets.

## 16. Rollout order

1. `packages/db` migration `add_receipt_scans` (+ enum extension on `NotificationKind`).
2. `packages/shared` — receipts types + OCR result + error codes.
3. R2 lib in `apps/api/src/lib/r2.ts` + env vars.
4. `apps/api` — `/receipts/scans` REST routes + tests.
5. `apps/worker-ai` — `ai.ocr-receipt` handler + R2 download lib + tests + register dispatcher.
6. `apps/worker-reminder` — `receipts.ready-push`, `receipts.failed-push` handlers + tests + dispatcher.
7. `apps/mobile` — receipt feature folder, screens, share intent (EAS Dev Build doc).
8. Update Spine Feature Atlas: `scan-struk OCR` → done.

Branch: `feat/worker-ai-scan-struk` (from main, after Chunk A is merged).

## 17. Open questions (deferred)

- HEIC re-encoding via `sharp` if OpenAI rejects — defer until reported.
- Multi-page receipts (long thermal prints) — defer; v1 = single image.
- R2 cleanup job for soft-deleted scans (free up storage) — defer to a later cron in worker-reminder.
- OCR retry button in mobile review screen — calls a new `POST /receipts/scans/:id/retry` that resets status to processing + re-enqueues; defer to UX feedback round.
- Receipt sharing between users (e.g. household) — out of scope for v1.
- Auto-categorization (LLM suggests `category_id`) — needs category list passed in prompt; defer.

---

## Appendix A — File checklist

**packages/db:**
- [ ] `prisma/schema.prisma` — add `ReceiptScan`, `ReceiptScanStatus`, `ReceiptScanSource`, `Transaction.receipt_scan_id`, `User.receipt_scans`, `NotificationKind` += `receipt_ready`, `receipt_failed`
- [ ] migration `add_receipt_scans`

**packages/shared:**
- [ ] `src/receipts/enums.ts`
- [ ] `src/receipts/ocr.ts`
- [ ] `src/receipts/schemas.ts`
- [ ] `src/receipts/index.ts`
- [ ] `src/index.ts` — add receipts export
- [ ] `src/errors.ts` — add `receipt.*` codes

**apps/api:**
- [ ] `src/config/env.ts` — R2_* vars
- [ ] `src/lib/r2.ts`
- [ ] `src/routes/receipts.ts` (6 endpoints)
- [ ] `src/routes/index.ts` — register
- [ ] `src/plugins/swagger.ts` — `receipts` tag
- [ ] `tests/helpers/test-db.ts` — TRUNCATE `receipt_scans`
- [ ] `tests/helpers/mock-r2.ts`
- [ ] `tests/receipts.test.ts`

**apps/worker-ai:**
- [ ] `src/config/env.ts` — R2_*, OPENAI_OCR_MODEL
- [ ] `src/lib/r2.ts` — download helper
- [ ] `src/handlers/ocr-receipt.ts`
- [ ] `src/handlers/ocr-system-prompt.ts`
- [ ] `src/server.ts` — register `ai.ocr-receipt`
- [ ] producer to `reminder` queue (mirror `queues/ai.ts` shape but `Queue('reminder')`)
- [ ] `tests/ocr-receipt.test.ts`

**apps/worker-reminder:**
- [ ] `src/jobs/receipts-ready-push.ts`
- [ ] `src/jobs/receipts-failed-push.ts`
- [ ] `src/worker.ts` — dispatcher entries
- [ ] `tests/receipts-ready-push.test.ts`
- [ ] `tests/receipts-failed-push.test.ts`

**apps/mobile:**
- [ ] `app.config.ts` — `expo-share-intent` plugin
- [ ] `src/features/receipt/api.ts`
- [ ] `src/features/receipt/receipt-store.ts`
- [ ] `src/features/receipt/share-intent.ts`
- [ ] `src/features/receipt/screens/scan-receipt-screen.tsx`
- [ ] `src/features/receipt/screens/receipt-list-screen.tsx`
- [ ] `src/features/receipt/screens/receipt-review-screen.tsx`
- [ ] `src/features/receipt/components/receipt-card.tsx`
- [ ] `src/features/receipt/components/line-item-row.tsx`
- [ ] `src/features/receipt/components/allocation-summary.tsx`
- [ ] `src/features/receipt/components/scan-paywall-card.tsx`
- [ ] `src/features/profile/screens/notifikasi-screen.tsx` — extend KIND_TO_VARIANT + tap handler
- [ ] root layout — wire `useShareIntent`
- [ ] `README.md` — EAS Dev Build note for share intent

**docs:**
- [ ] Update Spine Feature Atlas: `scan-struk OCR` → done
