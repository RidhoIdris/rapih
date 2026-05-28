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

export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ai_messages", "ai_sessions", "ai_usage_logs", "refresh_tokens", "notifications", "social_accounts", "user_profiles", "device_tokens", "transactions", "receipt_scans", "recurring_transactions", "goals", "budget_categories", "budgets", "receipts", "wallets", "categories", "users" RESTART IDENTITY CASCADE'
  );
}

export async function closeTestDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.$disconnect();
    cachedClient = undefined;
  }
}
