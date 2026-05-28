import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { listTransactionsTool } from '../../src/tools/list-transactions.js';
import { closeTestDb, getTestPrisma, resetTestDb } from '../helpers/test-db.js';
import '../helpers/test-env.js';

const prisma = getTestPrisma();

async function seedUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: email,
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
}

async function seedWallet(user_id: string) {
  return prisma.wallet.create({
    data: { user_id, kind: 'bank', provider_name: 'BCA' },
  });
}

async function seedExpense(opts: {
  user_id: string;
  wallet_id: string;
  amount: bigint;
  at?: Date;
  kind?: 'income' | 'expense';
  deleted?: boolean;
}) {
  return prisma.transaction.create({
    data: {
      user_id: opts.user_id,
      wallet_id: opts.wallet_id,
      kind: opts.kind ?? 'expense',
      amount: opts.amount,
      transacted_at: opts.at ?? new Date(),
      ...(opts.deleted ? { deleted_at: new Date() } : {}),
    },
  });
}

describe('list_transactions tool', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it("scopes by user — excludes other users' rows", async () => {
    const a = await seedUser('list-tx-a@e.com');
    const b = await seedUser('list-tx-b@e.com');
    const wa = await seedWallet(a.id);
    const wb = await seedWallet(b.id);
    await seedExpense({ user_id: a.id, wallet_id: wa.id, amount: 100n });
    await seedExpense({ user_id: b.id, wallet_id: wb.id, amount: 999n });

    const result = await listTransactionsTool.run({}, { userId: a.id, prisma });
    const { transactions } = result as { transactions: { amount: string }[] };
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amount).toBe('100');
  });

  it('excludes soft-deleted', async () => {
    const u = await seedUser('list-tx-d@e.com');
    const w = await seedWallet(u.id);
    await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 100n });
    await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 200n, deleted: true });
    const result = await listTransactionsTool.run({}, { userId: u.id, prisma });
    expect((result as { transactions: unknown[] }).transactions).toHaveLength(1);
  });

  it("kind filter — 'expense' excludes income", async () => {
    const u = await seedUser('list-tx-k@e.com');
    const w = await seedWallet(u.id);
    await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 100n, kind: 'expense' });
    await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 999n, kind: 'income' });
    const result = await listTransactionsTool.run({ kind: 'expense' }, { userId: u.id, prisma });
    const { transactions } = result as { transactions: { kind: string }[] };
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.kind).toBe('expense');
  });

  it('limit cap — caller asks 999, returns ≤50', async () => {
    const u = await seedUser('list-tx-l@e.com');
    const w = await seedWallet(u.id);
    for (let i = 0; i < 60; i++) {
      await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 1n });
    }
    const result = await listTransactionsTool.run(
      { limit: 999 as unknown as number },
      { userId: u.id, prisma }
    );
    const { transactions } = result as { transactions: unknown[] };
    expect(transactions.length).toBeLessThanOrEqual(50);
  });

  it('amount is serialized as string', async () => {
    const u = await seedUser('list-tx-s@e.com');
    const w = await seedWallet(u.id);
    await seedExpense({ user_id: u.id, wallet_id: w.id, amount: 12345n });
    const result = await listTransactionsTool.run({}, { userId: u.id, prisma });
    const { transactions } = result as { transactions: { amount: string }[] };
    expect(typeof transactions[0]?.amount).toBe('string');
    expect(transactions[0]?.amount).toBe('12345');
  });
});
