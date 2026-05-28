# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
RUN apk add --no-cache wget openssl

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.9.14
COPY . .
RUN turbo prune --scope=@rapih/worker-reminder --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @rapih/db exec prisma generate
RUN pnpm --filter @rapih/db build
RUN pnpm --filter @rapih/shared build
RUN pnpm --filter @rapih/worker-reminder build

FROM base AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs
COPY --from=installer --chown=worker:nodejs /app ./
RUN chmod +x /app/apps/worker-reminder/scripts/entrypoint.sh
USER worker
WORKDIR /app/apps/worker-reminder
EXPOSE 3002
ENV NODE_ENV=production
ENV PORT=3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/health > /dev/null || exit 1
ENTRYPOINT ["/app/apps/worker-reminder/scripts/entrypoint.sh"]
