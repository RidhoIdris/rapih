# Rapih Backend Architecture Spine

**Status:** living document · **Last updated:** 2026-05-20 · **Owner:** @ridhoidris

This Spine is the **single source of truth for cross-cutting backend decisions**. Every sub-project spec (api-foundation, domain-crud, ai-worker, reminder-worker, cms, billing) MUST reference this doc and MUST NOT redecide anything captured here.

A future Claude session (possibly a weaker model) should be able to extend this codebase by reading: **this Spine + the relevant sub-project spec + the relevant `AGENTS.md`**. If a recurring question keeps coming up in sessions, the answer belongs in this Spine.

---

## 1. What Rapih Is (TL;DR)

Personal-finance SaaS for Indonesian Gen-Z. Mobile app (Expo) is the primary client; web PWA mirrors it. **No bank/e-wallet/broker integration** — all data is manual entry (or scan struk OCR, which is OCR-assisted manual). Tiers: **Free / Plus / Pro** (feature mapping TBD, see Feature Atlas).

CMS is **for the operator (Ridho) only**, not user-facing. Single admin login via env credentials.

## 2. Stack (locked)

| Concern | Choice | Notes |
|---|---|---|
| API framework | **Fastify v5** | Plugin pattern. TypeScript. |
| Language | **TypeScript** strict | Match mobile/web. |
| Database | **PostgreSQL 17** | Hosted as a separate Dokploy service. |
| ORM / Migrations | **Prisma 6** | `packages/db` owns schema + client. |
| Cache / Queue broker | **Redis 7** | Separate Dokploy service. |
| Job queue | **BullMQ** | On top of Redis. |
| Auth (own) | **Custom JWT** | Access (15min) + refresh (rotating, 30d). Argon2id for password. |
| Social auth | **Google Sign-In + Apple Sign-In** | Verify identity token against provider JWKS. Apple wajib (App Store 4.8). |
| Email | **Resend** | Transactional only. |
| Push notifications | **Expo Push API** | Mobile is Expo. |
| AI / LLM | **OpenAI** | GPT-4o-mini for chat & vision. Same provider handles OCR (no separate OCR engine). |
| Payment (web / Android) | **Mayar.id** | Webhook-based. Implementation = phase 2. |
| Payment (iOS) | **Apple IAP** | Required by App Store 3.1.1. Implementation = phase 3. |
| Payment (v0) | **Manual via CMS** | Admin sets `user.tier` directly. |
| CMS framework | **Next.js 16 + shadcn/ui** | Same stack as `apps/web`. |
| Deploy | **Dokploy** (self-hosted) | One Dockerfile per app. DB + Redis = separate Dokploy services. |
| Test runner | **Vitest** | Same in API and workers. |
| Lint / format | **Biome** | Single tool, fast. (Replaces eslint + prettier.) |

**Do not change any of the above without updating this Spine first.**

## 3. Monorepo Layout

```
apps/
  api/                 Fastify HTTP API (main backend)
  admin/               Next.js 16 CMS (single admin via env)
  worker-ai/           BullMQ worker → OpenAI (Tanya, OCR, suggestions)
  worker-reminder/     BullMQ worker → cron jobs, push notif
  mobile/              [existing] Expo RN client
  web/                 [existing] Next.js PWA
packages/
  db/                  Prisma schema + generated client (used by api, admin, workers)
  shared/              Zod schemas, shared TS types, error codes, job names
  config/              Biome config, tsconfig base, dockerfile base
```

**Rules:**
- `apps/*` may depend on `packages/*`. `packages/*` MUST NOT depend on `apps/*`.
- Workers do **not** import from `apps/api`. Shared logic goes to `packages/shared` or `packages/db`.
- Mobile and web do **not** import from `packages/db` (no Prisma client in client bundles). They use zod schemas + types from `packages/shared`.

## 4. Database Conventions

- **Naming:** `snake_case`, plural tables (`users`, `transactions`).
- **Primary key:** `id` = `cuid()` string (Prisma `@default(cuid())`). No autoincrement.
- **Foreign key:** `{singular}_id` (e.g. `user_id`, `wallet_id`). Always indexed.
- **Audit columns:** every table has `created_at`, `updated_at` (Prisma `@default(now())` + `@updatedAt`).
- **Soft delete:** only on user-data tables (transactions, wallets, goals, etc.). Column `deleted_at: DateTime?`. Reference data (categories) is hard-deleted.
- **Multi-tenant scoping:** every user-data table has `user_id` indexed. Every query in API MUST scope by `user_id` from the JWT. Never trust client-provided `user_id`. There is a Prisma middleware `withUserScope` that enforces this — use it.
- **Money:** stored as `BigInt` cents (IDR has no cents but we keep `BigInt` for safety/flexibility). Never use `Float`. Helper `formatRupiah()` in `packages/shared/money.ts`.
- **Migrations:** `prisma migrate dev` locally, `prisma migrate deploy` in CI/runtime startup. Migrations committed to repo.

## 5. Auth Model

### 5.1 Identity

- **Table `users`**: `id`, `email` (unique, citext), `email_verified_at`, `password_hash` (nullable for social-only users), `name`, `tier` (`'free' | 'plus' | 'pro'`), `apple_private_relay` (bool, true if email is `@privaterelay.appleid.com`).
- **Table `social_accounts`**: `id`, `user_id`, `provider` (`'google' | 'apple'`), `provider_user_id`, `created_at`. Unique `(provider, provider_user_id)`.
- **Table `refresh_tokens`**: `id`, `user_id`, `token_hash` (sha256), `expires_at`, `revoked_at`, `replaced_by_id` (for rotation chain), `created_at`, `device_label` (string, optional).
- **Table `email_verification_tokens`**: `id`, `user_id`, `token_hash`, `expires_at`, `used_at`.
- **Table `password_reset_tokens`**: `id`, `user_id`, `token_hash`, `expires_at`, `used_at`.

### 5.2 Tokens

- **Access token**: JWT, HS256, secret `JWT_ACCESS_SECRET`. Claims: `sub` (user_id), `tier`, `iat`, `exp` (15 min). Sent in `Authorization: Bearer <jwt>`.
- **Refresh token**: opaque random 32-byte hex, sent in body of `/auth/refresh`. Stored hashed (sha256) in `refresh_tokens`. Rotated on every refresh — old token marked `revoked_at` + `replaced_by_id`. Reuse of revoked token = invalidate the whole chain (potential theft).
- **Tier claim staleness:** acceptable because access token TTL is 15 min. Tier changes via CMS take effect on next refresh. For instant effect (rare), revoke all refresh tokens for that user.

### 5.3 Endpoints (locked)

```
POST /auth/register                  email+password+name → 201, {access, refresh, user}
POST /auth/login                     email+password      → {access, refresh, user}
POST /auth/refresh                   refresh             → {access, refresh}
POST /auth/logout                    refresh             → 204 (revokes refresh chain)
POST /auth/verify-email              token               → 204
POST /auth/resend-verification       email               → 204 (always 204, no enumeration)
POST /auth/forgot-password           email               → 204 (always 204)
POST /auth/reset-password            token+newPassword   → 204 (revokes all refresh tokens)
POST /auth/google                    google_id_token     → {access, refresh, user}
POST /auth/apple                     apple_id_token,     → {access, refresh, user}
                                     {firstName,lastName}?
GET  /auth/me                        (bearer)            → user (full profile)
```

### 5.4 Email verification policy

- Email/password signup → email NOT verified. User can use app, but features that send email (e.g. password reset, future shared workspaces) check `email_verified_at`.
- Banner in mobile if not verified.
- Social signup (Google/Apple) → email auto-verified (provider already verified).
- Apple private relay email: still `email_verified_at = now()` because Apple guarantees it.

### 5.5 Password rules

- Argon2id, default params (`memoryCost: 19456, timeCost: 2, parallelism: 1`).
- Minimum 8 chars. No max. No complex rules (modern guidance: length > complexity).

## 6. Tier Gating

- `user.tier` is the source of truth (denormalized for fast reads).
- Subscription tables track billing history; tier is computed from active subscription + manual overrides.
- **Helper**: `assertTier(req, 'plus')` — throws `TIER_INSUFFICIENT` (403) if `user.tier` is below required. Used in route handlers.
- **Order**: `free` < `plus` < `pro`. Pro implies Plus.
- **Manual override** via CMS: sets `user.tier` directly + writes `tier_overrides` audit row with reason. Override expires `expires_at` (nullable for permanent comp).

## 7. Response Envelope

All API responses:

**Success:**
```json
{ "ok": true, "data": <T> }
```

**Error:**
```json
{ "ok": false, "error": { "code": "auth.invalid_credentials", "message": "Email atau password salah.", "details": {...} } }
```

- `code`: dotted snake_case, namespaced by domain. Defined in `packages/shared/errors.ts` as a string union.
- `message`: Bahasa Indonesia, user-facing. Mobile may override with its own copy.
- HTTP status follows REST: 400 validation, 401 unauthenticated, 403 forbidden/tier, 404 not found, 409 conflict, 422 business rule, 500 unexpected.
- Validation errors: `code = "validation.failed"`, `details = { fields: { fieldName: 'message' } }`.

## 8. Validation

- **Zod** schemas in `packages/shared/schemas/*`. Each route imports its schema.
- Fastify plugin `withSchema(schema)` validates body/query/params; rejects with `validation.failed` envelope.
- The same zod schema is exported to mobile/web for client-side validation (single source of truth).

## 9. Env & Secrets

- Naming: `SCREAMING_SNAKE`, prefixed by domain. Examples:
  ```
  NODE_ENV
  DATABASE_URL
  REDIS_URL
  JWT_ACCESS_SECRET
  JWT_ACCESS_TTL_SECONDS         (default 900)
  JWT_REFRESH_TTL_SECONDS        (default 2592000)
  OPENAI_API_KEY
  OPENAI_MODEL_CHAT              (default gpt-4o-mini)
  OPENAI_MODEL_VISION            (default gpt-4o-mini)
  RESEND_API_KEY
  RESEND_FROM                    e.g. "Rapih <noreply@rapih.app>"
  EXPO_ACCESS_TOKEN              for Expo Push
  GOOGLE_OAUTH_CLIENT_IDS        comma-separated (ios, android, web)
  APPLE_OAUTH_CLIENT_IDS         comma-separated (mobile bundle ids)
  APPLE_TEAM_ID
  APPLE_KEY_ID
  APPLE_PRIVATE_KEY              base64 (for native Apple sign-in revocation)
  MAYAR_API_KEY                  (phase 2)
  MAYAR_WEBHOOK_SECRET           (phase 2)
  ADMIN_EMAIL                    CMS login (one admin)
  ADMIN_PASSWORD_HASH            argon2id hash, generated via script
  APP_PUBLIC_URL                 e.g. https://rapih.app (for email links)
  API_PUBLIC_URL                 e.g. https://api.rapih.app
  ```
- `.env.example` committed at repo root with non-secret defaults.
- Real secrets injected by Dokploy at runtime.

## 10. Async Jobs

- **Tech:** BullMQ on Redis. Queues defined in `packages/shared/jobs.ts` as string constants. Job payloads typed via zod schema.
- **Idempotency:** every job payload includes an `idempotency_key`. Workers check a `processed_jobs` table (or Redis SET) before executing. Safe to retry.
- **Retries:** BullMQ default exponential backoff, max 5 retries. Failed jobs go to `failed` set; CMS has a "failed jobs" page (Phase 1.5).
- **Queue naming:** `<domain>.<action>` — e.g. `ai.chat-completion`, `ai.ocr-receipt`, `reminder.recurring-create`, `reminder.push-send`, `reminder.weekly-review-gen`.

### 10.1 worker-ai jobs

- `ai.chat-completion` — one turn of Tanya. Streams tokens back via SSE (API holds the SSE connection; worker writes to a Redis pubsub channel keyed by `session_id`; API forwards).
- `ai.ocr-receipt` — given an image URL (uploaded to S3-compatible storage or a local path), call OpenAI vision, parse to structured `ReceiptDraft` JSON, write to DB, push result via SSE channel.
- `ai.weekly-review-gen` — generate the 5-page weekly review story content (text + numbers) for one user. Triggered by `reminder.weekly-review-cron`.

### 10.2 worker-reminder jobs

- `reminder.recurring-create-cron` — runs daily 00:05 WIB. Finds `recurring_transactions` with `next_run_at <= now()`, creates the transaction, advances `next_run_at`.
- `reminder.push-due-cron` — runs hourly. Sends push for upcoming due transactions, goal nudges.
- `reminder.streak-nudge-cron` — runs daily ~20:00 WIB. Pushes "jangan putus streak" if user hasn't logged a tx today.
- `reminder.weekly-review-cron` — runs Sunday night. Enqueues `ai.weekly-review-gen` per active user.
- `reminder.push-send` — generic single push send (called from any worker).

## 11. Push Notifications

- `device_tokens` table: `id`, `user_id`, `expo_push_token`, `platform` ('ios' | 'android'), `last_seen_at`. Unique on `expo_push_token`.
- Mobile registers token on login + on app open. API endpoint `POST /devices/register`.
- Worker-reminder batches push via Expo Push API (chunks of 100). Errors (`DeviceNotRegistered`) → mark token inactive.

## 12. Payment (Phased)

### Phase 0 (v0, current)

- No payment integration. Tier upgrades via CMS only.
- `subscriptions` table exists with `provider = 'manual'`.

### Phase 1 (web + Android) — Mayar.id

- CMS exposes "create checkout link" → calls Mayar.id, returns hosted checkout URL.
- Mayar webhook → `POST /webhooks/mayar` (HMAC verified via `MAYAR_WEBHOOK_SECRET`).
- On `payment.received`: upsert `subscriptions` row, update `user.tier`, send confirmation email.
- On `payment.refunded` / subscription cancel: downgrade tier on `expires_at`.

### Phase 2 (iOS) — Apple In-App Purchase

- Mobile triggers IAP via `expo-in-app-purchases` (or RN equivalent).
- After purchase, mobile sends Apple receipt to `POST /payments/apple/verify`.
- API verifies receipt via App Store Server API, writes `subscriptions` row with `provider = 'apple'`, updates `user.tier`.
- Apple Server-to-Server notifications → `POST /webhooks/apple` for renewals / cancellations.

### Schema (provider-agnostic, phase 0 onwards)

```
subscriptions(
  id, user_id, provider ('manual'|'mayar'|'apple'),
  provider_subscription_id, tier ('plus'|'pro'),
  status ('active'|'past_due'|'canceled'|'expired'),
  started_at, current_period_end, canceled_at,
  raw_provider_data Json,
  created_at, updated_at
)

tier_overrides(
  id, user_id, tier, reason, expires_at?, created_by, created_at
)
```

`user.tier` is updated by a function `recomputeUserTier(user_id)` that picks the highest active source: override > subscription > 'free'. Called after any subscription/override write.

## 13. Deployment (Dokploy)

- 4 apps each have own `Dockerfile` at `apps/<name>/Dockerfile`.
- Dockerfile pattern (each):
  1. **Stage 1 (deps):** `node:22-alpine`, copy `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`. Run `pnpm install --frozen-lockfile`.
  2. **Stage 2 (builder):** Use `turbo prune --scope=<app>` to extract only what this app needs, then `pnpm build` for that scope.
  3. **Stage 3 (runner):** `node:22-alpine`, copy pruned `node_modules` + built output. CMD = `node dist/server.js` (or equivalent).
- **Health endpoint:** every app exposes `GET /health` returning `{ ok: true, service: '<name>' }`. Dokploy uses this for health checks.
- **Migrations:** `apps/api` runs `prisma migrate deploy` in its entrypoint before starting the server. Workers and admin do NOT run migrations.
- **Postgres & Redis:** Dokploy-managed services. Connection URLs injected via env.
- **Reverse proxy / TLS:** Dokploy handles.

## 14. Feature Atlas

Status: **todo** = not started · **wip** = in progress · **done** = shipped · **planned** = decided but later

Sub-project owner: which sub-project spec will design & implement this. See § 16 for sub-project list.

| Feature | Owner | Tier | Deps | Status |
|---|---|---|---|---|
| email signup + login | api-foundation | Free | — | todo |
| jwt access + refresh | api-foundation | Free | — | todo |
| email verification | api-foundation | Free | resend | todo |
| forgot / reset password | api-foundation | Free | resend | todo |
| google sign-in | api-foundation | Free | — | todo |
| apple sign-in | api-foundation | Free | — | todo |
| device token register | api-foundation | Free | — | todo |
| admin login (env) | cms-basics | — | api-foundation | todo |
| admin user list / detail | cms-basics | — | api-foundation | todo |
| admin tier override | cms-basics | — | api-foundation | todo |
| admin category CRUD | cms-basics | — | api-foundation | todo |
| categories (system + user) | domain-crud | Free | api-foundation | todo |
| wallets (dompet) CRUD | domain-crud | Free | api-foundation | todo |
| transactions CRUD | domain-crud | Free | wallets, categories | todo |
| recurring (rutin) CRUD | domain-crud | Free | transactions | todo |
| budgets (envelope) CRUD | domain-crud | Free | categories | todo |
| goals CRUD | domain-crud | Free | wallets | todo |
| assets CRUD | domain-crud | Plus | — | todo |
| receipts (struk metadata) | domain-crud | Free | transactions | todo |
| tanya chat (AI) | ai-worker | Plus | api-foundation | todo |
| tanya quota tracking | ai-worker | Plus | tanya | todo |
| scan-struk OCR | ai-worker | Plus | receipts | todo |
| recurring auto-create (cron) | reminder-worker | Free | recurring | todo |
| due / goal push notif | reminder-worker | Free | device tokens | todo |
| streak nudge push | reminder-worker | Free | transactions | todo |
| weekly review story gen | reminder-worker | Pro | transactions | todo |
| manual tier upgrade (CMS) | cms-basics | — | subscriptions | todo |
| mayar checkout + webhook | billing-web | — | subscriptions | planned |
| apple iap verify + webhook | billing-ios | — | subscriptions | planned |

**Tier mapping is provisional.** Update this column as decisions firm up. The "TBD" answer is also valid — leave blank if not decided.

## 15. Sub-projects (build order)

Each gets its own design spec in `docs/superpowers/specs/`, then its own plan in `docs/superpowers/plans/`. Specs are small and reference this Spine.

1. **api-foundation** — scaffold `apps/api`, Prisma + initial migrations (users, auth tables, sessions, devices), JWT auth, email/password + Google + Apple + email-verify + password-reset, `/auth/me`, `/devices/register`, health endpoint, Resend wiring, error envelope plumbing, response/validation helpers, Dockerfile, deployable to Dokploy. Includes one trivial protected endpoint (e.g. `/me/profile` update) to prove the pattern.
2. **cms-basics** — scaffold `apps/admin` (Next.js 16 + shadcn), single-admin env login, layout shell, user list + detail + tier override, category CRUD, manual tier upgrade UI. No fancy features — just enough to operate.
3. **domain-crud** — categories (system seeded + user custom), wallets, transactions (incl. receipt FK for scan-struk linking), recurring (incl. `next_run_at`), budgets, goals, assets. Each likely its own small plan, but they share a sub-project spec for conventions.
4. **ai-worker** — scaffold `apps/worker-ai`, BullMQ queue plumbing, OpenAI client, SSE bridge through API, `ai.chat-completion`, `ai.ocr-receipt`. Quota tracking. Cost logging table.
5. **reminder-worker** — scaffold `apps/worker-reminder`, cron scheduler, recurring auto-create, due / goal / streak push, weekly review generation. Expo Push integration.
6. **billing-web** (planned) — Mayar.id integration, webhook handler, checkout creation, subscription lifecycle, CMS billing pages.
7. **billing-ios** (planned) — Apple IAP receipt verification, Server-to-Server notifications, reconciliation with Mayar (don't double-bill).

## 16. How to Add a Small Feature (Recipe)

Given a feature like *"add `attachment_url` to transactions"* or *"add goal milestones"*:

1. **Locate** the row in the Feature Atlas. If missing, add a row (status `todo`).
2. **Identify the sub-project** that owns it. If no sub-project exists yet for that domain, that's a sign the feature is too big — escalate to brainstorming.
3. **Write a small spec** at `docs/superpowers/specs/YYYY-MM-DD-<feature-slug>.md`. Sections needed:
   - What & why (2-3 sentences)
   - Data model changes (Prisma diff)
   - API endpoints added/changed (route + zod schema + envelope)
   - Worker jobs added/changed (if any)
   - Mobile / admin client changes (if any)
   - Test plan
   Spec must reference this Spine for conventions and not redecide them.
4. **Write a plan** at `docs/superpowers/plans/YYYY-MM-DD-<feature-slug>.md` via the writing-plans skill.
5. **Implement** following the plan. Each step ends with a passing test.
6. **Update Feature Atlas** row status to `done` and Spine if any convention shifted.

If a feature touches multiple sub-projects (e.g. "scan struk OCR" touches receipts + ai-worker + mobile), the spec lists each surface but the plan is still a single artifact unless implementation order matters enough to split.

## 17. Things This Spine Does NOT Decide

- Exact Free / Plus / Pro feature split (in Feature Atlas as guidance, but TBD per row).
- Pricing numbers (IDR per tier).
- Internationalization beyond Bahasa Indonesia (out of scope v1).
- Multi-workspace (keluarga / karyawan / umkm) — handoff design has it but backend treats v1 as single-workspace-per-user. Revisit before domain-crud locks schema.
- Web app's backend story — `apps/web` may consume the same API; PWA-specific concerns are not handled here.
- Observability / logging stack (e.g. Sentry, Axiom). Add when first incident hurts.

---

## Appendix A — Glossary

- **Spine:** this doc.
- **Sub-project spec:** a spec under `docs/superpowers/specs/` that scopes one of the 7 sub-projects in § 15.
- **Feature spec:** a spec for a small in-scope feature, written ad-hoc when user requests it. See § 16.
- **Plan:** an implementation plan generated by the writing-plans skill, lives in `docs/superpowers/plans/`.
- **Tier override:** manual tier grant by admin, audited via `tier_overrides`.
