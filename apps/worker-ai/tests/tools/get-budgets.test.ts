import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getBudgetsTool } from '../../src/tools/get-budgets.js';
import { closeTestDb, getTestPrisma, resetTestDb } from '../helpers/test-db.js';
import '../helpers/test-env.js';

const prisma = getTestPrisma();

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `bud-${Math.random()}@e.com`,
      name: 'u',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
}

describe('get_budgets tool', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it("scopes by user — excludes other users' budgets", async () => {
    const a = await seedUser();
    const b = await seedUser();
    await prisma.budget.create({
      data: { user_id: a.id, name: 'A', icon: 'i', color: '#a', amount: 1000n },
    });
    await prisma.budget.create({
      data: { user_id: b.id, name: 'B', icon: 'i', color: '#b', amount: 2000n },
    });
    const result = await getBudgetsTool.run({}, { userId: a.id, prisma });
    const { budgets } = result as { budgets: { name: string }[] };
    expect(budgets).toHaveLength(1);
    expect(budgets[0]?.name).toBe('A');
  });

  it('current-month default — spent matches sum of expenses', async () => {
    const u = await seedUser();
    const cat = await prisma.category.create({
      data: { user_id: u.id, kind: 'expense', name: 'X', color: '#a', icon: 'i' },
    });
    const w = await prisma.wallet.create({
      data: { user_id: u.id, kind: 'bank', provider_name: 'BCA' },
    });
    const b = await prisma.budget.create({
      data: { user_id: u.id, name: 'Bud', icon: 'i', color: '#a', amount: 100000n },
    });
    await prisma.budgetCategory.create({
      data: { budget_id: b.id, category_id: cat.id },
    });
    await prisma.transaction.create({
      data: {
        user_id: u.id,
        wallet_id: w.id,
        kind: 'expense',
        amount: 25000n,
        category_id: cat.id,
        transacted_at: new Date(),
      },
    });
    const result = await getBudgetsTool.run({}, { userId: u.id, prisma });
    const { budgets } = result as {
      budgets: { name: string; amount: string; spent: string; remaining: string }[];
    };
    expect(budgets[0]).toEqual({
      name: 'Bud',
      amount: '100000',
      spent: '25000',
      remaining: '75000',
    });
  });

  it('respects month arg', async () => {
    const u = await seedUser();
    const cat = await prisma.category.create({
      data: { user_id: u.id, kind: 'expense', name: 'X', color: '#a', icon: 'i' },
    });
    const w = await prisma.wallet.create({
      data: { user_id: u.id, kind: 'bank', provider_name: 'BCA' },
    });
    const b = await prisma.budget.create({
      data: { user_id: u.id, name: 'Bud', icon: 'i', color: '#a', amount: 100000n },
    });
    await prisma.budgetCategory.create({
      data: { budget_id: b.id, category_id: cat.id },
    });
    await prisma.transaction.create({
      data: {
        user_id: u.id,
        wallet_id: w.id,
        kind: 'expense',
        amount: 50000n,
        category_id: cat.id,
        transacted_at: new Date(2025, 11, 15), // Dec 2025 (local)
      },
    });
    const result = await getBudgetsTool.run({ month: '2025-12' }, { userId: u.id, prisma });
    const { budgets } = result as { budgets: { spent: string }[] };
    expect(budgets[0]?.spent).toBe('50000');
  });
});
