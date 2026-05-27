# Rapih

Personal-finance app untuk Gen-Z Indonesia. Mobile-first (Expo + React Native), backend Fastify + Postgres, monorepo pnpm + Turborepo.

## Stack

- **API**: Fastify 5 + Prisma 6 + Postgres 17 + Zod
- **Mobile**: Expo SDK 55 + React Native 0.83 + Expo Router v5 + Zustand
- **Auth**: Google sign-in (native), JWT access + rotating refresh, Apple sign-in coming
- **Tooling**: TypeScript strict, Vitest, Biome, Turborepo

## Repo layout

```
apps/
  api/        Fastify HTTP API
  mobile/     Expo React Native app (iOS first)
  admin/      reserved — Next.js admin panel
packages/
  db/         Prisma schema + client (@rapih/db)
  shared/     zod schemas, DTOs, error codes (@rapih/shared)
infra/
  docker-compose.dev.yml   local Postgres for dev + tests
docs/
  superpowers/specs/       architecture spine + sub-project specs
  superpowers/patterns/    domain-crud cookbook
  superpowers/plans/       implementation plans (executed)
```

## Prerequisites

- **Node** 22+ (Expo SDK 55 requirement)
- **pnpm** 11.1.3 (pinned via `packageManager`). Install: `corepack enable && corepack prepare pnpm@11.1.3 --activate`
- **Docker Desktop** running (for Postgres)
- **Xcode** (for iOS builds + Simulator) — Mac only
- **Google Cloud Console OAuth client IDs** (iOS + Web) — see `apps/mobile/.env.example`

## Quickstart

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Copy env templates
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# fill in real Google OAuth client IDs in apps/mobile/.env

# 3. Run everything in dev (Postgres + migrate + API + Metro)
pnpm dev
```

`pnpm dev` does:

1. Starts the Postgres container (idempotent — skips if already running).
2. Applies pending migrations to the `rapih` database.
3. Boots the API (port 3001) and Metro bundler (port 8081) in parallel via Turborepo.

Press `Ctrl+C` to stop everything. Postgres keeps running — stop it explicitly with `pnpm db:down` if needed.

### Open the iOS app

The iOS app needs to be installed once into the Simulator (it's a native app, not Expo Go):

```bash
# in another terminal, while pnpm dev is running
pnpm dev:ios
```

This builds + installs Rapih on the booted iPhone Simulator and connects it to Metro. Subsequent JS changes hot-reload automatically — no rebuild needed unless you change native code (plugins, Podfile, Info.plist, etc).

## Common scripts

```bash
# Dev orchestration
pnpm dev                 # Postgres + migrate + API + Metro (the main one)
pnpm dev:api             # API only
pnpm dev:mobile          # Metro only
pnpm dev:ios             # build + install iOS app, attach to Metro
pnpm dev:android         # build + install Android app (requires JDK + Android SDK)

# Database
pnpm db:up               # boot Postgres
pnpm db:down             # stop Postgres
pnpm db:logs             # tail Postgres logs
pnpm db:psql             # interactive psql shell
pnpm db:migrate          # apply pending migrations to rapih (dev DB)
pnpm db:migrate:test     # apply pending migrations to rapih_test

# Quality
pnpm check               # tsc --noEmit + biome across all packages
pnpm lint                # biome lint
pnpm test                # run all test suites (vitest)
pnpm build               # build everything (Prisma generate + tsc + Metro web export)
```

## Environment variables

### `apps/api/.env`

| Var | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `development` / `test` / `production` |
| `PORT` | no | default `3001` |
| `APP_PUBLIC_URL` | yes | mobile / web origin (CORS) |
| `API_PUBLIC_URL` | yes | API's own URL (used in OpenAPI servers) |
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 chars random |
| `JWT_ACCESS_TTL_SECONDS` | no | default `900` |
| `JWT_REFRESH_TTL_SECONDS` | no | default `2592000` |
| `GOOGLE_OAUTH_CLIENT_IDS` | yes | comma-separated, includes iOS + Web client IDs |
| `APPLE_OAUTH_CLIENT_IDS` | yes | comma-separated bundle IDs (placeholder until Apple sign-in lands) |

### `apps/mobile/.env`

| Var | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | iOS Simulator: `http://localhost:3001`. Physical device: your Mac's LAN IP, e.g. `http://192.168.0.109:3001` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | from Google Cloud Console — Web Application OAuth client |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | from Google Cloud Console — iOS OAuth client (bundle ID = `com.ridhoidris.rapih`) |

After updating mobile `.env`, restart Metro to pick up the new values.

## Common dev flows

### Adding a new domain CRUD resource (categories, transactions, …)

Follow `docs/superpowers/patterns/domain-crud.md`. The wallet feature (`apps/api/src/routes/wallets.ts`, `apps/mobile/src/features/wallet/`) is the canonical reference — copy it, search-and-replace.

### Schema migrations

```bash
# 1. Edit packages/db/prisma/schema.prisma
# 2. Generate migration SQL (review before applying)
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate dev --name <slug> --create-only

# 3. Apply to dev + test DBs
pnpm db:migrate
pnpm db:migrate:test

# 4. Rebuild client
DATABASE_URL='postgresql://x:x@localhost/x' pnpm --filter @rapih/db build
```

### Running tests

```bash
pnpm test                                # everything
pnpm --filter @rapih/api test            # API only
pnpm --filter @rapih/api test wallets    # API tests matching "wallets"
pnpm --filter @rapih/shared test         # shared zod schema tests
```

API tests need the Postgres test DB (`rapih_test`). It's auto-created on first `pnpm test` run if migrations are present.

### Switching to a physical iPhone

1. Make sure Mac and iPhone are on the same Wi-Fi.
2. Find your Mac LAN IP: `ipconfig getifaddr en0` (or check System Settings → Wi-Fi).
3. Update `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3001
   ```
4. Update `apps/api/.env` to allow CORS from that origin (or just trust the dev URL pattern).
5. Restart Metro, rebuild iOS (`pnpm dev:ios` with the device selected).

### Resetting local data

```bash
pnpm db:down              # stop Postgres
docker volume rm rapih-dev_rapih_pg_data    # wipe all data
pnpm db:up
pnpm db:migrate
```

## Documentation

- **Architecture spine**: `docs/superpowers/specs/2026-05-20-rapih-backend-spine.md` — locked decisions across stack, schema, auth, deployment.
- **Domain CRUD pattern**: `docs/superpowers/patterns/domain-crud.md` — recipe for adding a new resource end-to-end.
- **API conventions**: `apps/api/AGENTS.md`.
- **Mobile conventions**: `apps/mobile/AGENTS.md`.
- **Sub-project specs**: `docs/superpowers/specs/*.md`.

## Deployment

Production runs on **Dokploy** (self-hosted). Each app has its own `Dockerfile` (multi-stage, Turborepo prune). Postgres + Redis are managed services in Dokploy. Migrations run automatically via the API's container entrypoint.

See Spine § 13 for full deployment story.

## License

Proprietary.
