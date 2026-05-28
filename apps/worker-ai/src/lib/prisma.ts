import { createPrismaClient, type PrismaClient } from '@rapih/db';
import { loadEnv } from '../config/env.js';

let cached: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!cached) {
    const env = loadEnv();
    cached = createPrismaClient({ databaseUrl: env.DATABASE_URL, log: ['error'] });
  }
  return cached;
}

export async function closePrisma(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
    cached = undefined;
  }
}
