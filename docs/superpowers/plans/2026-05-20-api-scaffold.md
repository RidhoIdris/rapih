# api-scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> If you are a cloud executor (Kiro, etc.) running this without the skills runtime, follow the plan linearly: execute every step, run the verification command before claiming the step done, and commit per the commit step at the end of each task.
>
> **STOP rules (do not improvise around these):**
> - A test fails or asserts the wrong thing.
> - `pnpm check` (tsc / biome) reports a real error in code you wrote.
> - The repo is in an unexpected state (file already exists when it shouldn't, branch is not `main`, working tree is dirty before you started).
> - A code-logic outcome diverges from what the plan claims will happen.
>
> **Environment-gap rules (use the fallback, then continue):**
> - Tool version is higher than the plan names but in the same major-or-later range → use what's available.
> - Tool is missing but a documented fallback exists in the same step → use the fallback.
> - An action requires Docker / a daemon / a network resource that is unavailable → write the file artifact, commit it, add a one-line note in `docs/superpowers/notes/api-scaffold-blockers.md` ("Task N step M: docker not available in sandbox; deferred to human verification"), continue to the next step.
>
> If you hit a true STOP case, write a detailed note in `docs/superpowers/notes/api-scaffold-blockers.md` (command, output, what you tried) and pause.
>
> The spec at `docs/superpowers/specs/2026-05-20-api-scaffold.md` and the Spine at `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` are authoritative for design decisions — do not redecide stack, schema, or conventions.

**Goal:** Stand up `apps/api/` as a deployable Fastify skeleton exposing `/health`, Swagger UI at `/docs` (dev-only), and an OpenAPI JSON spec at `/docs/json`. No database, no auth — just the empty house, conventions, and Dockerfile.

**Architecture:** Fastify 5 + TypeScript strict + zod-typed routes via `fastify-type-provider-zod`. All responses follow the success/error envelope from Spine §7. Env validated by zod at boot — bad env crashes the process before opening the port. Swagger UI mounted at `/docs` only when `NODE_ENV !== 'production'`; OpenAPI JSON at `/docs/json` always.

**Tech Stack:** Fastify 5, `@fastify/cors` 10, `@fastify/sensible` 6, `@fastify/swagger` 9, `@fastify/swagger-ui` 5, `fastify-type-provider-zod` 4, zod 3, dotenv 16, pino (bundled), TypeScript 5.7, tsx 4, Vitest 2, Biome 2. Multi-stage Dockerfile on `node:22-alpine` via Turborepo prune. pnpm 11.1.3 (set via `packageManager` at repo root).

**Reference docs (read before starting):**
- `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — Spine (§§ 2, 3, 7, 9, 13 most relevant here)
- `docs/superpowers/specs/2026-05-20-api-scaffold.md` — this chunk's spec
- `apps/mobile/AGENTS.md` — style reference for the AGENTS.md you will write in Task 8

---

## Task 0: Prep & Sanity Checks

**Files:** none modified — this is read-only context loading.

- [ ] **Step 1: Read the Spine sections referenced above (§§ 2, 3, 7, 9, 13)**

You need these in working memory: stack picks, monorepo layout, response envelope shape, env naming conventions, and the Dockerfile pattern.

- [ ] **Step 2: Read this plan's matching spec**

Path: `docs/superpowers/specs/2026-05-20-api-scaffold.md`. Sections 6, 8, and 12 are the contract you are executing against.

- [ ] **Step 3: Verify Node**

Run:

```bash
node --version
```

Expected: Node **22 or newer** (22.x, 24.x, etc. all fine for development — Fastify 5 / TS 5.7 / Vitest 2 / tsx 4 all support Node 22+). The production Docker image is pinned to `node:22-alpine` separately in Task 7 so the deploy artifact stays reproducible.

If Node is older than 22, STOP — do not try to install Node yourself.

- [ ] **Step 4: Verify repo state**

Run from repo root:

```bash
pwd
git status
ls apps/api
```

Expected: working directory is the repo root, `git status` shows clean tree on `main`, and `apps/api` is empty. If `apps/api` already has files, STOP and write a blocker.

- [ ] **Step 5: Make `pnpm` available**

First try corepack (the preferred path because the repo's `package.json` pins `packageManager: "pnpm@11.1.3"`):

```bash
corepack enable && corepack prepare pnpm@11.1.3 --activate && pnpm --version
```

If that prints `11.1.3`, you are done with this step.

**Fallback (if corepack is not installed in this sandbox):**

```bash
npm install -g pnpm@11.1.3
pnpm --version
```

Either path is acceptable for this plan. `pnpm --version` must print `11.x` (exact 11.1.3 preferred — same as the repo's `packageManager` field).

If neither command yields a working `pnpm`, STOP and write a blocker.

No commit for this task — context loading only.

---

## Task 1: Initialize `@rapih/api` package

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/biome.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/.env.example`
- Create: `apps/api/.dockerignore`
- Create: `apps/api/src/.gitkeep`
- Create: `apps/api/tests/.gitkeep`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@rapih/api",
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
    "@fastify/cors": "^10.0.1",
    "@fastify/sensible": "^6.0.1",
    "@fastify/swagger": "^9.4.0",
    "@fastify/swagger-ui": "^5.2.0",
    "dotenv": "^16.4.5",
    "fastify": "^5.1.0",
    "fastify-type-provider-zod": "^4.0.2",
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

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

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

- [ ] **Step 3: Create `apps/api/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
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

- [ ] **Step 4: Create `apps/api/vitest.config.ts`**

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

- [ ] **Step 5: Create `apps/api/.env.example`**

```
NODE_ENV=development
PORT=3001
APP_PUBLIC_URL=http://localhost:8081
API_PUBLIC_URL=http://localhost:3001
```

- [ ] **Step 6: Create `apps/api/.dockerignore`**

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
```

- [ ] **Step 7: Create empty `src/` and `tests/` directories with `.gitkeep`**

```bash
mkdir -p apps/api/src apps/api/tests
touch apps/api/src/.gitkeep apps/api/tests/.gitkeep
```

- [ ] **Step 8: Install dependencies and verify**

Run from repo root:

```bash
pnpm install
pnpm --filter @rapih/api exec node -e "console.log('ok')"
```

Expected: `pnpm install` succeeds with no errors. The second command prints `ok` — confirms the workspace package is reachable.

- [ ] **Step 9: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/biome.json apps/api/vitest.config.ts apps/api/.env.example apps/api/.dockerignore apps/api/src/.gitkeep apps/api/tests/.gitkeep pnpm-lock.yaml
git commit -m "feat(api-scaffold): initialize @rapih/api package"
```

---

## Task 2: Env loader (TDD)

**Files:**
- Test: `apps/api/tests/env.test.ts`
- Create: `apps/api/src/config/env.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/env.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub dotenv so this test controls process.env exclusively.
// Without this, a local apps/api/.env would silently re-populate vars we delete.
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('loadEnv', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    for (const key of ['NODE_ENV', 'PORT', 'APP_PUBLIC_URL', 'API_PUBLIC_URL']) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns a typed config when all required vars are present', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';

    const { loadEnv } = await import('../src/config/env.js');
    const env = loadEnv();

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.APP_PUBLIC_URL).toBe('http://localhost:8081');
    expect(env.API_PUBLIC_URL).toBe('http://localhost:3001');
  });

  it('throws a descriptive error when NODE_ENV is missing', async () => {
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/NODE_ENV/);
  });

  it('throws when APP_PUBLIC_URL is not a URL', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'not-a-url';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/APP_PUBLIC_URL/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @rapih/api test
```

Expected: FAIL with `Cannot find module '../src/config/env.js'` or similar — the file doesn't exist yet.

- [ ] **Step 3: Implement `apps/api/src/config/env.ts`**

```ts
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
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

Note: no caching of the parsed result. `loadEnv()` re-reads `process.env` every call, so tests that mutate `process.env` between cases work without resetting any module state. Production code should still call `loadEnv()` once at boot and pass the result around — multiple calls are cheap (microseconds) but unnecessary.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @rapih/api test
```

Expected: all three test cases PASS.

- [ ] **Step 5: TypeScript check**

```bash
pnpm --filter @rapih/api check
```

Expected: exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/tests/env.test.ts
git commit -m "feat(api-scaffold): add zod-validated env loader"
```

---

## Task 3: Envelope helpers (TDD)

**Files:**
- Test: `apps/api/tests/envelope.test.ts`
- Create: `apps/api/src/lib/envelope.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/envelope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { err, ok } from '../src/lib/envelope.js';

describe('envelope helpers', () => {
  it('ok() wraps data with ok: true', () => {
    expect(ok({ service: 'api' })).toEqual({ ok: true, data: { service: 'api' } });
  });

  it('ok() preserves primitive data', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(ok(null)).toEqual({ ok: true, data: null });
  });

  it('err() shapes code + message without details', () => {
    expect(err('auth.invalid_credentials', 'Email atau password salah.')).toEqual({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: 'Email atau password salah.' },
    });
  });

  it('err() includes details when provided', () => {
    expect(err('validation.failed', 'Validation gagal.', { fields: { email: 'required' } })).toEqual({
      ok: false,
      error: {
        code: 'validation.failed',
        message: 'Validation gagal.',
        details: { fields: { email: 'required' } },
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @rapih/api test envelope
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement `apps/api/src/lib/envelope.ts`**

```ts
export type Ok<T> = { ok: true; data: T };
export type Err = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type Envelope<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, details?: unknown): Err {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @rapih/api test envelope
```

Expected: all four cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/envelope.ts apps/api/tests/envelope.test.ts
git commit -m "feat(api-scaffold): add ok/err envelope helpers"
```

---

## Task 4: `AppError` and Fastify error handler (TDD)

**Files:**
- Test: `apps/api/tests/errors.test.ts`
- Create: `apps/api/src/lib/errors.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/errors.test.ts`:

```ts
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { AppError, registerErrorHandler } from '../src/lib/errors.js';

describe('AppError + error handler', () => {
  async function buildApp(opts: { nodeEnv?: 'development' | 'production' } = {}) {
    const app = Fastify({ logger: false });
    registerErrorHandler(app, { nodeEnv: opts.nodeEnv ?? 'development' });
    return app;
  }

  it('shapes AppError into the err envelope with the given status', async () => {
    const app = await buildApp();
    app.get('/boom', () => {
      throw new AppError('auth.invalid_credentials', 'Email atau password salah.', 401);
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: 'Email atau password salah.' },
    });
  });

  it('shapes Fastify schema validation errors as validation.failed', async () => {
    const app = await buildApp();
    app.post(
      '/echo',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string', minLength: 1 } },
          },
        },
      },
      () => ({ ok: true }),
    );

    const res = await app.inject({ method: 'POST', url: '/echo', payload: {} });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('validation.failed');
  });

  it('returns internal.unknown 500 for unexpected errors and hides message in production', async () => {
    const app = await buildApp({ nodeEnv: 'production' });
    app.get('/oops', () => {
      throw new Error('secret stack info');
    });

    const res = await app.inject({ method: 'GET', url: '/oops' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('internal.unknown');
    expect(body.error.message).not.toContain('secret stack info');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @rapih/api test errors
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement `apps/api/src/lib/errors.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { err } from './envelope.js';

export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, httpStatus = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

type Options = { nodeEnv: 'development' | 'test' | 'production' };

export function registerErrorHandler(app: FastifyInstance, opts: Options): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.httpStatus).send(err(error.code, error.message, error.details));
      return;
    }

    // Fastify schema validation (JSON Schema or zod via type provider).
    if ((error as { validation?: unknown }).validation) {
      const validation = (error as { validation: unknown[] }).validation;
      reply.status(400).send(err('validation.failed', 'Validation gagal.', { fields: validation }));
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    const message =
      opts.nodeEnv === 'production' ? 'Terjadi kesalahan pada server.' : (error.message ?? 'Unknown error');
    reply.status(500).send(err('internal.unknown', message));
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @rapih/api test errors
```

Expected: all three cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/tests/errors.test.ts
git commit -m "feat(api-scaffold): add AppError class and Fastify error handler"
```

---

## Task 5: Bootstrap server + `/health` route (TDD)

**Files:**
- Test: `apps/api/tests/health.test.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/index.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/app.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/health.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the success envelope with service + version', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      data: { service: 'api', version: '0.1.0' },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @rapih/api test health
```

Expected: FAIL — `buildApp` does not exist.

- [ ] **Step 3: Create `apps/api/src/routes/health.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import pkg from '../../package.json' with { type: 'json' };
import { ok } from '../lib/envelope.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ok({ service: 'api' as const, version: pkg.version }));
}
```

- [ ] **Step 4: Create `apps/api/src/routes/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
}
```

- [ ] **Step 5: Create `apps/api/src/app.ts`**

```ts
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './lib/errors.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const isDev = env.NODE_ENV === 'development';

  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : env.NODE_ENV === 'test'
        ? false
        : true,
    disableRequestLogging: env.NODE_ENV === 'test',
  });

  await app.register(sensible);
  await app.register(cors, { origin: [env.APP_PUBLIC_URL], credentials: true });

  registerErrorHandler(app, { nodeEnv: env.NODE_ENV });
  await registerRoutes(app);

  return app;
}
```

- [ ] **Step 6: Create `apps/api/src/server.ts`**

```ts
import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (error) {
    app.log.error({ err: error }, 'failed to start server');
    process.exit(1);
  }
}

void main();
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pnpm --filter @rapih/api test health
```

Expected: PASS — `/health` returns the envelope.

- [ ] **Step 8: Manual smoke — boot dev server**

In one terminal:

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @rapih/api dev
```

Wait until logs show `Server listening at http://0.0.0.0:3001`.

In another terminal:

```bash
curl -s http://localhost:3001/health
```

Expected output:

```json
{"ok":true,"data":{"service":"api","version":"0.1.0"}}
```

Then stop the dev server (Ctrl-C). Do NOT commit `apps/api/.env` — it is gitignored.

- [ ] **Step 9: Type check + lint**

```bash
pnpm --filter @rapih/api check
```

Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/routes/health.ts apps/api/src/routes/index.ts apps/api/src/app.ts apps/api/src/server.ts apps/api/tests/health.test.ts
git rm -f apps/api/src/.gitkeep apps/api/tests/.gitkeep
git commit -m "feat(api-scaffold): bootstrap Fastify server with /health route"
```

---

## Task 6: Swagger plugin + OpenAPI on `/health` (TDD)

**Files:**
- Test: `apps/api/tests/openapi.test.ts`
- Create: `apps/api/src/plugins/swagger.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/health.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/openapi.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('OpenAPI + Swagger UI', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs/json returns valid OpenAPI 3.0 with /health path', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.title).toBe('Rapih API');
    expect(spec.paths?.['/health']).toBeDefined();
    expect(spec.paths['/health'].get?.tags).toContain('meta');
  });

  it('GET /docs renders Swagger UI in dev', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(res.statusCode);
  });
});

describe('OpenAPI in production', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs returns 404 in production', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /docs/json still returns the spec in production', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @rapih/api test openapi
```

Expected: FAIL — `/docs/json` route does not exist (404 instead of 200).

- [ ] **Step 3: Create `apps/api/src/plugins/swagger.ts`**

```ts
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import pkg from '../../package.json' with { type: 'json' };
import { loadEnv } from '../config/env.js';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Rapih API',
        description: 'Backend HTTP API for the Rapih personal-finance app.',
        version: pkg.version,
      },
      servers: [{ url: env.API_PUBLIC_URL }],
      tags: [
        { name: 'meta', description: 'Service health and metadata.' },
        { name: 'auth', description: 'Authentication endpoints (added in api-auth-email chunk).' },
        { name: 'me', description: 'Current-user endpoints (added in api-auth-email chunk).' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.route({
    method: 'GET',
    url: '/docs/json',
    schema: { hide: true },
    handler: async () => app.swagger(),
  });

  if (env.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  }
}
```

- [ ] **Step 4: Wire the zod type provider and the swagger plugin into `apps/api/src/app.ts`**

Replace the existing `apps/api/src/app.ts` with:

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
import { registerSwagger } from './plugins/swagger.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const isDev = env.NODE_ENV === 'development';

  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : env.NODE_ENV === 'test'
        ? false
        : true,
    disableRequestLogging: env.NODE_ENV === 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, { origin: [env.APP_PUBLIC_URL], credentials: true });
  await registerSwagger(app);

  registerErrorHandler(app, { nodeEnv: env.NODE_ENV });
  await registerRoutes(app);

  return app;
}
```

- [ ] **Step 5: Update `apps/api/src/routes/health.ts` to declare its zod schema**

Replace the existing file with:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import { ok } from '../lib/envelope.js';

const HealthResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    service: z.literal('api'),
    version: z.string(),
  }),
});

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['meta'],
        summary: 'Service health & version',
        response: { 200: HealthResponse },
      },
    },
    async () => ok({ service: 'api' as const, version: pkg.version }),
  );
};
```

Update `apps/api/src/routes/index.ts` import remains the same — verify it still says `import { healthRoutes } from './health.js';`.

- [ ] **Step 6: Run the OpenAPI tests**

```bash
pnpm --filter @rapih/api test openapi
```

Expected: all four cases PASS.

- [ ] **Step 7: Run the full test suite**

```bash
pnpm --filter @rapih/api test
```

Expected: every test from Tasks 2-6 PASSES.

- [ ] **Step 8: Manual smoke — verify Swagger UI**

```bash
pnpm --filter @rapih/api dev
```

In a browser, open `http://localhost:3001/docs` — expect Swagger UI listing `/health` under tag `meta`.

Also:

```bash
curl -s http://localhost:3001/docs/json | head -c 200
```

Expected: JSON starting with `{"openapi":"3.0.3","info":{"title":"Rapih API"...`.

Stop the dev server (Ctrl-C).

- [ ] **Step 9: Type check + lint**

```bash
pnpm --filter @rapih/api check
```

Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/plugins/swagger.ts apps/api/src/app.ts apps/api/src/routes/health.ts apps/api/tests/openapi.test.ts
git commit -m "feat(api-scaffold): add @fastify/swagger + OpenAPI on /health"
```

---

## Task 7: Dockerfile (multi-stage, Turborepo prune)

**Files:**
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
RUN apk add --no-cache wget

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
RUN pnpm --filter @rapih/api build

FROM base AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001 -G nodejs
COPY --from=installer --chown=fastify:nodejs /app ./
USER fastify
WORKDIR /app/apps/api
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health > /dev/null || exit 1
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Check whether Docker is available**

```bash
docker --version
```

If Docker is present and the daemon is reachable (`docker info` succeeds), continue with Steps 3-6 below.

If Docker is **not** available in this sandbox (common for cloud agents):
- Skip Steps 3-6.
- Add one line to `docs/superpowers/notes/api-scaffold-blockers.md`: `Task 7 steps 3-6: docker not available in sandbox; Dockerfile written but build/run deferred to human verification.`
- Jump directly to Step 7 (commit the Dockerfile only).

- [ ] **Step 3: Build the image from the repo root**

```bash
docker build -f apps/api/Dockerfile -t rapih-api:scaffold .
```

Expected: build completes successfully ending with `naming to docker.io/library/rapih-api:scaffold`.

If the build fails on `turbo prune` because turbo cannot find a lockfile or workspace file, verify those exist at the repo root before retrying. Do not modify the Dockerfile.

- [ ] **Step 4: Run the container and probe `/health`**

```bash
docker run -d --rm --name rapih-api-smoke \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e APP_PUBLIC_URL=https://app.local \
  -e API_PUBLIC_URL=https://api.local \
  rapih-api:scaffold
sleep 3
curl -s http://localhost:3001/health
```

Expected: `{"ok":true,"data":{"service":"api","version":"0.1.0"}}`.

- [ ] **Step 5: Probe `/docs/json` in the running container**

```bash
curl -s http://localhost:3001/docs/json | head -c 80
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/docs
```

Expected:
- `/docs/json` returns JSON starting with `{"openapi":"3.0.3"`.
- `/docs` returns `404` (production mode).

- [ ] **Step 6: Stop the container**

```bash
docker stop rapih-api-smoke
```

Expected: container stops cleanly (no error output).

- [ ] **Step 7: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "feat(api-scaffold): add multi-stage Dockerfile (turborepo prune)"
```

---

## Task 8: `apps/api/AGENTS.md`

**Files:**
- Create: `apps/api/AGENTS.md`

- [ ] **Step 1: Create `apps/api/AGENTS.md`**

```markdown
# Rapih API — agent guide

## What this app is

`apps/api` is the Rapih backend HTTP service: **Fastify v5 + TypeScript strict** on Node 22. It is the source of truth for user-facing endpoints consumed by the mobile app (Expo) and the admin CMS (Next.js). v1 scope: no database, no auth (those land in the next chunk, `api-auth-email`).

Anything cross-cutting (stack picks, monorepo layout, auth model, env naming, deploy story) lives in `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md`. Read the Spine before editing this app.

## Stack (locked — see Spine § 2)

- Fastify 5 + `@fastify/cors` + `@fastify/sensible`
- Zod schemas everywhere via `fastify-type-provider-zod`
- OpenAPI 3.0 auto-generated by `@fastify/swagger` → UI at `/docs` (dev only), JSON at `/docs/json`
- TypeScript strict, ES modules, target ES2022
- Vitest for tests (uses `app.inject` — no real port binding)
- Biome for lint + format
- Logging: pino (pino-pretty in dev)

Do NOT swap any of these without first updating the Spine.

## Directory map

```
apps/api/
  src/
    app.ts                 buildApp() — composes Fastify instance, plugins, routes, error handler
    server.ts              entry point (process listener, graceful shutdown)
    config/
      env.ts               loadEnv() — zod-validated env, throws at boot on misconfig
    lib/
      envelope.ts          ok()/err() helpers (Spine § 7)
      errors.ts            AppError class + registerErrorHandler()
    plugins/
      swagger.ts           registerSwagger() — OpenAPI + /docs route plumbing
    routes/
      index.ts             registerRoutes() — composes all route plugins
      health.ts            GET /health (tag: meta)
  tests/
    *.test.ts              vitest, use buildApp() + app.inject()
  Dockerfile               multi-stage, turborepo prune, runs as non-root
  package.json, tsconfig.json, biome.json, vitest.config.ts
  .env.example             non-secret defaults
```

## How to add a route

1. Create `src/routes/<name>.ts`. Export a `FastifyPluginAsyncZod`.
2. Define zod schemas for `body`, `query`, `params`, and EACH response status you return. Re-use shared schemas from `packages/shared` once that package exists (introduced in `api-auth-email`).
3. Declare the route with `schema: { tags: [...], summary, body?, querystring?, params?, response: { 200: ..., 400: ... } }`. A route without `schema` will not appear in `/docs/json`.
4. Use `ok(data)` for success and throw `new AppError(code, message, httpStatus, details?)` for errors. Never `reply.send({ ok: false, ... })` by hand — the error handler does that.
5. Register the plugin in `src/routes/index.ts`.
6. Write an integration test in `tests/<name>.test.ts` using `buildApp()` + `app.inject()`. The test must cover at least one success case and one error envelope case.
7. Run `pnpm --filter @rapih/api check && pnpm --filter @rapih/api test` before committing.

## Conventions

- Env: only read via `loadEnv()` / `env` proxy from `src/config/env.ts`. Never `process.env.X` directly.
- Logging: `app.log.info/warn/error`, never `console.log`.
- Errors: throw `AppError` with a dotted snake_case code (e.g. `auth.invalid_credentials`) and a Bahasa Indonesia user-facing message.
- Money: when this app gains money-handling endpoints, use `BigInt` cents per Spine § 4. Never `Float`.
- Tier gating: an `assertTier(req, 'plus')` helper will be added in the auth chunk — do not roll your own.

## Adding deps

- Runtime deps go in `dependencies`. Dev-only (test, lint, tsx, types) go in `devDependencies`.
- Pin majors with `^`. Match Spine § 2 if the dep is named there.
- After adding, run `pnpm install` from the repo root (workspace-aware).

## Pointer to Spine

For anything not covered here, read `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md`. If the answer is not there either, ask before improvising — drift erodes the foundation this monorepo is built on.
```

- [ ] **Step 2: Verify the file contains the required sections**

```bash
grep -E "^## (What this app is|Stack|Directory map|How to add a route|Conventions|Adding deps|Pointer to Spine)" apps/api/AGENTS.md | wc -l
```

Expected output: `7` (seven matching headers).

- [ ] **Step 3: Commit**

```bash
git add apps/api/AGENTS.md
git commit -m "docs(api-scaffold): add AGENTS.md for apps/api"
```

---

## Task 9: Final acceptance criteria run-through

**Files:** none modified. This is a verification gate against spec § 8.

Run every item below. If any fails, STOP and write a blocker note — do not silently fix.

- [ ] **Step 1: Fresh install**

```bash
rm -rf node_modules apps/api/node_modules
pnpm install
```

Expected: completes with no errors. (Skip the `rm -rf` if you prefer to trust the existing install — but a clean install is the more honest verification.)

- [ ] **Step 2: Dev boot**

```bash
pnpm --filter @rapih/api dev &
DEV_PID=$!
sleep 4
curl -s http://localhost:3001/health
kill $DEV_PID || true
```

Expected curl output:

```json
{"ok":true,"data":{"service":"api","version":"0.1.0"}}
```

- [ ] **Step 3: Build + start from dist**

`node apps/api/dist/server.js` runs from the repo root, so its CWD is not `apps/api/` — dotenv would look in the wrong place. Pass env vars on the command line instead:

```bash
pnpm --filter @rapih/api build
NODE_ENV=production PORT=3001 APP_PUBLIC_URL=https://app.local API_PUBLIC_URL=https://api.local \
  node apps/api/dist/server.js &
PROD_PID=$!
sleep 3
curl -s http://localhost:3001/health
kill $PROD_PID || true
```

Expected: same envelope from the built artifact.

- [ ] **Step 4: Type check + lint**

```bash
pnpm --filter @rapih/api check
```

Expected: exits 0.

- [ ] **Step 5: Full test suite**

```bash
pnpm --filter @rapih/api test
```

Expected: all tests PASS across `env.test.ts`, `envelope.test.ts`, `errors.test.ts`, `health.test.ts`, `openapi.test.ts`.

- [ ] **Step 6: Docker build + run (skip if Docker unavailable)**

If `docker --version` worked back in Task 7 Step 2, run the full smoke:

```bash
docker build -f apps/api/Dockerfile -t rapih-api:final .
docker run -d --rm --name rapih-api-final \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e APP_PUBLIC_URL=https://app.local \
  -e API_PUBLIC_URL=https://api.local \
  rapih-api:final
sleep 3
curl -s http://localhost:3001/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/docs
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/docs/json
docker stop rapih-api-final
```

Expected:
- `/health` returns the success envelope.
- `/docs` returns `404`.
- `/docs/json` returns `200`.

If Docker is unavailable, skip this step and add one line to the blockers note: `Task 9 step 6: docker not available; deferred to human verification.` Continue to the next step.

- [ ] **Step 7: Confirm no secrets / no `console.log`**

```bash
grep -rn "console.log" apps/api/src || echo "OK: no console.log in src"
ls -la apps/api/.env 2>/dev/null && echo "WARNING: .env present" || echo "OK: no committed .env"
git ls-files apps/api | grep -E "\.env$" | grep -v example
```

Expected:
- First command prints `OK: no console.log in src`.
- Second prints `OK: no committed .env` (it is OK to have `apps/api/.env` locally — just verify git is not tracking it; the `.gitignore` covers `.env.*`).
- Third command outputs nothing (no tracked `.env` files).

- [ ] **Step 8: Final commit (only if any artifact changed)**

If the acceptance run-through created any artifact (it shouldn't), commit it. Otherwise skip.

```bash
git status
```

Expected: clean working tree.

- [ ] **Step 9: Announce completion**

Write a short summary in the conversation / handoff doc:

> api-scaffold complete. Verified: dev boot, dist build, full test suite, Docker build & run, /health + /docs/json + /docs production-404 behavior. Next chunk: `api-auth-email`.

---

## Out of scope (do NOT do in this plan)

If you find yourself wanting to do any of these, STOP — they belong to a later chunk:

- Adding Prisma, Postgres, or any database client
- Adding any `/auth/*`, `/me/*`, or `/devices/*` route
- Adding `packages/shared`, `packages/db`, or `packages/config`
- Adding Resend, OpenAI, Mayar, or any external service client
- Modifying `apps/mobile`, `apps/web`, `apps/admin`, or worker scaffolds
- Pruning dev deps from the Docker runner stage (optional optimization, defer)
- Setting up CI / GitHub Actions (separate chunk later)
- Writing privacy / encryption logic (deferred per Spine § 17)
