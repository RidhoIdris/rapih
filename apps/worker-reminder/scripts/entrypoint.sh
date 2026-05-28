#!/bin/sh
set -e

echo "[entrypoint] applying database migrations…"
cd /app && pnpm --filter @rapih/db exec prisma migrate deploy

echo "[entrypoint] starting reminder worker…"
cd /app/apps/worker-reminder
exec node dist/server.js
