#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Boot Postgres if not already up.
if ! docker compose -f infra/docker-compose.dev.yml ps --status running --quiet | grep -q .; then
  echo "[dev] starting Postgres…"
  docker compose -f infra/docker-compose.dev.yml up -d
  # wait for health
  echo "[dev] waiting for Postgres to be ready…"
  for i in $(seq 1 30); do
    if docker exec rapih-postgres-dev pg_isready -U rapih -d rapih >/dev/null 2>&1; then
      echo "[dev] Postgres is ready."
      break
    fi
    sleep 1
  done
else
  echo "[dev] Postgres already running."
fi

# 2. Apply migrations (idempotent — fast no-op if up to date).
echo "[dev] applying migrations…"
DATABASE_URL='postgresql://rapih:rapih@localhost:5433/rapih' \
  pnpm --filter @rapih/db exec prisma migrate deploy >/dev/null 2>&1 || \
  echo "[dev] migrate deploy failed (continuing — check apps/api logs)"

# 3. Run all dev servers in parallel via Turborepo.
exec pnpm exec turbo run dev --parallel
