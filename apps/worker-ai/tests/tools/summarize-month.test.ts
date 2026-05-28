import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { summarizeMonthTool } from '../../src/tools/summarize-month.js';
import { closeTestDb, getTestPrisma, resetTestDb } from '../helpers/test-db.js';
import '../helpers/test-env.js';

const prisma = getTestPrisma();

async function setup() {
  const user = await prisma.user.create({
    data: {
      email: `sum-${Math.random()}@e.com`,
      name: 'u',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
  const wallet = await prisma.wallet.create({
    data: { user_id: user.id, kind: 'bank', provider_name: 'BCA' },
  });
  return { user, wallet };
}

describe('summarize_month tool', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it('groups expenses by category and computes income/expense/net', async () => {
    const { user, wallet } = await setup();
    const foodCat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'Makan',
        color: '#a',
        icon: 'i',
      },
    });
    const transportCat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'Transport',
        color: '#b',
        icon: 'i',
      },
    });
    const within = new Date(2026, 4, 10); // May 10 2026 (local)
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 30000n,
        category_id: foodCat.id,
        transacted_at: within,
      },
    });
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 50000n,
        category_id: foodCat.id,
        transacted_at: within,
      },
    });
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 20000n,
        category_id: transportCat.id,
        transacted_at: within,
      },
    });
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'income',
        amount: 1000000n,
        transacted_at: within,
      },
    });
    const result = await summarizeMonthTool.run({ month: '2026-05' }, { userId: user.id, prisma });
    const r = result as {
      income: string;
      expense: string;
      net: string;
      by_category: { name: string; total: string }[];
    };
    expect(r.income).toBe('1000000');
    expect(r.expense).toBe('100000');
    expect(r.net).toBe('900000');
    expect(r.by_category[0]).toEqual({ name: 'Makan', total: '80000' });
    expect(r.by_category[1]).toEqual({ name: 'Transport', total: '20000' });
  });

  it('excludes transactions outside the month', async () => {
    const { user, wallet } = await setup();
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 99999n,
        transacted_at: new Date(2026, 5, 1), // June
      },
    });
    const result = await summarizeMonthTool.run({ month: '2026-05' }, { userId: user.id, prisma });
    const r = result as { expense: string };
    expect(r.expense).toBe('0');
  });

  it('empty month returns zeros and empty by_category', async () => {
    const { user } = await setup();
    const result = await summarizeMonthTool.run({ month: '2026-05' }, { userId: user.id, prisma });
    expect(result).toEqual({ income: '0', expense: '0', net: '0', by_category: [] });
  });
});
