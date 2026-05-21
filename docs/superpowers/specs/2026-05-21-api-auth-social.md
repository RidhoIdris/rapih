# api-auth-social — Google + Apple sign-in, refresh tokens, onboarding

**Status:** draft · **Date:** 2026-05-21 · **Sub-project:** api-foundation (chunk 2/4)
**References:** Spine §§ 2, 3, 4, 5, 6, 7, 8, 9, 13, 18.

## 1. What & why

Pivot dari rencana awal: v1 Rapih **social-only** — tidak ada email/password signup, verifikasi email, atau forgot-password. User onboard via Google atau Apple sign-in saja. Spine § 5 (auth model) tetap berlaku sebagai cetak biru, tapi chunk ini cuma mengimplementasi subset social-only-nya.

Selain auth, chunk ini juga:
- Memperkenalkan **`packages/db`** (Prisma schema + client) dan **`packages/shared`** (zod schemas + types yang dipakai bareng oleh mobile dan API). Ini infrastructure work yang harus terjadi sekali saja, dan pas chunk auth karena auth = konsumen pertama-nya.
- Mengimplementasi **onboarding hard-required**: setelah signup, user harus isi nickname + income range + primary goal sebelum bisa pakai endpoint user-data. Mobile sudah punya flow UI-nya (`apps/mobile/src/app/(auth)/register/*`), tinggal di-wire ke API.

Validates: Prisma + Postgres jalan di Dockerfile + Dokploy, JWT pair pattern locked, refresh-rotation reuse-detection bekerja, monorepo cross-package import (api ↔ db ↔ shared) clean.

## 2. Stack additions

Tidak mengubah pilihan stack di Spine § 2. Hanya menambahkan dependency runtime baru di `apps/api`:

| Package | Why |
|---|---|
| `@prisma/client` (via `@rapih/db`) | Database access. |
| `prisma` (devDep) | Schema + migrations. |
| `jose@^5` | Verify JWT/JWKS dari Google & Apple. Caching JWKS built-in. |
| `@fastify/jwt@^9` | Sign + verify access JWT internal Rapih. |
| `@fastify/rate-limit@^10` | In-memory rate limit per route. |
| `ua-parser-js@^2` | Parse User-Agent → device label ringkas. |

Tidak menambah Redis / argon2 — keduanya tidak dipakai di chunk ini.

## 3. Data model changes

### 3.1 Migrasi Prisma

File: `packages/db/prisma/schema.prisma` (created in this chunk).

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SocialProvider {
  google
  apple
}

enum UserTier {
  free
  plus
  pro
}

enum IncomeRange {
  lt3
  r3to7
  r7to15
  r15to30
  gt30
  variable
}

enum PrimaryGoal {
  save
  track
  goal
  invest
  debt
  bills
}

model User {
  id                       String    @id @default(cuid())
  email                    String    @unique
  email_verified_at        DateTime?
  name                     String
  tier                     UserTier  @default(free)
  apple_private_relay      Boolean   @default(false)
  onboarding_completed_at  DateTime?

  created_at               DateTime  @default(now())
  updated_at               DateTime  @updatedAt

  social_accounts          SocialAccount[]
  refresh_tokens           RefreshToken[]
  profile                  UserProfile?

  @@map("users")
}

model SocialAccount {
  id                String         @id @default(cuid())
  user_id           String
  provider          SocialProvider
  provider_user_id  String
  created_at        DateTime       @default(now())

  user              User           @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([provider, provider_user_id])
  @@index([user_id])
  @@map("social_accounts")
}

model RefreshToken {
  id              String    @id @default(cuid())
  user_id         String
  token_hash      String    @unique
  expires_at      DateTime
  revoked_at      DateTime?
  replaced_by_id  String?   @unique
  device_label    String?
  created_at      DateTime  @default(now())

  user            User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  replaced_by     RefreshToken? @relation("TokenRotation", fields: [replaced_by_id], references: [id])
  replaces        RefreshToken? @relation("TokenRotation")

  @@index([user_id])
  @@index([expires_at])
  @@map("refresh_tokens")
}

model UserProfile {
  user_id        String       @id
  nickname       String?
  income_range   IncomeRange?
  primary_goal   PrimaryGoal?
  created_at     DateTime     @default(now())
  updated_at     DateTime     @updatedAt

  user           User         @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

Migration name: `20260521_initial_auth_social`.

### 3.2 Catatan implementasi

- **`email`** disimpan selalu lowercase di application layer. Prisma `String @unique`. Migrasi ke `citext` di-defer.
- **`token_hash`** = `sha256(refresh_token_plaintext)`. Plaintext cuma dikirim sekali ke client; server tidak pernah simpan plaintext.
- **`replaced_by_id`** unique: tiap refresh token hanya bisa di-rotate jadi 1 child. Kalau client kirim refresh yang `revoked_at` sudah ter-set, **walking forward** dari `replaced_by_id` chain → revoke semua descendants ke saat ini. Reuse-detection.
- **`onDelete: Cascade`** semua relasi user. Soft-delete user ditunda.
- **Enum naming `r3to7`** dst.: Prisma tidak izinkan enum value mulai dengan digit. Mobile akan rename `'3to7'` → `'r3to7'` etc. di `signup-store.ts` (lihat § 5).
- **Indexes**: `social_accounts.(provider, provider_user_id)` unique untuk lookup-by-provider, `refresh_tokens.user_id` untuk revoke-all, `refresh_tokens.expires_at` untuk cron cleanup nanti.

## 4. API endpoints

Semua mengikuti envelope Spine § 7. Schema zod di `packages/shared/src/auth/schemas.ts`, di-import oleh `apps/api` dan `apps/mobile`.

### 4.1 `POST /auth/google`

Body:
```ts
{ id_token: string }
```
- Verify `id_token` vs Google JWKS (`https://www.googleapis.com/oauth2/v3/certs`).
- Validate `aud` ∈ `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated env, untuk ios/android/web bundle ids).
- Validate `iss` ∈ `{accounts.google.com, https://accounts.google.com}`.
- Validate `email_verified === true`.
- Upsert `SocialAccount` by `(provider='google', provider_user_id=sub)` → user.
- Issue access + refresh.

Response 200:
```ts
{
  ok: true,
  data: {
    access_token: string,       // JWT 15min
    refresh_token: string,       // opaque hex 64 chars (32 bytes)
    user: UserDto                // full
  }
}
```

Errors:
- `auth.invalid_token` 401 — JWT signature/claims invalid
- `auth.unsupported_provider` 400 — issuer/audience mismatch

Rate limit: **10/min per IP**.

### 4.2 `POST /auth/apple`

Body:
```ts
{
  id_token: string,
  name?: { firstName?: string, lastName?: string }
}
```
- Verify vs `https://appleid.apple.com/auth/keys`.
- Validate `aud` ∈ `APPLE_OAUTH_CLIENT_IDS`, `iss === 'https://appleid.apple.com'`.
- Apple **doesn't** include `email_verified` claim — Apple guarantees verified, so set `email_verified_at = now()` always.
- Detect `apple_private_relay`: email berakhir `@privaterelay.appleid.com`.
- **Name fallback hybrid** (Spine § 5.3):
  1. Kalau `body.name.firstName + ' ' + body.name.lastName` non-empty → pakai itu
  2. Else, kalau bukan private relay → `email.split('@')[0]`
  3. Else → `'Pengguna Rapih'`
  - Catatan: nama ini hanya seed; akan di-overwrite oleh `nickname` di onboarding.
- Upsert `SocialAccount` by `(provider='apple', provider_user_id=sub)` → user. Nama dari step di atas hanya di-set saat **insert**, bukan saat update (Apple cuma ngirim name pertama kali).
- Issue access + refresh.

Response: sama dengan `/auth/google`.

Rate limit: **10/min per IP**.

### 4.3 `POST /auth/refresh`

Body:
```ts
{ refresh_token: string }
```
- Hash token → `sha256`, lookup `RefreshToken` by `token_hash`.
- Kalau tidak ada → 401 `auth.invalid_token`.
- Kalau `revoked_at` sudah ter-set → **chain reuse detected**. Walk `replaced_by_id` chain, revoke semua descendants + ancestors (revoke ALL tokens dalam chain), return 401 `auth.token_reused`.
- Kalau `expires_at < now` → 401 `auth.token_expired`.
- Sukses path:
  - Generate token baru (32 bytes hex)
  - Insert `RefreshToken` row baru dengan `device_label` di-parse dari User-Agent header
  - Update old token: `revoked_at = now()`, `replaced_by_id = newToken.id`
  - Issue access JWT baru
  - Return `{access_token, refresh_token}` (no user payload — client udah punya dari /me kalau perlu)

Rate limit: **30/min per IP**.

### 4.4 `POST /auth/logout`

Body:
```ts
{ refresh_token: string }
```
- Hash + lookup. Set `revoked_at = now()` di token tersebut. Tidak walk chain (logout != theft).
- Return 204.
- Tidak error kalau token sudah revoked atau tidak ditemukan (idempotent — UI bisa retry tanpa blowback).

Rate limit: **global (100/min per IP)**.

### 4.5 `GET /auth/me`

Auth: `Authorization: Bearer <access_token>`.

Response 200:
```ts
{
  ok: true,
  data: {
    user: {
      id: string,
      email: string,
      name: string,
      tier: 'free' | 'plus' | 'pro',
      email_verified_at: string | null,
      onboarding_completed_at: string | null,
      profile: {
        nickname: string | null,
        income_range: IncomeRange | null,
        primary_goal: PrimaryGoal | null
      } | null,
      created_at: string
    }
  }
}
```

Errors:
- `auth.unauthorized` 401 — bearer missing/invalid

### 4.6 `PATCH /me/onboarding`

Auth: bearer.

Body:
```ts
{
  nickname: string,            // 1-30 chars, trimmed
  income_range: IncomeRange,   // enum
  primary_goal: PrimaryGoal    // enum
}
```

- All 3 fields **required** (zod validates).
- Upsert `UserProfile` with `user_id=req.user.id`.
- Set `users.onboarding_completed_at = now()` (idempotent — re-PATCH overwrites profile fields tapi `onboarding_completed_at` tidak di-bump kalau sudah set).
- Return updated user (sama shape dengan `GET /auth/me`).

Errors:
- `validation.failed` 400
- `auth.unauthorized` 401

Rate limit: global.

### 4.7 Middleware `requireOnboardingComplete`

Decorator Fastify `app.decorate('requireOnboarding', preHandler)`. Belum dikonsumsi route mana pun di chunk ini, tapi unit-test akan men-verify:
- 403 `onboarding.required` kalau `req.user.onboarding_completed_at === null`
- Lewat kalau ter-set

Test pakai dummy route yang dipasang di test file (bukan di production routes).

## 5. Mobile changes

Diluar scope chunk ini untuk **mengimplementasi**, tapi spec list perubahan yang akan terjadi:

### 5.1 Yang harus diubah

- **`apps/mobile/src/features/auth/signup-store.ts`**: enum `IncomeRange` rename `'3to7'` → `'r3to7'`, `'7to15'` → `'r7to15'`, `'15to30'` → `'r15to30'`. SEED data updated. Selain itu hapus `email`, `password`, `agreeTos` karena social-only.
- **`apps/mobile/src/app/(auth)/_layout.tsx`**: hapus screen `register/email`. Sisakan `splash`, `login`, `register/name`, `register/income`, `done`.
- **`apps/mobile/src/app/(auth)/login.tsx` & `register/email.tsx`**: drop password fields. Login screen jadi splash-like — Apple/Google buttons saja.
- **Skip buttons**: hapus `onSkip` dari `register/name` dan `register/income`. Hapus tombol "Atau lewati" dari `done`.
- **Wire ke API** (di chunk berikutnya `mobile-auth-wire`):
  - Pasang `expo-auth-session` Google flow + Apple `expo-apple-authentication`
  - Setelah dapat ID token, panggil `POST /auth/google` atau `/auth/apple`
  - Simpan `refresh_token` di `expo-secure-store` dengan key `rapih.refresh_token`
  - Simpan `access_token` di memory (Zustand)
  - Pas done screen, kalau onboarding belum complete → call `PATCH /me/onboarding`, baru `router.replace('/(app)/beranda')`
  - Bootstrap: di app start, baca refresh dari SecureStore → call `/auth/refresh` → call `/auth/me` → cek `onboarding_completed_at` untuk routing
- **`apps/mobile/package.json`**: tambah `@rapih/shared` ke dependencies (workspace). Tipe response API + zod schemas dipakai untuk type safety form & API client.

### 5.2 Yang **tidak** dilakukan di chunk ini

- Implementasi mobile API client (chunk berikutnya, `mobile-auth-wire`)
- Refresh token bootstrapping
- Drop screens `register/email`

Mobile tetap UI-only sampai chunk berikutnya. Spec ini cuma **mendokumentasikan kontrak** sehingga chunk mobile bisa langsung jalan.

## 6. Worker jobs

None.

## 7. Files to create / modify

### 7.1 Created

**`packages/db/`**
- `package.json` — `@rapih/db`, exports `./client`. Dependencies: `@prisma/client@^6`. Dev: `prisma@^6`.
- `prisma/schema.prisma` — schema lengkap (§ 3.1).
- `prisma/migrations/20260521_initial_auth_social/migration.sql` — generated by `prisma migrate dev --name initial_auth_social`.
- `src/index.ts` — re-export `PrismaClient` + `createPrismaClient(databaseUrl: string): PrismaClient`.
- `tsconfig.json`.

**`packages/shared/`**
- `package.json` — `@rapih/shared`, exports `.`, `./auth`. Dependencies: `zod@^3`.
- `src/index.ts` — barrel.
- `src/auth/index.ts` — barrel for `./auth`.
- `src/auth/enums.ts` — `IncomeRange`, `PrimaryGoal`, `SocialProvider`, `UserTier` zod schemas + label maps.
- `src/auth/schemas.ts` — endpoint body/response schemas:
  - `GoogleSignInBody`, `AppleSignInBody`, `RefreshBody`, `LogoutBody`, `OnboardingBody`, `MeResponse`, `AuthSessionResponse`, `UserDto`, `UserProfileDto`.
- `src/errors.ts` — `ErrorCode` string union + label map (Bahasa Indonesia messages).
- `tsconfig.json` — `composite: true`, `declaration: true`, `outDir: dist`.

**`apps/api/src/`**
- `db.ts` — `import { createPrismaClient } from '@rapih/db'`. Construct singleton from `env.DATABASE_URL`. Wire decorator `app.decorate('db', prisma)`.
- `auth/jwks.ts` — `googleJwks` & `appleJwks` (lazy `createRemoteJWKSet`).
- `auth/verify-id-token.ts` — `verifyGoogleIdToken(idToken)` & `verifyAppleIdToken(idToken)`. Returns `{ sub, email, email_verified?, name? }` or throws `AppError('auth.invalid_token', ...)`.
- `auth/tokens.ts` — `signAccessToken({userId, tier})`, `generateRefreshToken()` (32 bytes hex), `hashRefreshToken(plain)`, `createRefreshTokenRow(...)`, `rotateRefreshToken(plain)`.
- `auth/upsert-user.ts` — `upsertUserFromSocial({provider, sub, email, name, isAppleRelay})` — handles new vs existing user, social account linking.
- `auth/device.ts` — `parseDeviceLabel(userAgent: string | undefined): string | null`.
- `auth/decorators.ts` — `app.decorate('authenticate', preHandler)`, `app.decorate('requireOnboarding', preHandler)`. Uses `@fastify/jwt`.
- `routes/auth.ts` — Fastify plugin registering all `/auth/*` + `/me/onboarding` routes.
- `lib/email-normalize.ts` — `normalizeEmail(s: string): string` (lowercase + trim).
- `lib/dto.ts` — `userToDto(user, profile?): UserDto` mapper.

**`apps/api/tests/`**
- `auth-google.test.ts` — full integration with mocked JWKS server.
- `auth-apple.test.ts` — same, plus name-fallback cases + private-relay detection.
- `auth-refresh.test.ts` — happy path, expired, reused-token detection (revokes chain).
- `auth-logout.test.ts` — idempotent, revokes token.
- `auth-me.test.ts` — returns user, 401 without bearer.
- `auth-onboarding.test.ts` — happy path, validation, idempotent re-PATCH.
- `require-onboarding.test.ts` — uses dummy route to test middleware.
- `helpers/jwks-mock.ts` — mock JWKS server for tests (using `jose` to sign test tokens).
- `helpers/db.ts` — test DB lifecycle (`beforeEach` truncate, etc.).

**Dockerfile changes** (`apps/api/Dockerfile`):
- Stage `installer`: setelah `pnpm install`, tambah `pnpm --filter @rapih/db exec prisma generate`.
- Stage `runner`: tambah `RUN apk add --no-cache openssl` (Prisma butuh OpenSSL on Alpine). CMD-nya jadi `node apps/api/dist/server.js` setelah `prisma migrate deploy` di entrypoint script.
- Tambah `apps/api/scripts/entrypoint.sh`:
  ```sh
  #!/bin/sh
  set -e
  pnpm --filter @rapih/db exec prisma migrate deploy
  exec node apps/api/dist/server.js
  ```

### 7.2 Modified

- `apps/api/package.json` — tambah dependency `@rapih/db@workspace:*`, `@rapih/shared@workspace:*`, `@fastify/jwt`, `@fastify/rate-limit`, `jose`, `ua-parser-js`. Remove `@fastify/swagger-ui` listing? No — masih dipakai.
- `apps/api/src/app.ts` — register `@fastify/rate-limit` (global default 100/min), register auth decorators, register auth routes, decorate `db`.
- `apps/api/src/config/env.ts` — tambah env baru (§ 8).
- `apps/api/src/plugins/swagger.ts` — tambah tag `auth` description.
- `apps/api/.env.example` — tambah env baru.
- `pnpm-workspace.yaml` — verify `packages/*` di-include (kalau belum, add).
- `turbo.json` — pastikan `build` task di `packages/db` jalan `prisma generate` sebelum `apps/api` build. Tambah pipeline:
  ```json
  "@rapih/db#build": {
    "cache": false,
    "outputs": ["node_modules/.prisma/**"]
  }
  ```

## 8. Env variables introduced

Per Spine § 9:

| Name | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string. |
| `JWT_ACCESS_SECRET` | yes | — | Sign internal access JWT (>=32 bytes random). |
| `JWT_ACCESS_TTL_SECONDS` | no | 900 | Access JWT lifetime. |
| `JWT_REFRESH_TTL_SECONDS` | no | 2592000 | Refresh token lifetime (30d). |
| `GOOGLE_OAUTH_CLIENT_IDS` | yes | — | Comma-separated client IDs (ios, android, web). |
| `APPLE_OAUTH_CLIENT_IDS` | yes | — | Comma-separated bundle IDs / service IDs. |

`.env.example` defaults:
```
DATABASE_URL=postgresql://rapih:rapih@localhost:5432/rapih
JWT_ACCESS_SECRET=dev-secret-change-me-32-chars-min-aaaaaaaaaaa
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
GOOGLE_OAUTH_CLIENT_IDS=local-dev-google-id
APPLE_OAUTH_CLIENT_IDS=local-dev-apple-id
```

Apple revocation keys (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`) **belum** dipakai di chunk ini (revocation = chunk lain). Tetap committed di Spine § 9 sebagai reference.

## 9. Error codes introduced

Defined di `packages/shared/src/errors.ts`:

| Code | HTTP | Message (ID) |
|---|---|---|
| `auth.invalid_token` | 401 | "Token tidak valid." |
| `auth.token_expired` | 401 | "Sesi sudah kadaluarsa, silakan masuk kembali." |
| `auth.token_reused` | 401 | "Sesi tidak aman, silakan masuk kembali di semua perangkat." |
| `auth.unauthorized` | 401 | "Anda harus masuk dulu." |
| `auth.unsupported_provider` | 400 | "Provider tidak dikenali." |
| `onboarding.required` | 403 | "Lengkapi onboarding dulu untuk lanjut." |
| `validation.failed` | 400 | "Validasi gagal." |
| `internal.unknown` | 500 | "Terjadi kesalahan pada server." |

## 10. Architecture & data flow

### 10.1 Sign-in flow (Google example)

```
mobile (expo-auth-session)
  → user picks Google account, gets id_token
  → POST /auth/google { id_token }
api
  → verifyGoogleIdToken(id_token)
    → fetch JWKS (cached by jose)
    → verify signature, aud, iss, email_verified
    → return { sub, email, name, email_verified }
  → upsertUserFromSocial({ provider:'google', sub, email, name })
    → tx:
      - find SocialAccount by (provider, sub) → if exists, return user
      - else find User by email → if exists, link new SocialAccount
      - else create User + SocialAccount + UserProfile (empty)
  → signAccessToken + createRefreshTokenRow
  → return { access_token, refresh_token, user }
mobile
  → store refresh in SecureStore, access in memory
  → if user.onboarding_completed_at == null → navigate (auth)/register/name
  → else → navigate (app)/beranda
```

### 10.2 Refresh flow

```
mobile
  → reads refresh from SecureStore
  → POST /auth/refresh { refresh_token }
api
  → hash + lookup
  → if revoked_at → walk chain, revoke all, return 401 token_reused
  → if expired → 401 token_expired
  → tx:
    - generate new refresh
    - insert new RefreshToken row (with device_label from UA)
    - update old: revoked_at=now, replaced_by_id=newToken.id
  → signAccessToken
  → return { access_token, refresh_token }
mobile
  → overwrite SecureStore with new refresh
```

### 10.3 Onboarding flow

```
mobile (after sign-in, GET /me returns onboarding_completed_at: null)
  → routes to register/name → register/income → done
  → on done press:
    PATCH /me/onboarding { nickname, income_range, primary_goal }
api
  → upsert UserProfile
  → set users.onboarding_completed_at = now() (if null)
  → return updated user
mobile
  → routes to (app)/beranda
```

## 11. Test plan

Pakai **Vitest** + `app.inject()` + real Postgres test DB (Docker compose for test, atau use `pg-mem` kalau Prisma support — fallback ke real Postgres).

### 11.1 Unit

- `verifyGoogleIdToken`: valid token, invalid signature, wrong audience, expired token, unverified email
- `verifyAppleIdToken`: valid, valid + private relay, valid + name body, invalid sig
- `parseDeviceLabel`: iOS UA, Android UA, missing UA → null
- `normalizeEmail`: lowercase, trim
- `userToDto`: maps full user + profile correctly, nullable profile
- `hashRefreshToken`, `generateRefreshToken`: deterministic hash, unique random

### 11.2 Integration

- `POST /auth/google` happy path (new user + returning user)
- `POST /auth/google` invalid token → 401
- `POST /auth/apple` new user dengan `name` body → name disimpan
- `POST /auth/apple` private relay email → `apple_private_relay = true`
- `POST /auth/apple` no name body, regular email → name dari email local-part
- `POST /auth/apple` no name body, private relay → name "Pengguna Rapih"
- `POST /auth/refresh` happy path
- `POST /auth/refresh` reuse: pakai token yang sudah revoked → 401 `token_reused` + verify chain di-revoke semua
- `POST /auth/refresh` expired → 401
- `POST /auth/logout` → 204, token revoked
- `POST /auth/logout` idempotent (call twice) → 204 both times
- `GET /auth/me` happy
- `GET /auth/me` no bearer → 401
- `GET /auth/me` invalid bearer → 401
- `PATCH /me/onboarding` happy → user.onboarding_completed_at di-set
- `PATCH /me/onboarding` invalid body → 400 validation
- `PATCH /me/onboarding` re-call → tidak overwrite onboarding_completed_at, tapi profile fields ter-update
- `requireOnboarding` middleware: blocks user with null → 403 `onboarding.required`
- `requireOnboarding`: passes user with completed_at set
- Rate limit: hammer `/auth/google` 11x in 1 min → 11th → 429

### 11.3 Smoke (manual or scripted)

- `docker compose up postgres` + `pnpm --filter @rapih/api dev` → curl `/health` works
- `prisma migrate deploy` di Docker entrypoint berjalan (manual: build & run image)
- OpenAPI: `/docs/json` includes new auth + me endpoints with proper schemas

## 12. Acceptance criteria

- [ ] `pnpm install` resolve `@rapih/db` & `@rapih/shared` workspace packages
- [ ] `pnpm --filter @rapih/db exec prisma migrate dev --name initial_auth_social` produces migration file
- [ ] `pnpm --filter @rapih/api check` passes (tsc + biome)
- [ ] `pnpm --filter @rapih/api test` all tests pass
- [ ] `pnpm --filter @rapih/api dev` boots after migrating local Postgres
- [ ] `curl -s -X POST http://localhost:3001/auth/google -d '{"id_token":"<test>"}' -H 'Content-Type: application/json'` returns expected envelope (with mock JWKS in dev — see § 13)
- [ ] `/docs/json` lists all new endpoints with request + response schemas
- [ ] `docker build -f apps/api/Dockerfile .` succeeds, `prisma generate` runs in installer stage
- [ ] `docker run` with all env vars set boots, runs migrate deploy, listens
- [ ] `apps/api/AGENTS.md` updated dengan section "Auth conventions" (gimana issue token, gimana protect route, gimana add new social provider)
- [ ] Spine § 5 cross-checked — apa yang berubah di chunk ini didokumentasikan di Spine kalau perlu (mis. tabel `email_verification_tokens` yang tidak jadi dibikin di v1; Spine § 14 Feature Atlas: row "email signup + login", "email verification", "forgot/reset password" → status `deferred` dengan note "v1 social-only"; row "google sign-in", "apple sign-in" → status `done` setelah merge)
- [ ] No secrets committed. JWT_ACCESS_SECRET in .env.example is a clearly-fake placeholder

## 13. Out of scope (defer ke chunk lain)

| Concern | Chunk |
|---|---|
| Mobile Google/Apple flow + API client wiring | `mobile-auth-wire` |
| `device_tokens` table + `POST /devices/register` | `api-devices` (chunk 4/4 of api-foundation) |
| Apple Server-to-Server revocation handling | nantikan billing-ios / privacy chunk |
| Email/password signup, verification, reset | deferred, mungkin tidak pernah |
| Resend wiring | deferred sampai feature yang butuh email muncul |
| `GET /auth/sessions` + `DELETE /auth/sessions/:id` | deferred (security feature) |
| Redis-backed rate limit | nanti kalau scale > 1 instance |
| Cleanup cron untuk expired refresh tokens | reminder-worker chunk |
| Profile fields tambahan (avatar, dll) | api-profile-extended (kalau ada) |

## 14. Risks & mitigations

- **Risk:** test JWKS verification butuh setup mock RSA key. **Mitigation:** `tests/helpers/jwks-mock.ts` pakai `jose` `generateKeyPair` → spawn fastify mini-app yang serve mock JWKS, override env var `GOOGLE_JWKS_URL` (atau injection point di `auth/jwks.ts`) untuk pointing ke mock url.
- **Risk:** Prisma di Alpine butuh OpenSSL → image build error. **Mitigation:** `apk add --no-cache openssl` di runner stage, dan set `PRISMA_QUERY_ENGINE_BINARY` correctly via Prisma's binary targets (`linux-musl-openssl-3.0.x`) di `schema.prisma` generator config.
- **Risk:** chain reuse-detection bisa expensive untuk chain panjang. **Mitigation:** untuk v1, walk chain di JS pakai Prisma findMany ber-iterasi (max ~5-10 step realistis). Kalau jadi bottleneck, ganti ke recursive CTE SQL di chunk berikutnya.
- **Risk:** mobile mengirim `IncomeRange` value lama (`'3to7'`) sebelum sempet di-update. **Mitigation:** server reject dengan zod validation `validation.failed`; pesan errornya mention enum yang valid; mobile akan catch & update.
- **Risk:** Apple ngirim email sama untuk private relay user kalau dia signup ulang setelah delete account. **Mitigation:** lookup primarily by `(provider, provider_user_id)` (Apple `sub` stabil per (user, app) pair), bukan email. Email cuma fallback link.

## 15. Handoff notes for Kiro (or any executor)

- Plan akan ditulis di `docs/superpowers/plans/2026-05-21-api-auth-social.md` setelah spec ini approved.
- Ikutin TDD seperti chunk api-scaffold: setiap step → test fail → implement → test pass → commit.
- Test pakai mock JWKS server, bukan call ke Google/Apple beneran. Implementasi-nya di `tests/helpers/jwks-mock.ts`.
- Test DB: pakai `docker compose` Postgres atau Postgres lokal. Setiap test file `beforeEach` truncate tables. Migrasi di-apply sekali pas test setup.
- Commit format: `feat(api-auth-social): <short>`.
- Kalau ada migrasi yang fail, **jangan rebase**. Buat migrasi baru yang fix-forward.
- **STOP rules** (sama dengan plan api-scaffold):
  - Test fail atau assert salah
  - `check` script error
  - Repo dirty / wrong branch
  - Migrasi prisma fail
- **Environment-gap fallback** (sama dengan plan api-scaffold):
  - Tidak ada Postgres lokal → tulis test pakai Prisma stub kalau memungkinkan; kalau tidak, tulis test artifact + commit, log blocker, lanjut. Manual smoke test akan dilakukan oleh user.
  - Tidak ada Docker → skip docker-build acceptance, tulis blocker.

---

## Appendix A — Sample request/response JSON

### `POST /auth/google` success

Request:
```json
{ "id_token": "eyJhbGciOi..." }
```

Response 200:
```json
{
  "ok": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "a3f2c8e1...64chars",
    "user": {
      "id": "clxabc123",
      "email": "ridho@gmail.com",
      "name": "Ridho Idris",
      "tier": "free",
      "email_verified_at": "2026-05-21T08:30:00.000Z",
      "onboarding_completed_at": null,
      "profile": null,
      "created_at": "2026-05-21T08:30:00.000Z"
    }
  }
}
```

### `PATCH /me/onboarding` success

Request:
```json
{
  "nickname": "Ridho",
  "income_range": "r7to15",
  "primary_goal": "save"
}
```

Response 200:
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "clxabc123",
      "email": "ridho@gmail.com",
      "name": "Ridho Idris",
      "tier": "free",
      "email_verified_at": "2026-05-21T08:30:00.000Z",
      "onboarding_completed_at": "2026-05-21T08:35:12.000Z",
      "profile": {
        "nickname": "Ridho",
        "income_range": "r7to15",
        "primary_goal": "save"
      },
      "created_at": "2026-05-21T08:30:00.000Z"
    }
  }
}
```

### Error envelope example

```json
{
  "ok": false,
  "error": {
    "code": "auth.token_reused",
    "message": "Sesi tidak aman, silakan masuk kembali di semua perangkat."
  }
}
```
