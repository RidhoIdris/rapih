# Domain CRUD pattern

> **Purpose:** the cookbook for adding a new user-data resource (categories, transactions, goals, budgets, assets, etc.) end-to-end (DB → backend → mobile). The canonical reference implementation is **wallets** — read those files alongside this guide.
>
> Authoritative spec: Spine § 5A. This file is the recipe.

## Inputs you need before starting

1. **Resource name** (singular + plural): e.g. `category` / `categories`.
2. **Field list**: what columns the table needs.
3. **Money fields**: which (if any) are `BigInt` cents.
4. **Enums**: any constrained values (e.g. transaction `kind: 'expense' | 'income' | 'transfer'`).
5. **Foreign keys**: links to other resources (e.g. transaction → wallet, transaction → category). Always index FKs.

## Reference files (read these)

| Layer | File |
|---|---|
| Schema | `packages/db/prisma/schema.prisma` (model `Wallet`) |
| Shared enums | `packages/shared/src/wallets/enums.ts` |
| Shared schemas + DTO | `packages/shared/src/wallets/schemas.ts` |
| Shared barrel | `packages/shared/src/wallets/index.ts` |
| Error code | `packages/shared/src/errors.ts` (`wallet.not_found`) |
| Backend DTO mapper | `apps/api/src/lib/wallet-dto.ts` |
| Backend route | `apps/api/src/routes/wallets.ts` |
| Backend tests | `apps/api/tests/wallets.test.ts` |
| Swagger tag | `apps/api/src/plugins/swagger.ts` |
| Mobile API client | `apps/mobile/src/features/wallet/api.ts` |
| Mobile store | `apps/mobile/src/features/wallet/wallet-store.ts` |
| Mobile screens | `apps/mobile/src/features/wallet/screens/*.tsx` |

## Step-by-step

### 1. Database

Edit `packages/db/prisma/schema.prisma`:

```prisma
enum {ResourceEnum} { ... }   // if needed

model {Resource} {
  id           String    @id @default(cuid())
  user_id      String
  // resource-specific fields here.
  // BigInt for money (no defaults except 0). Indexed FKs for any wallet_id/category_id/etc.
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?

  user         User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, deleted_at])
  @@map("{resources}")
}
```

Add the relation back-reference on `User`: `{resources}  {Resource}[]`.

Generate migration (inspect SQL before applying):

```bash
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate dev --name add_{resources} --create-only

# inspect packages/db/prisma/migrations/<ts>_add_{resources}/migration.sql

DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate deploy

# also apply to test DB
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih_test' \
  pnpm --filter @rapih/db exec prisma migrate deploy
```

Rebuild the client:

```bash
DATABASE_URL='postgresql://x:x@localhost/x' pnpm --filter @rapih/db build
```

### 2. Shared types

Create `packages/shared/src/{resource}/`:

**`enums.ts`** — zod enum + Bahasa Indonesia label map (matches Prisma enum 1:1).

**`schemas.ts`** — copy the wallet template:
- `MoneyString` zod helper if any field is money.
- `Create{Resource}Body` (all required fields).
- `Update{Resource}Body` (all optional + `.refine((o) => Object.keys(o).length > 0)` to reject empty body).
- `{Resource}Dto` (full read shape — money as string, dates as ISO).
- `{Resource}Response = z.object({ ok: z.literal(true), data: z.object({ {resource}: {Resource}Dto }) })`.
- `{Resource}ListResponse = z.object({ ok: z.literal(true), data: z.object({ {resources}: z.array({Resource}Dto) }) })`.

**`index.ts`** — barrel:
```ts
export * from './enums.js';
export * from './schemas.js';
```

Update `packages/shared/src/index.ts`:
```ts
export * from './{resource}/index.js';
```

Add error code in `packages/shared/src/errors.ts`:
```ts
'{resource}.not_found': 'Tidak ditemukan.',
```

Build:
```bash
pnpm --filter @rapih/shared build
```

### 3. Backend — DTO mapper

`apps/api/src/lib/{resource}-dto.ts`:

```ts
import type { {Resource} } from '@rapih/db';
import type { {Resource}Dto } from '@rapih/shared';

export function {resource}ToDto(row: {Resource}): {Resource}Dto {
  return {
    id: row.id,
    // Map every DTO field. BigInt → .toString(). Date → .toISOString().
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
```

### 4. Backend — route plugin

`apps/api/src/routes/{resources}.ts`:

```ts
import {
  Create{Resource}Body,
  Update{Resource}Body,
  {Resource}ListResponse,
  {Resource}Response,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { {resource}ToDto } from '../lib/{resource}-dto.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const {resources}Routes: FastifyPluginAsyncZod = async (app) => {
  // Always wrap with onRequest: [app.authenticate, app.requireOnboarding]
  // Always scope queries by req.user.id and filter deleted_at: null.
  // Cross-user access returns 404, not 403.
  // Convert money strings to BigInt(...) before passing to Prisma.
  // Never allow user_id in the request body — derive from req.user.id only.
  ...
};
```

Use `apps/api/src/routes/wallets.ts` verbatim as the starting template — copy it, search-and-replace `wallet`/`Wallet`. The five endpoint shapes (list, create, get, update, delete) are mechanical.

Register in `apps/api/src/routes/index.ts`:
```ts
await app.register({resources}Routes);
```

Add Swagger tag in `apps/api/src/plugins/swagger.ts`:
```ts
{ name: '{resources}', description: '...' },
```

### 5. Backend — tests

`apps/api/tests/{resources}.test.ts`. Copy `wallets.test.ts`, search-and-replace, adjust per resource. Cover all 12 cases:

1. GET 401 without bearer
2. GET 403 without onboarding
3. GET empty list
4. POST happy path
5. POST with edge values (e.g. negative money for liability accounts)
6. POST validation rejection
7. GET single happy
8. GET cross-user → 404
9. PATCH happy
10. PATCH empty body → 400
11. DELETE soft + list omits
12. DELETE already-deleted → 404

Run:
```bash
pnpm --filter @rapih/api test {resources}
```

### 6. Mobile — API client

`apps/mobile/src/features/{resource}/api.ts`:

```ts
import type { Create{Resource}Body, Update{Resource}Body, {Resource}Dto, {Resource}ListResponse, {Resource}Response } from '@rapih/shared';
import { apiRequest } from '@/lib/api';

type ListData = {Resource}ListResponse['data'];
type OneData = {Resource}Response['data'];

export async function list{Resources}(): Promise<{Resource}Dto[]> { ... }
export async function get{Resource}(id: string): Promise<{Resource}Dto> { ... }
export async function create{Resource}(body: Create{Resource}Body): Promise<{Resource}Dto> { ... }
export async function update{Resource}(id: string, body: Update{Resource}Body): Promise<{Resource}Dto> { ... }
export async function delete{Resource}(id: string): Promise<void> { ... }
```

### 7. Mobile — Zustand store

`apps/mobile/src/features/{resource}/{resource}-store.ts` — copy `wallet-store.ts`. State shape:

```ts
{
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  items: {Resource}Dto[];
  fetch: () => Promise<void>;
  create: (body) => Promise<{Resource}Dto>;
  update: (id, body) => Promise<{Resource}Dto>;
  remove: (id) => Promise<void>;
}
```

### 8. Mobile — screens

Wire existing screens (or new ones) to the store:
- `useEffect(() => { void store.fetch(); }, [])` on the list screen.
- `<ScrollView refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={...} />}>` for pull-to-refresh.
- Empty-state Bahasa Indonesia copy.
- For navigation with params, use querystring:
  ```ts
  router.push(`/(app)/foo?id=${encodeURIComponent(id)}` as Href);
  ```
- Read params: `useLocalSearchParams<{ id?: string }>()`.

### 9. Verify

```bash
pnpm --filter @rapih/shared check
pnpm --filter @rapih/db check
pnpm --filter @rapih/api check
pnpm --filter @rapih/api test
pnpm --filter @rapih/mobile check
```

All green = ready to commit.

### 10. Commit

```
feat(domain-crud-{resources}): {resource} CRUD endpoints + mobile wire-up
```

Update Spine § 14 Feature Atlas: mark the row `done`.

## Common pitfalls

- **Forgot to apply migration to test DB** — `auth-upsert-user` and other DB tests will fail with "table does not exist".
- **Sending bare BigInt over JSON** — `JSON.stringify` throws. Always `.toString()` server-side.
- **Money parsed with `Number()` server-side** — loses precision for amounts > `Number.MAX_SAFE_INTEGER` cents (~90 trillion IDR; practically fine, but use `BigInt(s)` anyway for liability-style negatives and future-proofing).
- **Trusting `user_id` from request body** — never. Always derive from `req.user.id`.
- **Cross-user existence leak** — wallet of another user must return 404, not 403.
- **`router.push({ pathname, params })`** in mobile — typed-routes errors. Use querystring.
- **Forgot to add `export *` in `packages/shared/src/index.ts`** — `@rapih/shared` consumers won't see your new types.
- **Forgot to rebuild `@rapih/shared`** — `apps/api` will error on import.

## When to deviate

Spine § 5A is locked. Don't deviate without first updating that section. Common legitimate deviations need explicit Spine entries:

- Resource scoped to multi-tenant workspace (not just user) — needs Spine § 18 multi-workspace decision first.
- Reference data (no `user_id`, hard-deleted) — note in spec, e.g. system categories.
- Resource needs ordering (e.g. user-defined sort) — add `position: Int` field, document in resource spec.
