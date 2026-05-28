#!/bin/sh
set -e

echo "[entrypoint] applying database migrations…"
cd /app && pnpm --filter @rapih/db exec prisma migrate deploy

echo "[entrypoint] starting ai worker…"
cd /app/apps/worker-ai
exec node dist/server.js
