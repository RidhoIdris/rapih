#!/bin/sh
set -e

echo "[entrypoint] applying database migrations…"
# Use pnpm to run prisma migrate deploy via the @rapih/db package
cd /app && pnpm --filter @rapih/db exec prisma migrate deploy

echo "[entrypoint] starting api server…"
cd /app/apps/api
exec node dist/server.js
