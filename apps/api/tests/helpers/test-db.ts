import { execSync } from 'node:child_process';
import { createPrismaClient, type PrismaClient } from '@rapih/db';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://rapih:rapih@localhost:5433/rapih_test';

let cachedClient: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!cachedClient) {
    cachedClient = createPrismaClient({ databaseUrl: TEST_DATABASE_URL, log: ['error'] });
  }
  return cachedClient;
}

/**
 * Truncates user-data tables. Call from `beforeEach` in every DB test.
 */
export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "social_accounts", "user_profiles", "users" RESTART IDENTITY CASCADE'
  );
}

/**
 * Run-once setup. Creates the test database (if missing) and applies
 * migrations. Wired via vitest globalSetup.
 */
export async function setupTestDb(): Promise<void> {
  const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]+(\?.*)?$/, '/postgres$1');
  const dbName = TEST_DATABASE_URL.match(/\/([^/?]+)(\?.*)?$/)?.[1] ?? 'rapih_test';

  const { Client } = await import('pg');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  execSync('pnpm --filter @rapih/db exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

export async function teardownTestDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.$disconnect();
    cachedClient = undefined;
  }
}
