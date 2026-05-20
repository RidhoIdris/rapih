# api-scaffold — deployable Fastify skeleton

**Status:** draft · **Date:** 2026-05-20 · **Sub-project:** api-foundation (chunk 1/4)
**References:** Spine §§ 2, 3, 7, 9, 13.

## 1. What & why

Scaffold `apps/api` to a state where it boots, exposes a `/health` endpoint, builds via Docker, and is deployable to Dokploy. **No database, no auth, no Prisma yet.** This is the empty house — the goal is to lock the file layout, the Dockerfile pattern, and the conventions (error envelope, env loading, route wiring, AGENTS.md) BEFORE we start adding logic that depends on them.

Validates: Turborepo prune in Docker works, Dokploy can build & expose, the response-envelope helper is correct, the file layout is the one all future endpoints will follow.

This is also the **first handoff test to Kiro** — a deliberately small chunk to verify the spec → plan → execute loop works before bigger chunks.

## 2. Data model changes

None. No Prisma yet.

## 3. API endpoints

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/health` | — | `{ ok: true, data: { service: 'api', version: <pkg.version> } }` | Used by Dokploy health checks and load balancers. No auth. Tagged `meta` in OpenAPI. |
| GET | `/docs` | — | HTML Swagger UI | **Dev only** (`NODE_ENV !== 'production'`). In production returns 404. |
| GET | `/docs/json` | — | OpenAPI 3.0 JSON spec | Always available (used for client codegen later). |

Response shape for non-doc endpoints MUST follow Spine § 7 envelope.

All routes MUST define their zod schemas (body / query / params / response). Schemas plug into both Fastify validation and OpenAPI generation via `fastify-type-provider-zod`. A route without schemas will not appear in `/docs/json`.

## 4. Worker jobs

None.

## 5. Client changes (mobile / admin)

None. Mobile / admin don't call this yet.

## 6. Files to create / modify

### Created

- `apps/api/package.json` — `name: "@rapih/api"`, `private: true`, scripts:
  - `dev`: `tsx watch src/server.ts`
  - `build`: `tsc -p tsconfig.json`
  - `start`: `node dist/server.js`
  - `lint`: `biome check src`
  - `check`: `tsc --noEmit && biome check src`
  - Runtime deps: `fastify@^5`, `@fastify/cors@^10`, `@fastify/sensible@^6`, `@fastify/swagger@^9`, `@fastify/swagger-ui@^5`, `fastify-type-provider-zod@^4`, `zod@^3`, `dotenv@^16`.
  - Dev deps: `typescript@^5.7`, `tsx@^4`, `@biomejs/biome@^2`, `@types/node@^22`, `vitest@^2`, `pino-pretty@^11`.

- `apps/api/tsconfig.json` — strict, ESNext target, ESNext module, NodeNext moduleResolution, `outDir: dist`, `rootDir: src`, `skipLibCheck: true`. Standalone (does not extend anything yet — `packages/config` introduced in a later chunk when 2+ apps share config).

- `apps/api/biome.json` — Biome config. Indent: 2 spaces, line width 100, semicolons always, single quotes for JS, trailing comma ES5. Lint rules: recommended.

- `apps/api/.env.example` — non-secret defaults:
  ```
  NODE_ENV=development
  PORT=3001
  APP_PUBLIC_URL=http://localhost:8081
  API_PUBLIC_URL=http://localhost:3001
  ```
  Real secrets (none yet) NOT included.

- `apps/api/.dockerignore` — `node_modules`, `dist`, `.env*`, `*.log`, `.turbo`.

- `apps/api/Dockerfile` — multi-stage Turborepo-prune build:
  - **Stage 1 (pruner)**: `node:22-alpine`, install turbo globally, run `turbo prune --scope=@rapih/api --docker` to extract only what api needs.
  - **Stage 2 (installer)**: `node:22-alpine`, copy pruned `pnpm-lock.yaml` + `json` artifacts, `pnpm install --frozen-lockfile`, copy pruned `full/` source, run `pnpm --filter @rapih/api build`.
  - **Stage 3 (runner)**: `node:22-alpine`, copy from installer stage only `apps/api/dist`, `apps/api/package.json`, and pruned `node_modules`. Create non-root user, `USER node`, `EXPOSE 3001`, `CMD ["node", "apps/api/dist/server.js"]`. Healthcheck instruction calling `/health`.

- `apps/api/src/server.ts` — entry. Creates Fastify instance with pino logger (pretty in dev), sets the zod type provider via `setValidatorCompiler(validatorCompiler)` + `setSerializerCompiler(serializerCompiler)` from `fastify-type-provider-zod`, registers `@fastify/sensible` + `@fastify/cors`, registers `plugins/swagger.ts`, registers routes via `routes/index.ts`, registers the error handler from `lib/errors.ts`, calls `listen({ host: '0.0.0.0', port: env.PORT })`. Exports app for testing. Handles graceful shutdown on SIGINT/SIGTERM.

- `apps/api/src/config/env.ts` — zod schema:
  ```
  NODE_ENV: 'development' | 'test' | 'production'   (required)
  PORT: number (default 3001)
  APP_PUBLIC_URL: url string (required)
  API_PUBLIC_URL: url string (required)
  ```
  Loads `.env` via dotenv (only in non-production), validates `process.env`, throws on failure with field-by-field error message, exports `env` typed object. **Must throw at module load so the process exits early on misconfig.**

- `apps/api/src/lib/envelope.ts` — exports:
  - `ok<T>(data: T): { ok: true; data: T }`
  - `err(code: string, message: string, details?: unknown): { ok: false; error: { code: string; message: string; details?: unknown } }`
  - These are pure functions. No Fastify dependency.

- `apps/api/src/lib/errors.ts` — exports a typed error class `AppError extends Error` with `code`, `message`, `httpStatus`, `details?`. Plus a Fastify error handler `registerErrorHandler(app)` that:
  - If `error instanceof AppError`: reply with `err(code, message, details)` and the `httpStatus`.
  - If `error.validation` (Fastify schema validation): reply 400 with `err('validation.failed', 'Validation gagal.', { fields: ... })`.
  - Else: log and reply 500 with `err('internal.unknown', 'Terjadi kesalahan pada server.')`. NEVER leak error.message to client in production.

- `apps/api/src/plugins/swagger.ts` — Fastify plugin that registers `@fastify/swagger` (OpenAPI 3.0 generation, with `transform` from `fastify-type-provider-zod` so zod schemas convert to JSON Schema) and `@fastify/swagger-ui`. UI mounted at `/docs` only when `env.NODE_ENV !== 'production'`. JSON spec served at `/docs/json` always. OpenAPI info: title `Rapih API`, version from `package.json`, description short, tags pre-declared: `meta`, `auth` (placeholder for next chunk), `me`. Servers entry uses `env.API_PUBLIC_URL`.

- `apps/api/src/routes/index.ts` — exports `registerRoutes(app)` that registers all route plugins. For this chunk, only health.

- `apps/api/src/routes/health.ts` — Fastify plugin using the zod type provider. Defines a response schema `z.object({ ok: z.literal(true), data: z.object({ service: z.literal('api'), version: z.string() }) })`, declares the route with `schema: { tags: ['meta'], response: { 200: ... } }`. Handler returns `ok({ service: 'api', version: pkg.version })` where version is read from package.json at module load (typed import via `import pkg from '../../package.json' with { type: 'json' }`).

- `apps/api/AGENTS.md` — agent guide for this app. Sections (mirror `apps/mobile/AGENTS.md` style):
  - **What this app is** (one paragraph).
  - **Stack (locked)** — table referencing Spine § 2 for source of truth.
  - **Directory map** — annotated tree of `src/`.
  - **How to add a route** — step-by-step recipe (create file in `src/routes/<name>.ts`, define zod schemas for body/query/params/response, declare `schema: { tags: [...], body, response }` so it appears in OpenAPI, register in `routes/index.ts`, use `ok()`/`AppError`, write integration test).
  - **Conventions** — env loaded via `config/env.ts`, all responses via envelope helper, errors via `AppError`, no `console.log` (use `app.log`), **all routes MUST declare zod schemas** (otherwise they won't appear in Swagger UI).
  - **Pointer to Spine** — "anything cross-cutting, read `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md`".

- `apps/api/tests/health.test.ts` — vitest test: import app, call `app.inject({ method: 'GET', url: '/health' })`, assert 200 + envelope shape.

- `apps/api/vitest.config.ts` — minimal config: node environment.

### Modified

- `pnpm-workspace.yaml` — no change (already includes `apps/*`).
- `turbo.json` — verify `dev`, `build`, `lint`, `check` tasks exist (they do per current turbo.json — `check` task should be added if not present). Add `check` task if missing.
- `.gitignore` — add `dist/` and `**/.env` if not already present.

## 7. Env variables introduced

Per Spine § 9:

| Name | Required? | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | Runtime mode. |
| `PORT` | no | `3001` | HTTP port. |
| `APP_PUBLIC_URL` | yes | `http://localhost:8081` (dev) | For future email links / CORS. |
| `API_PUBLIC_URL` | yes | `http://localhost:3001` (dev) | For future absolute URL generation. |

## 8. Acceptance criteria (definition of done)

Every box must check before declaring done.

- [ ] `pnpm install` succeeds at repo root with new `@rapih/api` package.
- [ ] `pnpm --filter @rapih/api dev` boots Fastify on port 3001 with pretty logs.
- [ ] `curl -s http://localhost:3001/health | jq` returns exactly:
  ```json
  { "ok": true, "data": { "service": "api", "version": "0.1.0" } }
  ```
- [ ] In dev: `http://localhost:3001/docs` renders Swagger UI showing the `/health` route under tag `meta`.
- [ ] `curl -s http://localhost:3001/docs/json` returns valid OpenAPI 3.0 JSON (has `openapi`, `info`, `paths` keys; `paths./health` present).
- [ ] In production (NODE_ENV=production): `GET /docs` returns 404. `GET /docs/json` still returns the spec.
- [ ] `pnpm --filter @rapih/api check` passes (tsc + biome).
- [ ] `pnpm --filter @rapih/api build` produces `apps/api/dist/server.js`.
- [ ] `node apps/api/dist/server.js` boots from the built output.
- [ ] `pnpm --filter @rapih/api test` passes (the health vitest case + a Swagger-spec smoke case).
- [ ] `docker build -f apps/api/Dockerfile -t rapih-api .` succeeds from the repo root.
- [ ] `docker run -p 3001:3001 -e NODE_ENV=production -e APP_PUBLIC_URL=https://app.local -e API_PUBLIC_URL=https://api.local rapih-api` starts and `/health` responds 200 with the envelope.
- [ ] `apps/api/AGENTS.md` exists and contains all sections listed in § 6.
- [ ] No secrets committed. `apps/api/.env` is gitignored. `.env.example` committed.
- [ ] If `NODE_ENV` is missing or invalid, the process exits with a clear zod error before opening the port.
- [ ] No `console.log` anywhere in `src/`; use `app.log`.

## 9. Test plan

- **Unit**: env loader rejects missing required vars with a descriptive error (vitest).
- **Integration**: `GET /health` returns envelope with `service: 'api'` and the package version (vitest + `app.inject`).
- **Integration**: `GET /docs/json` returns valid OpenAPI 3.0 JSON containing the `/health` path (vitest + `app.inject`).
- **Docker**: manual `docker build` + `docker run` smoke test as listed in § 8 acceptance criteria.

No CI yet — CI is a future feature.

## 10. Out of scope (handled in later chunks)

| Concern | Chunk |
|---|---|
| Postgres + Prisma | `api-auth-email` |
| Users / auth tables | `api-auth-email` |
| Email/password endpoints | `api-auth-email` |
| Resend wiring | `api-auth-email` |
| Google/Apple sign-in | `api-auth-social` |
| Device token registration | `api-devices` |
| `packages/shared` (zod schemas shared with mobile) | `api-auth-email` (first chunk with mobile-consumed schemas) |
| `packages/db` (Prisma client) | `api-auth-email` |
| `packages/config` (shared TS / Biome) | introduced when 2nd app needs it (`cms-basics`) |
| Worker apps scaffolds | `ai-worker-scaffold`, `reminder-worker-scaffold` |
| Mobile API client wrapper (`apps/mobile/src/lib/api.ts`) | mobile-side feature, after `api-auth-email` |
| `packages/api-client` (SDK methods) | deferred — re-evaluate when both mobile and CMS consume many endpoints |
| OpenAPI codegen | deferred — `/docs/json` is in place so it's trivial to add later via `openapi-typescript` |

## 11. Risks & mitigations

- **Risk**: Turborepo prune in Docker is fiddly with pnpm workspace. **Mitigation**: copy the exact pattern from Turborepo docs (v2.9) — prune uses `--docker` flag and produces `out/json` + `out/full`. If pnpm hoist causes issues, set `pnpm.shamefullyHoist: false` and use `node-linker=isolated` in `.npmrc`.
- **Risk**: Dokploy might not pass env vars correctly. **Mitigation**: `/health` doesn't depend on env beyond `PORT` — confirm deployable BEFORE adding env-heavy logic.
- **Risk**: Version drift if a future chunk uses different Fastify major. **Mitigation**: this chunk pins `fastify@^5` in package.json; Spine § 2 names Fastify v5 as the locked version.

## 12. Handoff notes for Kiro (or any executor)

- Follow the plan (`docs/superpowers/plans/2026-05-20-api-scaffold.md`) step-by-step.
- After each step, run the step's verification command and commit. Commit message format: `feat(api-scaffold): <short>` (e.g., `feat(api-scaffold): add Fastify entry + health route`).
- Do NOT add features not listed in § 6 (no DB, no auth, no extra endpoints) — § 10 enumerates what is out of scope.
- If a step fails verification, STOP and write a note in `docs/superpowers/notes/api-scaffold-blockers.md` describing what failed and what was tried. Do not improvise.
- If something genuinely unspecified comes up (e.g., conflict in versions), prefer the Spine; if Spine is silent, prefer the simplest/most explicit choice and note it.
- Run `pnpm --filter @rapih/api check && pnpm --filter @rapih/api test` before declaring any step done.
