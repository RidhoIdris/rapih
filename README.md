# Rapih

Rapih is a pnpm + Turborepo monorepo.

## Apps

- `apps/mobile` - Expo React Native app.
- `apps/admin` - reserved for the future Next.js admin app.
- `apps/api` - reserved for the future Fastify API.

## Commands

```bash
corepack enable
corepack pnpm@11.1.3 install
corepack pnpm@11.1.3 mobile:dev
```

Run workspace tasks with Turborepo:

```bash
corepack pnpm@11.1.3 lint
corepack pnpm@11.1.3 check
```
