# api-auth-social Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> If you are a cloud executor running this without the skills runtime, follow the plan linearly: execute every step, run the verification command before claiming the step done, and commit per the commit step at the end of each task.
>
> **STOP rules (do not improvise around these):**
> - A test fails or asserts the wrong thing.
> - `pnpm check` (tsc / biome) reports a real error in code you wrote.
> - The repo is in an unexpected state (file already exists when it shouldn't, branch is not `main`, working tree is dirty before you started).
> - A code-logic outcome diverges from what the plan claims will happen.
> - A Prisma migration fails to apply.
>
> **Environment-gap rules (use the fallback, then continue):**
> - Tool version is higher than the plan names but in the same major-or-later range → use what's available.
> - Tool is missing but a documented fallback exists in the same step → use the fallback.
> - An action requires Docker / Postgres / a network resource that is unavailable → write the file artifact, commit it, add a one-line note in `docs/superpowers/notes/api-auth-social-blockers.md` ("Task N step M: postgres not available; deferred to human verification"), continue to the next step.
>
> If you hit a true STOP case, write a detailed note in `docs/superpowers/notes/api-auth-social-blockers.md` (command, output, what you tried) and pause.
>
> The spec at `docs/superpowers/specs/2026-05-21-api-auth-social.md` and the Spine at `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` are authoritative for design decisions — do not redecide stack, schema, or conventions.

**Goal:** Stand up Google + Apple social sign-in, JWT access + rotating refresh tokens, and onboarding endpoints in `apps/api`, plus introduce the shared `packages/db` (Prisma) and `packages/shared` (zod) packages that the rest of the backend will build on.

**Architecture:** Mobile sends a Google or Apple ID token → API verifies it against the provider's JWKS via `jose` → upserts a `User` and `SocialAccount` → issues a 15-minute HS256 access JWT plus a rotating opaque refresh token (sha256 hashed at rest, 30-day TTL, reuse-detection by chain). Bearer-protected `/auth/me` returns the user with their `UserProfile` and onboarding state. `PATCH /me/onboarding` upserts the profile and stamps `onboarding_completed_at`. A `requireOnboarding` decorator is exposed for future user-data routes. All endpoints follow the Spine § 7 envelope. Per-route rate limits via `@fastify/rate-limit` (memory store).

**Tech Stack:** Fastify 5, Prisma 6 + Postgres 17, `jose@^5` for JWKS, `@fastify/jwt@^9`, `@fastify/rate-limit@^10`, `ua-parser-js@^2`, zod 3, Vitest 2. New packages: `@rapih/db` (Prisma client), `@rapih/shared` (zod schemas + error codes + enums).

**Reference docs (read before starting):**
- `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — Spine
- `docs/superpowers/specs/2026-05-21-api-auth-social.md` — this chunk's spec
- `docs/superpowers/specs/2026-05-20-api-scaffold.md` & its plan — sets the conventions you'll extend
- `apps/api/AGENTS.md` — existing API conventions

---

## Task 0: Prep & Sanity Checks

**Files:** none modified — read-only context loading.

- [ ] **Step 1: Read the Spine sections referenced in the spec (§§ 2, 3, 4, 5, 7, 8, 9, 13, 18) and the spec itself.**

You need stack picks, monorepo layout, db conventions, auth model, response envelope, validation pattern, env naming, and deploy story in working memory.

- [ ] **Step 2: Verify Node, pnpm, Docker, and Postgres tooling.**

Run from repo root:

```bash
node --version
pnpm --version
docker --version
docker info >/dev/null 2>&1 && echo "docker daemon UP" || echo "docker daemon DOWN"
psql --version || echo "psql not on PATH (ok — we use docker)"
```

Expected:
- `node` ≥ 22 (project pins `node:22-alpine` in Docker; local 22.x or 24.x is fine).
- `pnpm` 11.x (the repo's `packageManager` field is `pnpm@11.1.3`).
- `docker --version` prints (any 24+ is fine).
- `docker info` prints "docker daemon UP".
- `psql` is optional (we run Postgres via docker-compose).

If `node` < 22 or `pnpm` is missing or docker daemon is DOWN, STOP and write a blocker.

- [ ] **Step 3: Verify repo state.**

Run from repo root:

```bash
pwd
git status
git log --oneline -3
ls packages 2>/dev/null || echo "packages/ not yet present"
```

Expected:
- working directory = repo root
- `git status` clean tree on `main`
- HEAD is `b0b4e58 docs(spec): add api-auth-social spec` or later
- `packages/` either does not exist yet or is empty (we will create it). If `packages/db` or `packages/shared` already exists with content, STOP and write a blocker.

No commit for this task — context loading only.

---

## Task 1: Add docker-compose for local Postgres

**Files:**
- Create: `infra/docker-compose.dev.yml`
- Create: `infra/README.md`

- [ ] **Step 1: Create `infra/docker-compose.dev.yml`**

```yaml
# Local-dev infra for Rapih. Not used in Dokploy (Postgres + Redis are
# managed services there). This file is for `pnpm --filter @rapih/api dev`
# and `pnpm --filter @rapih/api test` against a local Postgres.

name: rapih-dev

services:
  postgres:
    image: postgres:17-alpine
    container_name: rapih-postgres-dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: rapih
      POSTGRES_PASSWORD: rapih
      POSTGRES_DB: rapih
    ports:
      - '5433:5432'
    volumes:
      - rapih_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U rapih -d rapih']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  rapih_pg_data:
```

Port `5433` (not 5432) on purpose — keeps clear of any Postgres a developer already has installed locally.

- [ ] **Step 2: Create `infra/README.md`**

```markdown
# Rapih — local infra

`docker compose -f infra/docker-compose.dev.yml up -d` boots a local Postgres for development and tests.

- Host: `localhost`
- Port: `5433`
- User / password / db: `rapih` / `rapih` / `rapih`
- Test DB: same instance, db `rapih_test` (created on first migrate by `apps/api` test setup)

Tear down: `docker compose -f infra/docker-compose.dev.yml down`. Add `-v` to wipe data.

In production (Dokploy) Postgres is a managed service and this file is not used.
```

- [ ] **Step 3: Boot Postgres and verify.**

```bash
docker compose -f infra/docker-compose.dev.yml up -d
docker compose -f infra/docker-compose.dev.yml ps
```

Expected: `rapih-postgres-dev` row with state `running` and health `healthy` (give it ~10 seconds, then re-run `ps`). Verify with:

```bash
docker exec rapih-postgres-dev pg_isready -U rapih -d rapih
```

Expected output ends with `accepting connections`.

If docker is unavailable in this sandbox, write a blocker note and continue — the file is committed regardless, and later Postgres-dependent tasks will be flagged.

- [ ] **Step 4: Commit.**

```bash
git add infra/docker-compose.dev.yml infra/README.md
git commit -m "feat(api-auth-social): add local-dev Postgres via docker-compose"
```

---

## Task 2: Create `packages/shared` skeleton

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/biome.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@rapih/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./auth": {
      "types": "./dist/auth/index.d.ts",
      "import": "./dist/auth/index.js"
    },
    "./errors": {
      "types": "./dist/errors.d.ts",
      "import": "./dist/errors.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "biome check src tests",
    "check": "tsc --noEmit && biome check src tests",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

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
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `packages/shared/biome.json`**

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
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  }
}
```

- [ ] **Step 4: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from './auth/index.js';
export * from './errors.js';
```

- [ ] **Step 6: Install + verify the package is wired.**

From repo root:

```bash
pnpm install
pnpm --filter @rapih/shared exec node -e "console.log('ok')"
```

Expected: `pnpm install` succeeds and the second command prints `ok`.

- [ ] **Step 7: Commit.**

```bash
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/biome.json packages/shared/vitest.config.ts packages/shared/src/index.ts pnpm-lock.yaml
git commit -m "feat(api-auth-social): scaffold @rapih/shared package"
```

---

## Task 3: Shared enums + error codes (TDD)

**Files:**
- Test: `packages/shared/tests/enums.test.ts`
- Test: `packages/shared/tests/errors.test.ts`
- Create: `packages/shared/src/auth/enums.ts`
- Create: `packages/shared/src/auth/index.ts`
- Create: `packages/shared/src/errors.ts`

- [ ] **Step 1: Write the failing tests.**

Create `packages/shared/tests/enums.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  IncomeRangeSchema,
  PrimaryGoalSchema,
  SocialProviderSchema,
  UserTierSchema,
  incomeRangeLabel,
  primaryGoalLabel,
} from '../src/auth/enums.js';

describe('auth enums', () => {
  it('IncomeRangeSchema accepts every Prisma-compatible value', () => {
    for (const v of ['lt3', 'r3to7', 'r7to15', 'r15to30', 'gt30', 'variable']) {
      expect(IncomeRangeSchema.safeParse(v).success).toBe(true);
    }
  });

  it('IncomeRangeSchema rejects the legacy 3to7 value', () => {
    expect(IncomeRangeSchema.safeParse('3to7').success).toBe(false);
  });

  it('PrimaryGoalSchema accepts the six goal ids', () => {
    for (const v of ['save', 'track', 'goal', 'invest', 'debt', 'bills']) {
      expect(PrimaryGoalSchema.safeParse(v).success).toBe(true);
    }
  });

  it('SocialProviderSchema only accepts google / apple', () => {
    expect(SocialProviderSchema.safeParse('google').success).toBe(true);
    expect(SocialProviderSchema.safeParse('apple').success).toBe(true);
    expect(SocialProviderSchema.safeParse('facebook').success).toBe(false);
  });

  it('UserTierSchema accepts free / plus / pro', () => {
    for (const v of ['free', 'plus', 'pro']) {
      expect(UserTierSchema.safeParse(v).success).toBe(true);
    }
  });

  it('income/goal label maps cover every enum value', () => {
    for (const v of ['lt3', 'r3to7', 'r7to15', 'r15to30', 'gt30', 'variable'] as const) {
      expect(incomeRangeLabel[v]).toBeDefined();
    }
    for (const v of ['save', 'track', 'goal', 'invest', 'debt', 'bills'] as const) {
      expect(primaryGoalLabel[v]).toBeDefined();
    }
  });
});
```

Create `packages/shared/tests/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, type ErrorCode } from '../src/errors.js';

describe('error codes', () => {
  it('every introduced auth/onboarding error code has a message', () => {
    const codes: ErrorCode[] = [
      'auth.invalid_token',
      'auth.token_expired',
      'auth.token_reused',
      'auth.unauthorized',
      'auth.unsupported_provider',
      'onboarding.required',
      'validation.failed',
      'internal.unknown',
    ];
    for (const c of codes) {
      expect(ERROR_MESSAGES[c]).toMatch(/.+/);
    }
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail.**

```bash
pnpm --filter @rapih/shared test
```

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Create `packages/shared/src/auth/enums.ts`**

```ts
import { z } from 'zod';

export const SocialProviderSchema = z.enum(['google', 'apple']);
export type SocialProvider = z.infer<typeof SocialProviderSchema>;

export const UserTierSchema = z.enum(['free', 'plus', 'pro']);
export type UserTier = z.infer<typeof UserTierSchema>;

/**
 * IncomeRange uses `r3to7` etc. instead of `3to7` because Prisma enum
 * values cannot start with a digit. Mobile sends the `r`-prefixed form.
 */
export const IncomeRangeSchema = z.enum([
  'lt3',
  'r3to7',
  'r7to15',
  'r15to30',
  'gt30',
  'variable',
]);
export type IncomeRange = z.infer<typeof IncomeRangeSchema>;

export const PrimaryGoalSchema = z.enum([
  'save',
  'track',
  'goal',
  'invest',
  'debt',
  'bills',
]);
export type PrimaryGoal = z.infer<typeof PrimaryGoalSchema>;

export const incomeRangeLabel: Record<IncomeRange, string> = {
  lt3: '< Rp 3jt',
  r3to7: 'Rp 3 – 7jt',
  r7to15: 'Rp 7 – 15jt',
  r15to30: 'Rp 15 – 30jt',
  gt30: '> Rp 30jt',
  variable: 'Belum tetap',
};

export const primaryGoalLabel: Record<PrimaryGoal, string> = {
  save: 'Mulai nabung',
  track: 'Catat pengeluaran',
  goal: 'Wujudkan goal',
  invest: 'Mulai investasi',
  debt: 'Lunasi utang',
  bills: 'Atur tagihan rutin',
};
```

- [ ] **Step 4: Create `packages/shared/src/auth/index.ts`**

```ts
export * from './enums.js';
```

- [ ] **Step 5: Create `packages/shared/src/errors.ts`**

```ts
/**
 * Canonical error codes the API throws. Keep this list in sync with the
 * `ErrorCode` union in `apps/api/src/lib/errors.ts` consumers and with
 * Spine § 7. Add new codes here BEFORE throwing them.
 */
export const ERROR_MESSAGES = {
  'auth.invalid_token': 'Token tidak valid.',
  'auth.token_expired': 'Sesi sudah kadaluarsa, silakan masuk kembali.',
  'auth.token_reused': 'Sesi tidak aman, silakan masuk kembali di semua perangkat.',
  'auth.unauthorized': 'Anda harus masuk dulu.',
  'auth.unsupported_provider': 'Provider tidak dikenali.',
  'onboarding.required': 'Lengkapi onboarding dulu untuk lanjut.',
  'validation.failed': 'Validasi gagal.',
  'internal.unknown': 'Terjadi kesalahan pada server.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function isErrorCode(s: string): s is ErrorCode {
  return Object.hasOwn(ERROR_MESSAGES, s);
}
```

- [ ] **Step 6: Run the tests to confirm they pass.**

```bash
pnpm --filter @rapih/shared test
```

Expected: every case PASS.

- [ ] **Step 7: Commit.**

```bash
git add packages/shared/src/auth/enums.ts packages/shared/src/auth/index.ts packages/shared/src/errors.ts packages/shared/tests/enums.test.ts packages/shared/tests/errors.test.ts
git commit -m "feat(api-auth-social): add shared auth enums + error codes"
```

---

## Task 4: Shared auth zod schemas (TDD)

**Files:**
- Test: `packages/shared/tests/schemas.test.ts`
- Create: `packages/shared/src/auth/schemas.ts`
- Modify: `packages/shared/src/auth/index.ts`

- [ ] **Step 1: Write the failing tests.**

Create `packages/shared/tests/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AppleSignInBody,
  AuthSessionResponse,
  GoogleSignInBody,
  LogoutBody,
  MeResponse,
  OnboardingBody,
  RefreshBody,
  UserDto,
} from '../src/auth/schemas.js';

describe('auth schemas', () => {
  it('GoogleSignInBody requires id_token', () => {
    expect(GoogleSignInBody.safeParse({ id_token: 'abc' }).success).toBe(true);
    expect(GoogleSignInBody.safeParse({}).success).toBe(false);
    expect(GoogleSignInBody.safeParse({ id_token: '' }).success).toBe(false);
  });

  it('AppleSignInBody requires id_token, optional name', () => {
    expect(AppleSignInBody.safeParse({ id_token: 'abc' }).success).toBe(true);
    expect(
      AppleSignInBody.safeParse({
        id_token: 'abc',
        name: { firstName: 'Ridho', lastName: 'Idris' },
      }).success,
    ).toBe(true);
    expect(
      AppleSignInBody.safeParse({ id_token: 'abc', name: { firstName: 'R' } }).success,
    ).toBe(true);
  });

  it('RefreshBody and LogoutBody require refresh_token', () => {
    expect(RefreshBody.safeParse({ refresh_token: 'abc' }).success).toBe(true);
    expect(RefreshBody.safeParse({}).success).toBe(false);
    expect(LogoutBody.safeParse({ refresh_token: 'abc' }).success).toBe(true);
  });

  it('OnboardingBody requires nickname (1-30) + income + goal', () => {
    expect(
      OnboardingBody.safeParse({
        nickname: 'Ridho',
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(true);
    expect(
      OnboardingBody.safeParse({
        nickname: '',
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
    expect(
      OnboardingBody.safeParse({
        nickname: 'x'.repeat(31),
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
    expect(
      OnboardingBody.safeParse({
        nickname: 'Ridho',
        income_range: 'bogus',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
  });

  it('UserDto + MeResponse + AuthSessionResponse parse a full payload', () => {
    const userDto = {
      id: 'clx_user',
      email: 'r@example.com',
      name: 'Ridho',
      tier: 'free' as const,
      email_verified_at: new Date().toISOString(),
      onboarding_completed_at: null,
      profile: null,
      created_at: new Date().toISOString(),
    };
    expect(UserDto.safeParse(userDto).success).toBe(true);
    expect(MeResponse.safeParse({ ok: true, data: { user: userDto } }).success).toBe(true);
    expect(
      AuthSessionResponse.safeParse({
        ok: true,
        data: {
          access_token: 'jwt',
          refresh_token: 'r'.repeat(64),
          user: userDto,
        },
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail.**

```bash
pnpm --filter @rapih/shared test schemas
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Create `packages/shared/src/auth/schemas.ts`**

```ts
import { z } from 'zod';
import { IncomeRangeSchema, PrimaryGoalSchema, UserTierSchema } from './enums.js';

// ─── Request bodies ───────────────────────────────────────────────────────

export const GoogleSignInBody = z.object({
  id_token: z.string().min(1),
});
export type GoogleSignInBody = z.infer<typeof GoogleSignInBody>;

export const AppleSignInBody = z.object({
  id_token: z.string().min(1),
  name: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBody>;

export const RefreshBody = z.object({ refresh_token: z.string().min(1) });
export type RefreshBody = z.infer<typeof RefreshBody>;

export const LogoutBody = z.object({ refresh_token: z.string().min(1) });
export type LogoutBody = z.infer<typeof LogoutBody>;

export const OnboardingBody = z.object({
  nickname: z.string().trim().min(1).max(30),
  income_range: IncomeRangeSchema,
  primary_goal: PrimaryGoalSchema,
});
export type OnboardingBody = z.infer<typeof OnboardingBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const UserProfileDto = z.object({
  nickname: z.string().nullable(),
  income_range: IncomeRangeSchema.nullable(),
  primary_goal: PrimaryGoalSchema.nullable(),
});
export type UserProfileDto = z.infer<typeof UserProfileDto>;

export const UserDto = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  tier: UserTierSchema,
  email_verified_at: z.string().nullable(),
  onboarding_completed_at: z.string().nullable(),
  profile: UserProfileDto.nullable(),
  created_at: z.string(),
});
export type UserDto = z.infer<typeof UserDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const AuthSessionResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    user: UserDto,
  }),
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponse>;

export const RefreshResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const MeResponse = z.object({
  ok: z.literal(true),
  data: z.object({ user: UserDto }),
});
export type MeResponse = z.infer<typeof MeResponse>;
```

- [ ] **Step 4: Update `packages/shared/src/auth/index.ts` to re-export schemas.**

Replace the file's contents with:

```ts
export * from './enums.js';
export * from './schemas.js';
```

- [ ] **Step 5: Run tests to confirm they pass.**

```bash
pnpm --filter @rapih/shared test
```

Expected: every case PASS.

- [ ] **Step 6: Build the package once so `dist/` exists for downstream consumers.**

```bash
pnpm --filter @rapih/shared build
ls packages/shared/dist
```

Expected: `dist/` contains `index.js`, `index.d.ts`, plus an `auth/` subfolder. If TS errors appear, fix them before continuing.

- [ ] **Step 7: Commit.**

```bash
git add packages/shared/src/auth/schemas.ts packages/shared/src/auth/index.ts packages/shared/tests/schemas.test.ts
git commit -m "feat(api-auth-social): add shared auth zod schemas + DTOs"
```

---

## Task 5: `packages/db` skeleton + Prisma schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/biome.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/.gitignore`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@rapih/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "prisma"],
  "scripts": {
    "build": "prisma generate && tsc -p tsconfig.json",
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "lint": "biome check src",
    "check": "tsc --noEmit && biome check src"
  },
  "dependencies": {
    "@prisma/client": "^6.1.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@types/node": "^22.10.0",
    "prisma": "^6.1.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/db/biome.json`**

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
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  }
}
```

- [ ] **Step 4: Create `packages/db/.gitignore`**

```
dist/
node_modules/
```

(Generated Prisma client lives in `node_modules/.prisma/client` per the generator config — already covered by repo-root `.gitignore`.)

- [ ] **Step 5: Create `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
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

- [ ] **Step 6: Create `packages/db/src/index.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

let cached: PrismaClient | undefined;

export interface CreatePrismaClientOpts {
  databaseUrl: string;
  log?: ('query' | 'info' | 'warn' | 'error')[];
}

export function createPrismaClient(opts: CreatePrismaClientOpts): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: opts.databaseUrl } },
    log: opts.log ?? ['error', 'warn'],
  });
}

export function getSharedPrismaClient(opts: CreatePrismaClientOpts): PrismaClient {
  if (!cached) cached = createPrismaClient(opts);
  return cached;
}
```

- [ ] **Step 7: Install + generate Prisma client.**

```bash
pnpm install
pnpm --filter @rapih/db exec prisma generate
```

Expected: `pnpm install` succeeds; `prisma generate` reports successful generation. If it complains about `DATABASE_URL` missing during `generate`, set a dummy in env: `DATABASE_URL='postgresql://x:x@x/x' pnpm --filter @rapih/db exec prisma generate`.

- [ ] **Step 8: Build the package.**

```bash
DATABASE_URL='postgresql://x:x@x/x' pnpm --filter @rapih/db build
ls packages/db/dist
```

Expected: `dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 9: Commit.**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/biome.json packages/db/.gitignore packages/db/prisma/schema.prisma packages/db/src/index.ts pnpm-lock.yaml
git commit -m "feat(api-auth-social): scaffold @rapih/db with Prisma schema"
```

---

## Task 6: Generate the initial migration

**Files:**
- Create: `packages/db/prisma/migrations/.../migration.sql`
- Create: `packages/db/prisma/migrations/migration_lock.toml`

- [ ] **Step 1: Ensure local Postgres is up.**

```bash
docker compose -f infra/docker-compose.dev.yml up -d
docker exec rapih-postgres-dev pg_isready -U rapih -d rapih
```

Expected: `accepting connections`.

If docker is unavailable, write a blocker in `docs/superpowers/notes/api-auth-social-blockers.md` with one line: `Task 6: docker not available; migration not yet generated, deferred to human verification.` Then SKIP the rest of this task and continue to Task 7. The migration will be generated by the operator on first deploy.

- [ ] **Step 2: Run `prisma migrate dev` to create the initial migration.**

```bash
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate dev --name initial_auth_social --create-only
```

`--create-only` writes the SQL but does not yet apply (we'll apply explicitly so the output is auditable).

Expected: a new folder under `packages/db/prisma/migrations/` named `<timestamp>_initial_auth_social/` containing `migration.sql`. Open the SQL and verify it CREATEs the four tables and four enums (no random extras).

- [ ] **Step 3: Apply the migration.**

```bash
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate deploy
```

Expected: "All migrations have been successfully applied."

- [ ] **Step 4: Sanity-check tables.**

```bash
docker exec -i rapih-postgres-dev psql -U rapih -d rapih -c '\dt'
```

Expected: rows for `users`, `social_accounts`, `refresh_tokens`, `user_profiles` (plus Prisma's `_prisma_migrations` table).

- [ ] **Step 5: Commit.**

```bash
git add packages/db/prisma/migrations
git commit -m "feat(api-auth-social): initial Prisma migration (auth tables)"
```

---

## Task 7: Wire `@rapih/db` + `@rapih/shared` into `apps/api`

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/src/config/env.ts`
- Test: `apps/api/tests/env.test.ts` (extend)

- [ ] **Step 1: Update `apps/api/package.json` dependencies.**

Replace the `dependencies` block with:

```json
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "@fastify/jwt": "^9.0.4",
    "@fastify/rate-limit": "^10.2.2",
    "@fastify/sensible": "^6.0.1",
    "@fastify/swagger": "^9.4.0",
    "@fastify/swagger-ui": "^5.2.0",
    "@rapih/db": "workspace:*",
    "@rapih/shared": "workspace:*",
    "dotenv": "^16.4.5",
    "fastify": "^5.1.0",
    "fastify-type-provider-zod": "^4.0.2",
    "jose": "^5.9.6",
    "ua-parser-js": "^2.0.0",
    "zod": "^3.23.8"
  },
```

(Leave `devDependencies` unchanged.)

- [ ] **Step 2: Update `apps/api/.env.example` with the new vars from spec § 8.**

Replace its contents with:

```
NODE_ENV=development
PORT=3001
APP_PUBLIC_URL=http://localhost:8081
API_PUBLIC_URL=http://localhost:3001

# Database (local docker-compose: see infra/docker-compose.dev.yml)
DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih

# JWT
JWT_ACCESS_SECRET=dev-secret-change-me-32-chars-min-aaaaaaaaaaa
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000

# Social auth (comma-separated)
GOOGLE_OAUTH_CLIENT_IDS=local-dev-google-id
APPLE_OAUTH_CLIENT_IDS=local-dev-apple-id
```

- [ ] **Step 3: Add new env tests.**

Append to `apps/api/tests/env.test.ts` (do not duplicate the existing tests — only add the cases below within the existing `describe('loadEnv', ...)` block, after the last existing `it()`):

```ts
  it('parses DATABASE_URL, JWT secrets, and OAuth client id lists', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'a.apps.googleusercontent.com,b.apps.googleusercontent.com';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'app.rapih.ios';

    const { loadEnv } = await import('../src/config/env.js');
    const env = loadEnv();

    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.JWT_REFRESH_TTL_SECONDS).toBe(2592000);
    expect(env.GOOGLE_OAUTH_CLIENT_IDS).toEqual([
      'a.apps.googleusercontent.com',
      'b.apps.googleusercontent.com',
    ]);
    expect(env.APPLE_OAUTH_CLIENT_IDS).toEqual(['app.rapih.ios']);
  });

  it('rejects a JWT_ACCESS_SECRET shorter than 32 chars', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'short';
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'a';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects empty OAuth client id lists', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = '';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/GOOGLE_OAUTH_CLIENT_IDS/);
  });
```

Also add this to the cleanup loop at the top of the existing `describe`:

Find the current `for (const key of [...]) delete process.env[key];` line and replace the array with:

```ts
    for (const key of [
      'NODE_ENV',
      'PORT',
      'APP_PUBLIC_URL',
      'API_PUBLIC_URL',
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_ACCESS_TTL_SECONDS',
      'JWT_REFRESH_TTL_SECONDS',
      'GOOGLE_OAUTH_CLIENT_IDS',
      'APPLE_OAUTH_CLIENT_IDS',
    ]) {
      delete process.env[key];
    }
```

- [ ] **Step 4: Run the tests to confirm they fail.**

```bash
pnpm --filter @rapih/api test env
```

Expected: FAIL — env loader doesn't yet know about the new fields. The existing three tests still pass.

- [ ] **Step 5: Replace `apps/api/src/config/env.ts` with the extended schema.**

```ts
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const CommaList = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  )
  .refine((arr) => arr.length > 0, { message: 'must contain at least one value' });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  GOOGLE_OAUTH_CLIENT_IDS: CommaList,
  APPLE_OAUTH_CLIENT_IDS: CommaList,
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

- [ ] **Step 6: Run install + tests + check.**

```bash
pnpm install
pnpm --filter @rapih/api test env
pnpm --filter @rapih/api check
```

Expected: install succeeds (workspace `@rapih/db` and `@rapih/shared` resolve). Env tests pass. `check` passes.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/package.json apps/api/.env.example apps/api/src/config/env.ts apps/api/tests/env.test.ts pnpm-lock.yaml
git commit -m "feat(api-auth-social): wire @rapih/db + @rapih/shared into apps/api, extend env schema"
```

---

## Task 8: Token utilities (TDD)

**Files:**
- Test: `apps/api/tests/auth-tokens.test.ts`
- Create: `apps/api/src/auth/tokens.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/auth-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/auth/tokens.js';

const SECRET = 'a'.repeat(32);

describe('auth/tokens', () => {
  it('generates 64-char hex refresh tokens that are unique', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hashRefreshToken is deterministic and 64 hex chars', () => {
    const t = generateRefreshToken();
    const h1 = hashRefreshToken(t);
    const h2 = hashRefreshToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
  });

  it('signAccessToken + verifyAccessToken round-trip with claims', () => {
    const jwt = signAccessToken({
      userId: 'clx_user',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: 900,
    });
    const claims = verifyAccessToken(jwt, SECRET);
    expect(claims.sub).toBe('clx_user');
    expect(claims.tier).toBe('free');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
  });

  it('verifyAccessToken throws on bad signature', () => {
    const jwt = signAccessToken({
      userId: 'clx_user',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: 900,
    });
    expect(() => verifyAccessToken(jwt, 'b'.repeat(32))).toThrow();
  });

  it('verifyAccessToken throws on expired token', () => {
    const jwt = signAccessToken({
      userId: 'u',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: -10, // already expired
    });
    expect(() => verifyAccessToken(jwt, SECRET)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-tokens
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `apps/api/src/auth/tokens.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface SignAccessOpts {
  userId: string;
  tier: 'free' | 'plus' | 'pro';
  secret: string;
  ttlSeconds: number;
}

export interface AccessClaims {
  sub: string;
  tier: 'free' | 'plus' | 'pro';
  iat: number;
  exp: number;
}

export function signAccessToken(opts: SignAccessOpts): string {
  return jwt.sign({ tier: opts.tier }, opts.secret, {
    subject: opts.userId,
    expiresIn: opts.ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('invalid access token payload');
  }
  const { sub, tier, iat, exp } = decoded as Record<string, unknown>;
  if (
    typeof sub !== 'string' ||
    (tier !== 'free' && tier !== 'plus' && tier !== 'pro') ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    throw new Error('invalid access token claims');
  }
  return { sub, tier, iat, exp };
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashRefreshToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}
```

The plan uses `jsonwebtoken` (a battle-tested standalone HS256 lib) for sign/verify so the helper has zero Fastify coupling and is testable in isolation. `@fastify/jwt` (added later as a route decorator) wraps the same internals; we keep both for ergonomics — the decorator does the bearer header parsing while these helpers handle pure token ops.

Add the runtime dep:

```bash
pnpm --filter @rapih/api add jsonwebtoken@^9.0.2
pnpm --filter @rapih/api add -D @types/jsonwebtoken@^9.0.7
```

- [ ] **Step 4: Run the test to confirm it passes.**

```bash
pnpm --filter @rapih/api test auth-tokens
pnpm --filter @rapih/api check
```

Expected: PASS, `check` exits 0.

- [ ] **Step 5: Commit.**

```bash
git add apps/api/src/auth/tokens.ts apps/api/tests/auth-tokens.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api-auth-social): add token utilities (sign/verify/hash/generate)"
```

---

## Task 9: Email + device-label utilities (TDD)

**Files:**
- Test: `apps/api/tests/auth-utils.test.ts`
- Create: `apps/api/src/auth/email.ts`
- Create: `apps/api/src/auth/device.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/auth-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDeviceLabel } from '../src/auth/device.js';
import { isApplePrivateRelay, normalizeEmail } from '../src/auth/email.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  R@Example.COM ')).toBe('r@example.com');
  });
});

describe('isApplePrivateRelay', () => {
  it('detects @privaterelay.appleid.com', () => {
    expect(isApplePrivateRelay('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isApplePrivateRelay('ridho@gmail.com')).toBe(false);
  });
});

describe('parseDeviceLabel', () => {
  it('parses an iOS UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    const label = parseDeviceLabel(ua);
    expect(label).toBeDefined();
    expect(label).toMatch(/iPhone|iOS/i);
  });

  it('parses an Android UA', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
    const label = parseDeviceLabel(ua);
    expect(label).toBeDefined();
    expect(label).toMatch(/Android|Pixel/i);
  });

  it('returns null for missing UA', () => {
    expect(parseDeviceLabel(undefined)).toBeNull();
    expect(parseDeviceLabel('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-utils
```

Expected: FAIL.

- [ ] **Step 3: Create `apps/api/src/auth/email.ts`**

```ts
const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isApplePrivateRelay(email: string): boolean {
  return normalizeEmail(email).endsWith(APPLE_RELAY_SUFFIX);
}
```

- [ ] **Step 4: Create `apps/api/src/auth/device.ts`**

```ts
import { UAParser } from 'ua-parser-js';

/**
 * Parses a User-Agent string into a short, human-readable device label
 * we store on `refresh_tokens.device_label`. Returns null if UA is missing
 * or unparseable.
 */
export function parseDeviceLabel(userAgent: string | undefined | null): string | null {
  if (!userAgent || userAgent.trim().length === 0) return null;

  const parser = new UAParser(userAgent);
  const os = parser.getOS();
  const device = parser.getDevice();
  const browser = parser.getBrowser();

  const parts: string[] = [];
  if (device.model) parts.push(device.model);
  else if (os.name) parts.push(os.name);

  const osVersion = os.version ? ` ${os.version.split('.').slice(0, 2).join('.')}` : '';
  const osLabel = os.name ? `${os.name}${osVersion}` : null;

  if (osLabel && !parts[0]?.toLowerCase().includes(os.name?.toLowerCase() ?? '')) {
    parts.push(osLabel);
  }

  if (browser.name && parts.length < 2) parts.push(browser.name);

  const label = parts.filter(Boolean).join(' · ').trim();
  return label.length > 0 ? label.slice(0, 80) : null;
}
```

- [ ] **Step 5: Run the test to confirm it passes.**

```bash
pnpm --filter @rapih/api test auth-utils
pnpm --filter @rapih/api check
```

Expected: PASS, check exits 0.

- [ ] **Step 6: Commit.**

```bash
git add apps/api/src/auth/email.ts apps/api/src/auth/device.ts apps/api/tests/auth-utils.test.ts
git commit -m "feat(api-auth-social): add email + device-label utilities"
```

---

## Task 10: JWKS test mock + ID-token verification (TDD)

**Files:**
- Create: `apps/api/tests/helpers/jwks-mock.ts`
- Test: `apps/api/tests/auth-verify-id-token.test.ts`
- Create: `apps/api/src/auth/jwks.ts`
- Create: `apps/api/src/auth/verify-id-token.ts`

- [ ] **Step 1: Create the JWKS mock helper.**

`apps/api/tests/helpers/jwks-mock.ts`:

```ts
import { exportJWK, generateKeyPair, SignJWT, type KeyLike, type JWK } from 'jose';

export interface MockKey {
  kid: string;
  privateKey: KeyLike;
  jwk: JWK;
}

export interface MockJwksServer {
  url: string;
  keys: MockKey[];
  close: () => Promise<void>;
}

export async function createMockJwks(opts: { kid?: string } = {}): Promise<MockJwksServer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = opts.kid ?? 'test-kid';
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  const { default: Fastify } = await import('fastify');
  const app = Fastify({ logger: false });
  app.get('/jwks', async () => ({ keys: [publicJwk] }));

  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('mock jwks server failed to bind');
  }

  return {
    url: `http://127.0.0.1:${address.port}/jwks`,
    keys: [{ kid, privateKey, jwk: publicJwk }],
    async close() {
      await app.close();
    },
  };
}

export async function signMockIdToken(
  key: MockKey,
  payload: Record<string, unknown>,
  opts: { iss: string; aud: string; expSeconds?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid })
    .setIssuer(opts.iss)
    .setAudience(opts.aud)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expSeconds ?? 3600))
    .sign(key.privateKey);
}
```

- [ ] **Step 2: Write the failing test.**

`apps/api/tests/auth-verify-id-token.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockJwks, signMockIdToken, type MockJwksServer } from './helpers/jwks-mock.js';
import {
  verifyAppleIdToken,
  verifyGoogleIdToken,
} from '../src/auth/verify-id-token.js';

describe('verifyGoogleIdToken (mocked JWKS)', () => {
  let jwks: MockJwksServer;
  const audience = 'test.apps.googleusercontent.com';
  const issuer = 'https://accounts.google.com';

  beforeAll(async () => {
    jwks = await createMockJwks({ kid: 'g-test' });
  });

  afterAll(async () => {
    await jwks.close();
  });

  it('verifies a valid Google id_token', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'g-user-1', email: 'r@gmail.com', email_verified: true, name: 'Ridho' },
      { iss: issuer, aud: audience },
    );
    const claims = await verifyGoogleIdToken(token, {
      audiences: [audience],
      jwksUrl: jwks.url,
    });
    expect(claims.sub).toBe('g-user-1');
    expect(claims.email).toBe('r@gmail.com');
    expect(claims.email_verified).toBe(true);
    expect(claims.name).toBe('Ridho');
  });

  it('rejects when audience mismatches', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'g-user-2', email: 'a@gmail.com', email_verified: true },
      { iss: issuer, aud: 'other.apps.googleusercontent.com' },
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url }),
    ).rejects.toThrow();
  });

  it('rejects when issuer mismatches', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'g-user-3', email: 'a@gmail.com', email_verified: true },
      { iss: 'https://evil.example.com', aud: audience },
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url }),
    ).rejects.toThrow();
  });

  it('rejects when email_verified is false', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'g-user-4', email: 'a@gmail.com', email_verified: false },
      { iss: issuer, aud: audience },
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url }),
    ).rejects.toThrow();
  });
});

describe('verifyAppleIdToken (mocked JWKS)', () => {
  let jwks: MockJwksServer;
  const audience = 'app.rapih.ios';
  const issuer = 'https://appleid.apple.com';

  beforeAll(async () => {
    jwks = await createMockJwks({ kid: 'a-test' });
  });

  afterAll(async () => {
    await jwks.close();
  });

  it('verifies a valid Apple id_token without email_verified claim', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'a-user-1', email: 'a@privaterelay.appleid.com' },
      { iss: issuer, aud: audience },
    );
    const claims = await verifyAppleIdToken(token, {
      audiences: [audience],
      jwksUrl: jwks.url,
    });
    expect(claims.sub).toBe('a-user-1');
    expect(claims.email).toBe('a@privaterelay.appleid.com');
  });

  it('rejects expired tokens', async () => {
    const token = await signMockIdToken(
      jwks.keys[0]!,
      { sub: 'a-user-2', email: 'a@example.com' },
      { iss: issuer, aud: audience, expSeconds: -10 },
    );
    await expect(
      verifyAppleIdToken(token, { audiences: [audience], jwksUrl: jwks.url }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail.**

```bash
pnpm --filter @rapih/api test auth-verify-id-token
```

Expected: FAIL — verify modules don't exist.

- [ ] **Step 4: Create `apps/api/src/auth/jwks.ts`**

```ts
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

const cache = new Map<string, JWTVerifyGetKey>();

function getOrCreate(url: string): JWTVerifyGetKey {
  const existing = cache.get(url);
  if (existing) return existing;
  const set = createRemoteJWKSet(new URL(url), {
    cacheMaxAge: 10 * 60 * 1000, // 10 min
    cooldownDuration: 30 * 1000, // 30s
  });
  cache.set(url, set);
  return set;
}

export function googleJwks(overrideUrl?: string): JWTVerifyGetKey {
  return getOrCreate(overrideUrl ?? GOOGLE_JWKS_URL);
}

export function appleJwks(overrideUrl?: string): JWTVerifyGetKey {
  return getOrCreate(overrideUrl ?? APPLE_JWKS_URL);
}
```

- [ ] **Step 5: Create `apps/api/src/auth/verify-id-token.ts`**

```ts
import { jwtVerify } from 'jose';
import { AppError } from '../lib/errors.js';
import { appleJwks, googleJwks } from './jwks.js';

export interface VerifyOpts {
  audiences: string[];
  jwksUrl?: string;
}

export interface SocialClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

export async function verifyGoogleIdToken(token: string, opts: VerifyOpts): Promise<SocialClaims> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, googleJwks(opts.jwksUrl), {
      issuer: GOOGLE_ISSUERS,
      audience: opts.audiences,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401, {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  const sub = payload.sub;
  const email = payload.email;
  const emailVerified = payload.email_verified;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
  }
  if (emailVerified !== true) {
    throw new AppError('auth.invalid_token', 'Email Google belum terverifikasi.', 401);
  }

  return {
    sub,
    email,
    email_verified: true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

export async function verifyAppleIdToken(token: string, opts: VerifyOpts): Promise<SocialClaims> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, appleJwks(opts.jwksUrl), {
      issuer: APPLE_ISSUER,
      audience: opts.audiences,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401, {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
  }

  return { sub, email };
}
```

- [ ] **Step 6: Run the tests to confirm they pass.**

```bash
pnpm --filter @rapih/api test auth-verify-id-token
pnpm --filter @rapih/api check
```

Expected: every case PASS, check exits 0.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/tests/helpers apps/api/tests/auth-verify-id-token.test.ts apps/api/src/auth/jwks.ts apps/api/src/auth/verify-id-token.ts
git commit -m "feat(api-auth-social): JWKS verify helpers + mock JWKS test infra"
```

---

## Task 11: Test DB lifecycle helper + social user upsert (TDD)

**Files:**
- Create: `apps/api/tests/helpers/test-db.ts`
- Create: `apps/api/tests/helpers/test-env.ts`
- Test: `apps/api/tests/auth-upsert-user.test.ts`
- Create: `apps/api/src/auth/upsert-user.ts`
- Modify: `apps/api/vitest.config.ts` (add globalSetup)

**Postgres prerequisite:** Tasks 11 onward exercise the database. Ensure `docker compose -f infra/docker-compose.dev.yml up -d` is running. If Postgres is not available, write a blocker in `docs/superpowers/notes/api-auth-social-blockers.md` and SKIP every DB-touching task (11–17, 20). Each non-DB code module is still implementable; DB integration tests will be deferred to human verification.

- [ ] **Step 1: Set up an isolated test database.**

Create `apps/api/tests/helpers/test-env.ts`:

```ts
/**
 * Sets the required env vars for an integration test before importing the
 * app or database modules. Idempotent — call at the top of each test file
 * BEFORE any `import { ... } from '../src/...'`.
 */
export function setTestEnv(): void {
  process.env.NODE_ENV ??= 'test';
  process.env.APP_PUBLIC_URL ??= 'http://localhost:8081';
  process.env.API_PUBLIC_URL ??= 'http://localhost:3001';
  process.env.DATABASE_URL ??=
    'postgresql://rapih:rapih@localhost:5433/rapih_test';
  process.env.JWT_ACCESS_SECRET ??= 'test-secret-' + 'a'.repeat(32);
  process.env.JWT_ACCESS_TTL_SECONDS ??= '900';
  process.env.JWT_REFRESH_TTL_SECONDS ??= '2592000';
  process.env.GOOGLE_OAUTH_CLIENT_IDS ??= 'test.apps.googleusercontent.com';
  process.env.APPLE_OAUTH_CLIENT_IDS ??= 'app.rapih.ios';
}
```

Create `apps/api/tests/helpers/test-db.ts`:

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

/**
 * Truncates user-data tables. Call from `beforeEach` in every DB test.
 */
export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "social_accounts", "user_profiles", "users" RESTART IDENTITY CASCADE',
  );
}

/**
 * Run-once setup. Creates the test database (if missing) and applies
 * migrations. Wired via vitest globalSetup.
 */
export async function setupTestDb(): Promise<void> {
  // Ensure the test database exists.
  const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]+(\?.*)?$/, '/postgres$1');
  const dbName = (TEST_DATABASE_URL.match(/\/([^/?]+)(\?.*)?$/)?.[1]) ?? 'rapih_test';

  const { Client } = await import('pg');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  // Apply migrations.
  execSync('pnpm --filter @rapih/db exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

export async function teardownTestDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.$disconnect();
    cachedClient = undefined;
  }
}
```

Add `pg` as a dev dep:

```bash
pnpm --filter @rapih/api add -D pg@^8.13.1 @types/pg@^8.11.10
```

- [ ] **Step 2: Wire vitest globalSetup.**

Replace `apps/api/vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    globalSetup: ['tests/helpers/global-setup.ts'],
    pool: 'forks', // ensures global setup runs once per file; avoids prisma client conflicts
    fileParallelism: false, // serialize tests against the shared test DB
  },
});
```

Create `apps/api/tests/helpers/global-setup.ts`:

```ts
import { setTestEnv } from './test-env.js';
import { setupTestDb, teardownTestDb } from './test-db.js';

export default async function globalSetup() {
  setTestEnv();
  try {
    await setupTestDb();
  } catch (err) {
    console.warn(
      '[vitest globalSetup] failed to set up test DB; DB-backed tests will fail. Reason:',
      err instanceof Error ? err.message : err,
    );
    // Do not throw — tests that don't touch the DB should still run, but
    // DB tests will surface the real error. This makes the failure mode
    // local to each test, not a fatal global error.
  }
  return async () => {
    await teardownTestDb();
  };
}
```

- [ ] **Step 3: Write the failing test.**

Create `apps/api/tests/auth-upsert-user.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { upsertUserFromSocial } from '../src/auth/upsert-user.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';

const prisma = getTestPrisma();

describe('upsertUserFromSocial', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates a brand-new user + social account + empty profile', async () => {
    const user = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-1',
      email: 'r@gmail.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });

    expect(user.email).toBe('r@gmail.com');
    expect(user.name).toBe('Ridho');
    expect(user.tier).toBe('free');
    expect(user.profile).toBeDefined();

    const socials = await prisma.socialAccount.findMany({ where: { user_id: user.id } });
    expect(socials).toHaveLength(1);
    expect(socials[0]!.provider).toBe('google');
    expect(socials[0]!.provider_user_id).toBe('g-1');
  });

  it('returns the same user on a repeat sign-in (same provider sub)', async () => {
    const a = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-2',
      email: 'r@gmail.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    const b = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-2',
      email: 'r@gmail.com',
      name: 'Different',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('Ridho'); // first-write-wins on name; not bumped on repeat sign-in
  });

  it('links a new social account to an existing user when emails match', async () => {
    const google = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-3',
      email: 'r@example.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    const apple = await upsertUserFromSocial(prisma, {
      provider: 'apple',
      providerUserId: 'a-3',
      email: 'r@example.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    expect(apple.id).toBe(google.id);
    const socials = await prisma.socialAccount.findMany({ where: { user_id: google.id } });
    expect(socials).toHaveLength(2);
  });

  it('marks Apple private-relay correctly', async () => {
    const user = await upsertUserFromSocial(prisma, {
      provider: 'apple',
      providerUserId: 'a-relay',
      email: 'abc@privaterelay.appleid.com',
      name: 'Pengguna Rapih',
      isApplePrivateRelay: true,
      emailVerifiedAt: new Date(),
    });
    expect(user.apple_private_relay).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-upsert-user
```

Expected: FAIL — `upsert-user.ts` doesn't exist. (If the global setup fails because docker is down, write a blocker and skip — see prerequisite at the top of this task.)

- [ ] **Step 5: Create `apps/api/src/auth/upsert-user.ts`**

```ts
import type { PrismaClient, User, UserProfile } from '@rapih/db';
import { normalizeEmail } from './email.js';

export interface UpsertSocialUserOpts {
  provider: 'google' | 'apple';
  providerUserId: string;
  email: string;
  name: string;
  isApplePrivateRelay: boolean;
  emailVerifiedAt: Date;
}

export interface UpsertedUser extends User {
  profile: UserProfile | null;
}

export async function upsertUserFromSocial(
  prisma: PrismaClient,
  opts: UpsertSocialUserOpts,
): Promise<UpsertedUser> {
  const email = normalizeEmail(opts.email);

  return prisma.$transaction(async (tx) => {
    // 1. Existing social account → return its user.
    const existingSocial = await tx.socialAccount.findUnique({
      where: {
        provider_provider_user_id: {
          provider: opts.provider,
          provider_user_id: opts.providerUserId,
        },
      },
      include: { user: { include: { profile: true } } },
    });
    if (existingSocial) {
      return existingSocial.user;
    }

    // 2. Existing user by email → link new social account.
    const existingUser = await tx.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (existingUser) {
      await tx.socialAccount.create({
        data: {
          user_id: existingUser.id,
          provider: opts.provider,
          provider_user_id: opts.providerUserId,
        },
      });
      return existingUser;
    }

    // 3. Brand-new: create user + profile + social account.
    const created = await tx.user.create({
      data: {
        email,
        name: opts.name,
        email_verified_at: opts.emailVerifiedAt,
        apple_private_relay: opts.isApplePrivateRelay,
        social_accounts: {
          create: {
            provider: opts.provider,
            provider_user_id: opts.providerUserId,
          },
        },
        profile: { create: {} },
      },
      include: { profile: true },
    });
    return created;
  });
}
```

- [ ] **Step 6: Run the test to confirm it passes.**

```bash
pnpm --filter @rapih/api test auth-upsert-user
pnpm --filter @rapih/api check
```

Expected: every case PASS, check exits 0.

If global setup fails because the test DB doesn't exist or migrations didn't apply, double-check that Postgres is running on `localhost:5433` and that Task 6 created the migration file. Re-run the migration manually:

```bash
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih_test' \
  pnpm --filter @rapih/db exec prisma migrate deploy
```

- [ ] **Step 7: Commit.**

```bash
git add apps/api/tests/helpers apps/api/tests/auth-upsert-user.test.ts apps/api/src/auth/upsert-user.ts apps/api/vitest.config.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api-auth-social): test DB harness + upsertUserFromSocial"
```

---

## Task 12: User DTO mapper + DB plugin + auth decorators (TDD)

**Files:**
- Test: `apps/api/tests/auth-decorators.test.ts`
- Create: `apps/api/src/lib/dto.ts`
- Create: `apps/api/src/plugins/db.ts`
- Create: `apps/api/src/auth/decorators.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/auth-decorators.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';

const prisma = getTestPrisma();

describe('auth decorators (authenticate + requireOnboarding)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    // Mount test-only routes that exercise the decorators.
    app.get(
      '/__test/protected',
      { onRequest: [app.authenticate] },
      async (req) => ({ ok: true, data: { sub: req.user.id } }),
    );
    app.get(
      '/__test/onboarded',
      { onRequest: [app.authenticate, app.requireOnboarding] },
      async (req) => ({ ok: true, data: { sub: req.user.id } }),
    );
    await app.ready();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no bearer is sent', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.unauthorized');
  });

  it('returns 401 on a bad bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: 'Bearer bad.signed.token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('passes through a valid bearer', async () => {
    const user = await prisma.user.create({
      data: { email: 'u@example.com', name: 'U' },
    });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.sub).toBe(user.id);
  });

  it('requireOnboarding blocks users without onboarding_completed_at', async () => {
    const user = await prisma.user.create({ data: { email: 'a@e.com', name: 'A' } });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/onboarded',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  it('requireOnboarding lets onboarded users through', async () => {
    const user = await prisma.user.create({
      data: { email: 'b@e.com', name: 'B', onboarding_completed_at: new Date() },
    });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/onboarded',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-decorators
```

Expected: FAIL — `app.authenticate` / `app.requireOnboarding` not yet defined.

- [ ] **Step 3: Create `apps/api/src/lib/dto.ts`**

```ts
import type { User, UserProfile } from '@rapih/db';
import type { UserDto, UserProfileDto } from '@rapih/shared';

export function userProfileToDto(p: UserProfile | null | undefined): UserProfileDto | null {
  if (!p) return null;
  return {
    nickname: p.nickname ?? null,
    income_range: p.income_range ?? null,
    primary_goal: p.primary_goal ?? null,
  };
}

export function userToDto(user: User & { profile?: UserProfile | null }): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    email_verified_at: user.email_verified_at?.toISOString() ?? null,
    onboarding_completed_at: user.onboarding_completed_at?.toISOString() ?? null,
    profile: userProfileToDto(user.profile),
    created_at: user.created_at.toISOString(),
  };
}
```

- [ ] **Step 4: Create `apps/api/src/plugins/db.ts`**

```ts
import { createPrismaClient, type PrismaClient } from '@rapih/db';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { loadEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

const dbPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const env = loadEnv();
  const prisma = createPrismaClient({
    databaseUrl: env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  await prisma.$connect();
  app.decorate('db', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(dbPlugin, { name: 'db' });
```

Add `fastify-plugin` as a dep:

```bash
pnpm --filter @rapih/api add fastify-plugin@^5.0.1
```

- [ ] **Step 5: Create `apps/api/src/auth/decorators.ts`**

```ts
import type { User } from '@rapih/db';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { loadEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOnboarding: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authDecorators: FastifyPluginAsync = async (app: FastifyInstance) => {
  const env = loadEnv();

  const authenticate = async (req: FastifyRequest, _reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    const token = header.slice('Bearer '.length).trim();
    let claims;
    try {
      claims = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    const user = await app.db.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    req.user = user;
  };

  const requireOnboarding = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    if (!req.user.onboarding_completed_at) {
      throw new AppError('onboarding.required', 'Lengkapi onboarding dulu untuk lanjut.', 403);
    }
  };

  app.decorate('authenticate', authenticate);
  app.decorate('requireOnboarding', requireOnboarding);
};

export default fp(authDecorators, { name: 'auth-decorators', dependencies: ['db'] });
```

- [ ] **Step 6: Wire the plugins into `apps/api/src/app.ts`**

Replace the file with:

```ts
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './lib/errors.js';
import authDecorators from './auth/decorators.js';
import dbPlugin from './plugins/db.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const isDev = env.NODE_ENV === 'development';

  const app = Fastify({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : env.NODE_ENV !== 'test',
    disableRequestLogging: env.NODE_ENV === 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, { origin: [env.APP_PUBLIC_URL], credentials: true });
  await app.register(dbPlugin);
  await app.register(authDecorators);
  await registerSwagger(app);

  registerErrorHandler(app, { nodeEnv: env.NODE_ENV });
  await registerRoutes(app);

  return app;
}
```

- [ ] **Step 7: Run all tests.**

```bash
pnpm --filter @rapih/api test
pnpm --filter @rapih/api check
```

Expected: every test passes, check exits 0.

- [ ] **Step 8: Commit.**

```bash
git add apps/api/src/lib/dto.ts apps/api/src/plugins/db.ts apps/api/src/auth/decorators.ts apps/api/src/app.ts apps/api/tests/auth-decorators.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api-auth-social): add db plugin, auth decorators, user DTO mapper"
```

---


## Task 13: Refresh-token rotation logic (TDD)

**Files:**
- Test: `apps/api/tests/auth-refresh-rotation.test.ts`
- Create: `apps/api/src/auth/refresh-token-store.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/auth-refresh-rotation.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import {
  createInitialRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../src/auth/refresh-token-store.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';

const prisma = getTestPrisma();

async function makeUser() {
  return prisma.user.create({ data: { email: 'r@e.com', name: 'R' } });
}

describe('refresh token rotation', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('createInitialRefreshToken issues a token + stores hashed row', async () => {
    const user = await makeUser();
    const result = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: 'iPhone',
    });
    expect(result.plain).toMatch(/^[0-9a-f]{64}$/);
    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.device_label).toBe('iPhone');
    expect(rows[0]!.token_hash).not.toBe(result.plain);
  });

  it('rotateRefreshToken issues a new token and revokes the old', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: 'Pixel',
    });

    const rotated = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: 'Pixel',
    });

    expect(rotated.kind).toBe('rotated');
    if (rotated.kind !== 'rotated') return;
    expect(rotated.userId).toBe(user.id);
    expect(rotated.plain).not.toBe(initial.plain);

    const rows = await prisma.refreshToken.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.revoked_at).not.toBeNull();
    expect(rows[0]!.replaced_by_id).toBe(rows[1]!.id);
    expect(rows[1]!.revoked_at).toBeNull();
  });

  it('rotateRefreshToken returns "not_found" for an unknown token', async () => {
    const result = await rotateRefreshToken(prisma, {
      plainToken: 'a'.repeat(64),
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(result.kind).toBe('not_found');
  });

  it('rotateRefreshToken returns "expired" for a past expires_at', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    await prisma.refreshToken.update({
      where: { token_hash: (await import('../src/auth/tokens.js')).hashRefreshToken(initial.plain) },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const result = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(result.kind).toBe('expired');
  });

  it('reuse of an already-revoked token returns "reused" and revokes the entire chain', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    const r1 = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    if (r1.kind !== 'rotated') throw new Error('precondition failed');

    const r2 = await rotateRefreshToken(prisma, {
      plainToken: initial.plain, // already revoked!
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(r2.kind).toBe('reused');

    // Every token in the chain MUST now be revoked.
    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
  });

  it('revokeRefreshToken is idempotent on unknown tokens (logout)', async () => {
    const result = await revokeRefreshToken(prisma, 'a'.repeat(64));
    expect(result.kind).toBe('not_found');
  });

  it('revokeRefreshToken marks a known token revoked but does not walk the chain', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    const result = await revokeRefreshToken(prisma, initial.plain);
    expect(result.kind).toBe('revoked');

    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.revoked_at).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-refresh-rotation
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `apps/api/src/auth/refresh-token-store.ts`**

```ts
import type { PrismaClient, RefreshToken } from '@rapih/db';
import { generateRefreshToken, hashRefreshToken } from './tokens.js';

export interface CreateInitialOpts {
  userId: string;
  ttlSeconds: number;
  deviceLabel: string | null;
}

export interface CreateInitialResult {
  plain: string;
  row: RefreshToken;
}

export async function createInitialRefreshToken(
  prisma: PrismaClient,
  opts: CreateInitialOpts,
): Promise<CreateInitialResult> {
  const plain = generateRefreshToken();
  const tokenHash = hashRefreshToken(plain);
  const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);
  const row = await prisma.refreshToken.create({
    data: {
      user_id: opts.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      device_label: opts.deviceLabel,
    },
  });
  return { plain, row };
}

export type RotateResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'reused' }
  | { kind: 'rotated'; plain: string; userId: string };

export interface RotateOpts {
  plainToken: string;
  ttlSeconds: number;
  deviceLabel: string | null;
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  opts: RotateOpts,
): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(opts.plainToken);
  const existing = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });

  if (!existing) return { kind: 'not_found' };

  if (existing.revoked_at !== null) {
    // Reuse detected — revoke the whole chain (every token belonging to this user that
    // shares this rotation lineage). Pragmatic v1 implementation: revoke ALL tokens for
    // this user. Cheaper to query than walking the chain, and equally safe.
    await prisma.refreshToken.updateMany({
      where: { user_id: existing.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { kind: 'reused' };
  }

  if (existing.expires_at.getTime() <= Date.now()) {
    return { kind: 'expired' };
  }

  // Happy path: issue a new token and link the rotation chain in one transaction.
  const newPlain = generateRefreshToken();
  const newHash = hashRefreshToken(newPlain);
  const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        user_id: existing.user_id,
        token_hash: newHash,
        expires_at: expiresAt,
        device_label: opts.deviceLabel,
      },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revoked_at: new Date(), replaced_by_id: created.id },
    });
  });

  return { kind: 'rotated', plain: newPlain, userId: existing.user_id };
}

export type RevokeResult = { kind: 'not_found' } | { kind: 'revoked' };

export async function revokeRefreshToken(
  prisma: PrismaClient,
  plainToken: string,
): Promise<RevokeResult> {
  const tokenHash = hashRefreshToken(plainToken);
  const row = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
  if (!row) return { kind: 'not_found' };
  if (row.revoked_at) return { kind: 'revoked' }; // idempotent
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revoked_at: new Date() },
  });
  return { kind: 'revoked' };
}
```

- [ ] **Step 4: Run the test to confirm it passes.**

```bash
pnpm --filter @rapih/api test auth-refresh-rotation
pnpm --filter @rapih/api check
```

Expected: every case PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/api/src/auth/refresh-token-store.ts apps/api/tests/auth-refresh-rotation.test.ts
git commit -m "feat(api-auth-social): refresh token rotation + reuse-detection store"
```

---

## Task 14: Auth routes — sign in / refresh / logout (TDD)

**Files:**
- Test: `apps/api/tests/auth-sign-in.test.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test helper: extend `apps/api/tests/helpers/jwks-mock.ts` (already created)

The integration test in this task targets `/auth/google`, `/auth/apple`, `/auth/refresh`, `/auth/logout`. To avoid binding to real Google / Apple JWKS, we expose internal hooks the route handlers honor when `NODE_ENV === 'test'` to point at the mock JWKS.

- [ ] **Step 1: Add a test override mechanism for JWKS URLs.**

Create `apps/api/src/auth/test-overrides.ts`:

```ts
/**
 * Test hooks. ONLY used when NODE_ENV === 'test' so production code paths
 * never depend on these. Lets integration tests redirect Google + Apple
 * verification to a mock JWKS endpoint without monkey-patching modules.
 */
let googleOverride: string | undefined;
let appleOverride: string | undefined;

export function setTestJwksOverrides(opts: { google?: string; apple?: string }): void {
  if (process.env.NODE_ENV !== 'test') return;
  googleOverride = opts.google;
  appleOverride = opts.apple;
}

export function clearTestJwksOverrides(): void {
  googleOverride = undefined;
  appleOverride = undefined;
}

export function getJwksOverride(provider: 'google' | 'apple'): string | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  return provider === 'google' ? googleOverride : appleOverride;
}
```

- [ ] **Step 2: Write the failing integration test.**

Create `apps/api/tests/auth-sign-in.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { buildApp } from '../src/app.js';
import { clearTestJwksOverrides, setTestJwksOverrides } from '../src/auth/test-overrides.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { createMockJwks, signMockIdToken, type MockJwksServer } from './helpers/jwks-mock.js';

const prisma = getTestPrisma();

describe('auth sign-in routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let googleJwks: MockJwksServer;
  let appleJwks: MockJwksServer;

  beforeAll(async () => {
    googleJwks = await createMockJwks({ kid: 'g' });
    appleJwks = await createMockJwks({ kid: 'a' });
    setTestJwksOverrides({ google: googleJwks.url, apple: appleJwks.url });
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await app.close();
    await googleJwks.close();
    await appleJwks.close();
    clearTestJwksOverrides();
  });

  // ── Google ─────────────────────────────────────────────────────────────

  it('POST /auth/google creates a brand-new user and issues tokens', async () => {
    const idToken = await signMockIdToken(
      googleJwks.keys[0]!,
      { sub: 'g-1', email: 'r@gmail.com', email_verified: true, name: 'Ridho' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.access_token).toMatch(/^ey/); // JWT
    expect(body.data.refresh_token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.user.email).toBe('r@gmail.com');
    expect(body.data.user.onboarding_completed_at).toBeNull();

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
  });

  it('POST /auth/google returns the same user on a returning sign-in', async () => {
    const make = async (sub: string, name: string) =>
      signMockIdToken(
        googleJwks.keys[0]!,
        { sub, email: 'r@gmail.com', email_verified: true, name },
        { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' },
      );
    const a = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: await make('g-1', 'Ridho') },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: await make('g-1', 'Ridho V2') },
    });
    expect(a.json().data.user.id).toBe(b.json().data.user.id);
  });

  it('POST /auth/google returns 401 when audience mismatches', async () => {
    const idToken = await signMockIdToken(
      googleJwks.keys[0]!,
      { sub: 'g-bad', email: 'r@gmail.com', email_verified: true },
      { iss: 'https://accounts.google.com', aud: 'wrong-aud' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.invalid_token');
  });

  // ── Apple ──────────────────────────────────────────────────────────────

  it('POST /auth/apple creates a user with name from body', async () => {
    const idToken = await signMockIdToken(
      appleJwks.keys[0]!,
      { sub: 'a-1', email: 'r@example.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken, name: { firstName: 'Ridho', lastName: 'Idris' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.name).toBe('Ridho Idris');
  });

  it('POST /auth/apple uses email local-part when no name body and not relay', async () => {
    const idToken = await signMockIdToken(
      appleJwks.keys[0]!,
      { sub: 'a-2', email: 'someone@example.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.name).toBe('someone');
  });

  it('POST /auth/apple uses fallback "Pengguna Rapih" for private relay without name', async () => {
    const idToken = await signMockIdToken(
      appleJwks.keys[0]!,
      { sub: 'a-3', email: 'abc@privaterelay.appleid.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' },
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    const user = res.json().data.user;
    expect(user.name).toBe('Pengguna Rapih');
    const dbUser = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    expect(dbUser.apple_private_relay).toBe(true);
    expect(dbUser.email_verified_at).not.toBeNull();
  });

  // ── Refresh ───────────────────────────────────────────────────────────

  it('POST /auth/refresh rotates the token (old becomes revoked, new issued)', async () => {
    const idToken = await signMockIdToken(
      googleJwks.keys[0]!,
      { sub: 'g-r', email: 'rf@gmail.com', email_verified: true, name: 'Rf' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' },
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const oldRefresh = signin.json().data.refresh_token;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: oldRefresh },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.refresh_token).not.toBe(oldRefresh);
    expect(body.data.access_token).toMatch(/^ey/);
  });

  it('POST /auth/refresh detects reuse and returns 401 token_reused', async () => {
    const idToken = await signMockIdToken(
      googleJwks.keys[0]!,
      { sub: 'g-reuse', email: 'reuse@gmail.com', email_verified: true, name: 'Reuse' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' },
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const oldRefresh = signin.json().data.refresh_token;
    await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh_token: oldRefresh } });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: oldRefresh },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.token_reused');
  });

  it('POST /auth/refresh returns 401 invalid_token for an unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.invalid_token');
  });

  // ── Logout ────────────────────────────────────────────────────────────

  it('POST /auth/logout returns 204 and revokes the refresh token', async () => {
    const idToken = await signMockIdToken(
      googleJwks.keys[0]!,
      { sub: 'g-out', email: 'out@gmail.com', email_verified: true, name: 'Out' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' },
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const refresh = signin.json().data.refresh_token;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: refresh },
    });
    expect(res.statusCode).toBe(204);
    // Subsequent refresh should fail (token now revoked → reuse).
    const reused = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: refresh },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('POST /auth/logout is idempotent (unknown token still 204)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(204);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test auth-sign-in
```

Expected: FAIL — `/auth/*` routes not yet registered.

- [ ] **Step 4: Create `apps/api/src/routes/auth.ts`**

```ts
import {
  AppleSignInBody,
  AuthSessionResponse,
  GoogleSignInBody,
  LogoutBody,
  RefreshBody,
  RefreshResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { loadEnv } from '../config/env.js';
import { userToDto } from '../lib/dto.js';
import { AppError } from '../lib/errors.js';
import { ok } from '../lib/envelope.js';
import { parseDeviceLabel } from '../auth/device.js';
import { isApplePrivateRelay, normalizeEmail } from '../auth/email.js';
import {
  createInitialRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../auth/refresh-token-store.js';
import { getJwksOverride } from '../auth/test-overrides.js';
import { signAccessToken } from '../auth/tokens.js';
import { upsertUserFromSocial } from '../auth/upsert-user.js';
import { verifyAppleIdToken, verifyGoogleIdToken } from '../auth/verify-id-token.js';

function deriveAppleName(payload: {
  email: string;
  bodyName?: { firstName?: string; lastName?: string };
  isRelay: boolean;
}): string {
  const composed = `${payload.bodyName?.firstName ?? ''} ${payload.bodyName?.lastName ?? ''}`.trim();
  if (composed.length > 0) return composed;
  if (!payload.isRelay) {
    const local = payload.email.split('@')[0];
    if (local && local.length > 0) return local;
  }
  return 'Pengguna Rapih';
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const env = loadEnv();

  app.post(
    '/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with Google ID token',
        body: GoogleSignInBody,
        response: { 200: AuthSessionResponse },
      },
    },
    async (req) => {
      const claims = await verifyGoogleIdToken(req.body.id_token, {
        audiences: env.GOOGLE_OAUTH_CLIENT_IDS,
        jwksUrl: getJwksOverride('google'),
      });
      const email = normalizeEmail(claims.email);

      const user = await upsertUserFromSocial(app.db, {
        provider: 'google',
        providerUserId: claims.sub,
        email,
        name: claims.name?.trim() || email.split('@')[0] || 'Pengguna Rapih',
        isApplePrivateRelay: false,
        emailVerifiedAt: new Date(),
      });

      const access = signAccessToken({
        userId: user.id,
        tier: user.tier,
        secret: env.JWT_ACCESS_SECRET,
        ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      });
      const { plain: refresh } = await createInitialRefreshToken(app.db, {
        userId: user.id,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      return ok({ access_token: access, refresh_token: refresh, user: userToDto(user) });
    },
  );

  app.post(
    '/auth/apple',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with Apple ID token',
        body: AppleSignInBody,
        response: { 200: AuthSessionResponse },
      },
    },
    async (req) => {
      const claims = await verifyAppleIdToken(req.body.id_token, {
        audiences: env.APPLE_OAUTH_CLIENT_IDS,
        jwksUrl: getJwksOverride('apple'),
      });
      const email = normalizeEmail(claims.email);
      const isRelay = isApplePrivateRelay(email);
      const name = deriveAppleName({ email, bodyName: req.body.name, isRelay });

      const user = await upsertUserFromSocial(app.db, {
        provider: 'apple',
        providerUserId: claims.sub,
        email,
        name,
        isApplePrivateRelay: isRelay,
        emailVerifiedAt: new Date(),
      });

      const access = signAccessToken({
        userId: user.id,
        tier: user.tier,
        secret: env.JWT_ACCESS_SECRET,
        ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      });
      const { plain: refresh } = await createInitialRefreshToken(app.db, {
        userId: user.id,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      return ok({ access_token: access, refresh_token: refresh, user: userToDto(user) });
    },
  );

  app.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate the refresh token and issue a new access token',
        body: RefreshBody,
        response: { 200: RefreshResponse },
      },
    },
    async (req) => {
      const result = await rotateRefreshToken(app.db, {
        plainToken: req.body.refresh_token,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      switch (result.kind) {
        case 'not_found':
          throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
        case 'expired':
          throw new AppError(
            'auth.token_expired',
            'Sesi sudah kadaluarsa, silakan masuk kembali.',
            401,
          );
        case 'reused':
          throw new AppError(
            'auth.token_reused',
            'Sesi tidak aman, silakan masuk kembali di semua perangkat.',
            401,
          );
        case 'rotated': {
          const user = await app.db.user.findUniqueOrThrow({ where: { id: result.userId } });
          const access = signAccessToken({
            userId: user.id,
            tier: user.tier,
            secret: env.JWT_ACCESS_SECRET,
            ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
          });
          return ok({ access_token: access, refresh_token: result.plain });
        }
      }
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a refresh token (idempotent)',
        body: LogoutBody,
        response: { 204: { type: 'null' } },
      },
    },
    async (req, reply) => {
      await revokeRefreshToken(app.db, req.body.refresh_token);
      reply.code(204).send();
    },
  );
};
```

- [ ] **Step 5: Register the route plugin in `apps/api/src/routes/index.ts`**

Replace its contents with:

```ts
import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
}
```

- [ ] **Step 6: Run the test.**

```bash
pnpm --filter @rapih/api test auth-sign-in
pnpm --filter @rapih/api check
```

Expected: every case PASS, check exits 0.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/routes/index.ts apps/api/src/auth/test-overrides.ts apps/api/tests/auth-sign-in.test.ts
git commit -m "feat(api-auth-social): /auth/google /auth/apple /auth/refresh /auth/logout"
```

---

## Task 15: `/auth/me` + `/me/onboarding` (TDD)

**Files:**
- Test: `apps/api/tests/me-and-onboarding.test.ts`
- Modify: `apps/api/src/routes/auth.ts` (add `/auth/me`)
- Create: `apps/api/src/routes/me.ts`
- Modify: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/me-and-onboarding.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = {}) {
  const user = await prisma.user.create({
    data: {
      email: 'r@e.com',
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
    include: { profile: true },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('GET /auth/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the full user payload with onboarding state', async () => {
    const { user, token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.id).toBe(user.id);
    expect(body.data.user.onboarding_completed_at).toBeNull();
    expect(body.data.user.profile).toEqual({
      nickname: null,
      income_range: null,
      primary_goal: null,
    });
  });
});

describe('PATCH /me/onboarding', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      payload: { nickname: 'R', income_range: 'r7to15', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('writes profile + stamps onboarding_completed_at', async () => {
    const { user, token } = await userWithToken();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho', income_range: 'r7to15', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.profile).toEqual({
      nickname: 'Ridho',
      income_range: 'r7to15',
      primary_goal: 'save',
    });
    expect(body.data.user.onboarding_completed_at).not.toBeNull();

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true },
    });
    expect(dbUser.onboarding_completed_at).not.toBeNull();
    expect(dbUser.profile?.nickname).toBe('Ridho');
  });

  it('rejects bogus enum values with validation.failed', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'R', income_range: 'bogus', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('does not bump onboarding_completed_at on a re-PATCH but does update profile', async () => {
    const { user, token } = await userWithToken();
    const first = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho', income_range: 'r7to15', primary_goal: 'save' },
    });
    const initialStamp = first.json().data.user.onboarding_completed_at;

    await new Promise((r) => setTimeout(r, 30));

    const second = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho2', income_range: 'gt30', primary_goal: 'invest' },
    });
    expect(second.json().data.user.onboarding_completed_at).toBe(initialStamp);
    expect(second.json().data.user.profile.nickname).toBe('Ridho2');

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true },
    });
    expect(dbUser.profile?.nickname).toBe('Ridho2');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test me-and-onboarding
```

Expected: FAIL — routes not yet defined.

- [ ] **Step 3: Add `/auth/me` to `apps/api/src/routes/auth.ts`.**

Append the following inside the `authRoutes` plugin (after the `/auth/logout` route registration):

```ts
  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get the current user',
        response: {
          200: (await import('@rapih/shared')).MeResponse,
        },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const user = await app.db.user.findUniqueOrThrow({
        where: { id: req.user.id },
        include: { profile: true },
      });
      return ok({ user: userToDto(user) });
    },
  );
```

(That dynamic `import` keeps the schema declaration tidy without restructuring imports; if biome flags it, hoist `MeResponse` to the top-level imports alongside the other schemas.)

Cleaner alternative: hoist the import. Replace the existing `import { ... } from '@rapih/shared'` line at the top of `routes/auth.ts` with one that also includes `MeResponse`:

```ts
import {
  AppleSignInBody,
  AuthSessionResponse,
  GoogleSignInBody,
  LogoutBody,
  MeResponse,
  RefreshBody,
  RefreshResponse,
} from '@rapih/shared';
```

…and then write the route as:

```ts
  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get the current user',
        response: { 200: MeResponse },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const user = await app.db.user.findUniqueOrThrow({
        where: { id: req.user.id },
        include: { profile: true },
      });
      return ok({ user: userToDto(user) });
    },
  );
```

- [ ] **Step 4: Create `apps/api/src/routes/me.ts`**

```ts
import { MeResponse, OnboardingBody } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ok } from '../lib/envelope.js';
import { userToDto } from '../lib/dto.js';

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/me/onboarding',
    {
      schema: {
        tags: ['me'],
        summary: 'Set onboarding fields and mark onboarding complete',
        body: OnboardingBody,
        response: { 200: MeResponse },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const userId = req.user.id;
      const updated = await app.db.$transaction(async (tx) => {
        await tx.userProfile.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            nickname: req.body.nickname,
            income_range: req.body.income_range,
            primary_goal: req.body.primary_goal,
          },
          update: {
            nickname: req.body.nickname,
            income_range: req.body.income_range,
            primary_goal: req.body.primary_goal,
          },
        });
        // Stamp only on first completion. Subsequent PATCHes don't bump it.
        const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (!current.onboarding_completed_at) {
          await tx.user.update({
            where: { id: userId },
            data: { onboarding_completed_at: new Date() },
          });
        }
        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: { profile: true },
        });
      });
      return ok({ user: userToDto(updated) });
    },
  );
};
```

- [ ] **Step 5: Register the new route group in `apps/api/src/routes/index.ts`.**

Replace its contents with:

```ts
import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
}
```

- [ ] **Step 6: Run the tests + check.**

```bash
pnpm --filter @rapih/api test me-and-onboarding
pnpm --filter @rapih/api test
pnpm --filter @rapih/api check
```

Expected: every case PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/routes/me.ts apps/api/src/routes/index.ts apps/api/tests/me-and-onboarding.test.ts
git commit -m "feat(api-auth-social): GET /auth/me + PATCH /me/onboarding"
```

---

## Task 16: Per-route rate limiting

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/auth.ts`
- Test: `apps/api/tests/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/api/tests/rate-limit.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { buildApp } from '../src/app.js';
import { resetTestDb } from './helpers/test-db.js';

describe('rate limiting', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  it('throttles /auth/google after 10 requests in a minute', async () => {
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { id_token: 'will-fail-verify' },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });

  it('does not throttle /health below 100/min', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
pnpm --filter @rapih/api test rate-limit
```

Expected: FAIL — auth route returns 401 (`auth.invalid_token`) all 11 times because rate-limit isn't installed yet.

- [ ] **Step 3: Register the rate-limit plugin in `apps/api/src/app.ts`.**

Add to imports:

```ts
import rateLimit from '@fastify/rate-limit';
```

And after the existing `await app.register(cors, ...)` but before `dbPlugin`, add:

```ts
  await app.register(rateLimit, {
    global: false, // we attach per route
    max: 100,
    timeWindow: '1 minute',
  });
```

- [ ] **Step 4: Apply per-route configs in `apps/api/src/routes/auth.ts`.**

Add a `config: { rateLimit: { max, timeWindow: '1 minute' } }` field to each route. Replace the `app.post('/auth/google', ...)` opts object with:

```ts
    {
      schema: { ... },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
```

(Mirror `tags`, `summary`, `body`, `response` — the `config` is ADDED alongside `schema`.)

Repeat for:
- `/auth/apple` → `max: 10`
- `/auth/refresh` → `max: 30`
- `/auth/logout` → no override (uses global default 100/min)
- `/auth/me` → no override

To keep the diff readable, the final `app.post('/auth/google', ...)` registration becomes:

```ts
  app.post(
    '/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with Google ID token',
        body: GoogleSignInBody,
        response: { 200: AuthSessionResponse },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      // (handler body unchanged)
      ...
    },
  );
```

Apply the analogous `config` block to `/auth/apple` and `/auth/refresh` (with their own `max`).

- [ ] **Step 5: Run the test + the full suite.**

```bash
pnpm --filter @rapih/api test rate-limit
pnpm --filter @rapih/api test
pnpm --filter @rapih/api check
```

Expected: rate-limit test PASS; all other tests still pass. The previous `auth-sign-in` tests issue at most 5–6 calls per IP per file run — well under the 10/min limit — so they should stay green.

- [ ] **Step 6: Commit.**

```bash
git add apps/api/src/app.ts apps/api/src/routes/auth.ts apps/api/tests/rate-limit.test.ts
git commit -m "feat(api-auth-social): per-route in-memory rate limit"
```

---

## Task 17: Server entrypoint + Dockerfile updates

**Files:**
- Create: `apps/api/scripts/entrypoint.sh`
- Modify: `apps/api/Dockerfile`
- Modify: `apps/api/package.json` (scripts)
- Modify: `apps/api/.dockerignore` (allow scripts/)

- [ ] **Step 1: Create `apps/api/scripts/entrypoint.sh`**

```sh
#!/bin/sh
set -e

echo "[entrypoint] applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy --schema=/app/packages/db/prisma/schema.prisma

echo "[entrypoint] starting api server…"
exec node dist/server.js
```

Mark executable later via Docker COPY chmod.

- [ ] **Step 2: Update `apps/api/Dockerfile` to install Prisma client deps + run migrate at boot.**

Replace the existing Dockerfile with:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
RUN apk add --no-cache wget openssl

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.9.14
COPY . .
RUN turbo prune --scope=@rapih/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @rapih/db exec prisma generate
RUN pnpm --filter @rapih/shared build
RUN pnpm --filter @rapih/api build

FROM base AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001 -G nodejs
COPY --from=installer --chown=fastify:nodejs /app ./
RUN chmod +x /app/apps/api/scripts/entrypoint.sh
USER fastify
WORKDIR /app/apps/api
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health > /dev/null || exit 1
ENTRYPOINT ["/app/apps/api/scripts/entrypoint.sh"]
```

- [ ] **Step 3: Update `apps/api/.dockerignore`.**

Replace its contents with:

```
node_modules
dist
.env
.env.*
!.env.example
*.log
.turbo
.vscode
.DS_Store
tests
# scripts/ MUST NOT be ignored — entrypoint.sh ships in the image
```

- [ ] **Step 4: Add a `migrate:deploy` convenience script to the API package.**

Edit `apps/api/package.json` and add the script under `"scripts"`:

```json
    "migrate:deploy": "pnpm --filter @rapih/db exec prisma migrate deploy",
```

- [ ] **Step 5: Build the Docker image to verify.**

```bash
docker build -f apps/api/Dockerfile -t rapih-api .
```

Expected: build succeeds. If docker is unavailable, write a blocker and skip.

- [ ] **Step 6: Smoke-run the image against the local Postgres.**

```bash
docker run --rm \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e APP_PUBLIC_URL=http://localhost:8081 \
  -e API_PUBLIC_URL=http://localhost:3001 \
  -e DATABASE_URL=postgresql://rapih:rapih@localhost:5433/rapih \
  -e JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
  -e GOOGLE_OAUTH_CLIENT_IDS=test.apps.googleusercontent.com \
  -e APPLE_OAUTH_CLIENT_IDS=app.rapih.ios \
  rapih-api &
sleep 6
curl -sf http://localhost:3001/health
docker ps --filter ancestor=rapih-api -q | xargs -r docker stop
```

Expected: `curl` returns the health envelope. If docker host networking is unavailable on macOS Docker Desktop (it isn't by default), use `-p 3001:3001` and `host.docker.internal` for the database URL:

```bash
-e DATABASE_URL=postgresql://rapih:rapih@host.docker.internal:5433/rapih -p 3001:3001
```

If the smoke fails because docker can't reach Postgres, write a blocker — the build itself succeeding is the primary acceptance criterion for this task.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/scripts/entrypoint.sh apps/api/Dockerfile apps/api/.dockerignore apps/api/package.json
git commit -m "feat(api-auth-social): Docker image runs migrate deploy on boot"
```

---

## Task 18: Update `apps/api/AGENTS.md`

**Files:**
- Modify: `apps/api/AGENTS.md`

- [ ] **Step 1: Append an "Auth conventions" section.**

Add this section to `apps/api/AGENTS.md`, AFTER the existing `## Conventions` section and BEFORE `## Adding deps`:

```markdown
## Auth conventions

This API uses **social-only sign-in** (Google + Apple). Email/password is intentionally not implemented. See `docs/superpowers/specs/2026-05-21-api-auth-social.md`.

- **Tokens:** access JWT (HS256, 15 min, secret `JWT_ACCESS_SECRET`) + opaque refresh token (32-byte hex, sha256 hashed at rest, 30-day TTL, rotated on every `/auth/refresh`). Reuse of a revoked refresh token revokes every refresh token for that user.
- **Verifying provider ID tokens:** done via `jose` `createRemoteJWKSet` against Google + Apple JWKS, cached in process for 10 min. Tests inject mock JWKS via `setTestJwksOverrides()` from `src/auth/test-overrides.ts` — never call this from production code.
- **Protect a route:** add `onRequest: [app.authenticate]` to the route options. The user is hydrated to `req.user` (full Prisma `User` row).
- **Require completed onboarding:** add `onRequest: [app.authenticate, app.requireOnboarding]`. Order matters — authenticate first.
- **Return user payloads** through `userToDto(user)` from `src/lib/dto.ts`. Never expose raw Prisma rows.
- **Add a new social provider** (future): copy the pattern in `src/auth/verify-id-token.ts` (pin issuer, audiences, JWKS URL, optional email-verified check), add a route in `src/routes/auth.ts`, add an enum value to `packages/db/prisma/schema.prisma` + `packages/shared/src/auth/enums.ts`, ship a migration, write tests with `createMockJwks`.

## Database conventions for this app

- Prisma client is decorated as `app.db` via `src/plugins/db.ts`. Never instantiate `new PrismaClient()` in route code — always use `app.db`.
- Schema lives in `packages/db/prisma/schema.prisma`. Migrations: `pnpm --filter @rapih/db exec prisma migrate dev --name <slug>` locally, `prisma migrate deploy` at runtime via the Dockerfile entrypoint.
- Test DB harness: `tests/helpers/test-db.ts` + `tests/helpers/test-env.ts` + `vitest.config.ts` `globalSetup`. Tests serialize against the same DB; `resetTestDb()` truncates user-data tables in `beforeEach`.
```

- [ ] **Step 2: Commit.**

```bash
git add apps/api/AGENTS.md
git commit -m "docs(api): document auth + db conventions"
```

---

## Task 19: Update Spine + Feature Atlas

**Files:**
- Modify: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md`

- [ ] **Step 1: Mark the Feature Atlas (§ 14) rows for what changed.**

In the Feature Atlas table, change the **Status** column:

- `email signup + login` → `deferred` (note: "v1 social-only")
- `jwt access + refresh` → `done`
- `email verification` → `deferred`
- `forgot / reset password` → `deferred`
- `google sign-in` → `done`
- `apple sign-in` → `done`

(Leave `device token register` as `todo` — that's chunk 4.)

You can use any visible marker for the change, e.g.:

```
| google sign-in | api-foundation | Free | — | done |
| apple sign-in | api-foundation | Free | — | done |
| email signup + login | api-foundation | Free | — | deferred (v1 social-only) |
| email verification | api-foundation | Free | resend | deferred (v1 social-only) |
| forgot / reset password | api-foundation | Free | resend | deferred (v1 social-only) |
| jwt access + refresh | api-foundation | Free | — | done |
```

- [ ] **Step 2: Add a one-line update to Spine § 5.3 noting the v1 endpoint subset.**

Below the existing endpoint table in § 5.3, add:

```
**v1 (current):** social endpoints (`/auth/google`, `/auth/apple`), token lifecycle (`/auth/refresh`, `/auth/logout`), `/auth/me`, and `PATCH /me/onboarding`. Email/password endpoints are deferred — see `docs/superpowers/specs/2026-05-21-api-auth-social.md`.
```

- [ ] **Step 3: Add `PATCH /me/onboarding` to the locked endpoint list in § 5.3.**

Append to the code block under § 5.3:

```
PATCH /me/onboarding                 nickname,income_range,primary_goal → user
```

- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/specs/2026-05-20-rapih-backend-spine.md
git commit -m "docs(spine): mark social auth done, email auth deferred, add /me/onboarding"
```

---

## Task 20: Final verification

**Files:** none modified.

- [ ] **Step 1: Run the full test suite.**

```bash
pnpm --filter @rapih/shared test
pnpm --filter @rapih/api test
```

Expected: all green. If any test fails, STOP and write a blocker.

- [ ] **Step 2: Run check.**

```bash
pnpm --filter @rapih/shared check
pnpm --filter @rapih/db check
pnpm --filter @rapih/api check
```

Expected: all exit 0.

- [ ] **Step 3: Manual smoke against `/docs/json`.**

```bash
docker compose -f infra/docker-compose.dev.yml up -d
cp apps/api/.env.example apps/api/.env
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate deploy
pnpm --filter @rapih/api dev &
sleep 4
curl -s http://localhost:3001/docs/json | jq '.paths | keys'
```

Expected: the JSON includes `/auth/google`, `/auth/apple`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/me/onboarding`, `/health`. Stop the dev server with `kill %1` (or Ctrl-C if foregrounded).

If running in a sandbox without docker, skip this step and write a blocker.

- [ ] **Step 4: Verify acceptance criteria from spec § 12.**

Walk through every checkbox in the spec's acceptance criteria. If anything is unchecked and not blocked by the environment, fix it and commit. If blocked, ensure `docs/superpowers/notes/api-auth-social-blockers.md` lists the gap with command + reason.

- [ ] **Step 5: Final commit (if anything was tweaked above).**

If steps 1–4 produced any changes:

```bash
git add -A
git commit -m "chore(api-auth-social): final cleanup after smoke verification"
```

Otherwise this task is a no-op.

---

## Self-review checklist (do BEFORE handoff)

- [ ] Spec coverage: every endpoint in spec § 4 has a route + integration test (Tasks 14, 15)
- [ ] Spec § 3 schema is faithfully implemented in Task 5 + Task 6
- [ ] Spec § 8 env vars are all in `.env.example` and validated (Task 7)
- [ ] Spec § 9 error codes all defined in `packages/shared/src/errors.ts` (Task 3) and used in route handlers (Tasks 14, 15)
- [ ] Spec § 11 test plan: every line covered. Cross-check:
  - `verifyGoogleIdToken` happy + audience + issuer + email_verified → Task 10
  - `verifyAppleIdToken` happy + private relay + name + expired → Task 10 + Task 14
  - `parseDeviceLabel`, `normalizeEmail` → Task 9
  - `userToDto` → exercised end-to-end via Task 12, 14, 15
  - Refresh rotation, expired, reuse → Task 13 + Task 14
  - Logout idempotent → Task 14
  - `/auth/me` happy + no bearer + invalid bearer → Task 12 + Task 15
  - `/me/onboarding` happy + validation + idempotent → Task 15
  - `requireOnboarding` blocks/passes → Task 12
  - Rate limit hammer → Task 16
- [ ] No `TBD` / `TODO` / `FIXME` strings in this plan (search before committing)
- [ ] Type names consistent across tasks: `UpsertedUser`, `RotateResult`, `AccessClaims` defined once, referenced consistently

If any check fails, fix inline and re-commit.
