import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

let cached: PrismaClient | undefined;

export interface CreatePrismaClientOpts {
  databaseUrl: string;
  log?: ('query' | 'info' | 'warn' | 'error')[];
}

export function createPrismaClient(opts: CreatePrismaClientOpts): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: opts.databaseUrl } },
    log: opts.log ?? ['error', 'warn'],
  });
}

export function getSharedPrismaClient(opts: CreatePrismaClientOpts): PrismaClient {
  if (!cached) cached = createPrismaClient(opts);
  return cached;
}
