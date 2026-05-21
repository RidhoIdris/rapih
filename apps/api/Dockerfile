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
