import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `budget-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('budgets CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── Auth / onboarding guards ────────────────────────────────────────

  it('GET /budgets returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/budgets' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /budgets returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /budgets returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.budgets).toEqual([]);
  });

  // ─── Create ──────────────────────────────────────────────────────────

  it('POST /budgets creates a budget with no categories (catch-all)', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Total pengeluaran',
        icon: 'wallet',
        color: '#4ECDC4',
        amount: '5000000',
        category_ids: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const { budget } = res.json().data;
    expect(budget.name).toBe('Total pengeluaran');
    expect(budget.amount).toBe('5000000');
    expect(budget.category_ids).toEqual([]);
    expect(budget.spent).toBe('0');
    expect(budget.progress).toBe(0);
  });

  it('POST /budgets creates a budget with categories', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'Makan',
        color: '#FF6B6B',
        icon: 'utensils',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Makan & minum',
        icon: 'utensils',
        color: '#FF6B6B',
        amount: '2000000',
        category_ids: [cat.id],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.budget.category_ids).toContain(cat.id);
  });

  it('POST /budgets rejects invalid category_id', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad',
        icon: 'x',
        color: '#000000',
        amount: '1000000',
        category_ids: ['nonexistent-id'],
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('category.not_found');
  });

  it('POST /budgets rejects invalid body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '', icon: '', color: 'bad', amount: '0', category_ids: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /budgets/:id returns the budget', async () => {
    const { token, user } = await userWithToken();
    const budget = await prisma.budget.create({
      data: { user_id: user.id, name: 'Transport', icon: 'car', color: '#7EC8E3', amount: 800000n },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.budget.id).toBe(budget.id);
    expect(res.json().data.budget.spent).toBe('0');
    expect(res.json().data.budget.remaining).toBe('800000');
  });

  it("GET /budgets/:id returns 404 for another user's budget", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-budget@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherBudget = await prisma.budget.create({
      data: { user_id: other.id, name: 'Secret', icon: 'lock', color: '#000000', amount: 1000000n },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${otherBudget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('budget.not_found');
  });

  // ─── Spent computation ────────────────────────────────────────────────

  it('GET /budgets shows spent from current-month category transactions', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    const cat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'Makan',
        color: '#FF6B6B',
        icon: 'utensils',
      },
    });
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'Makan',
        icon: 'utensils',
        color: '#FF6B6B',
        amount: 2000000n,
        budget_categories: { create: { category_id: cat.id } },
      },
    });

    // Current-month expense in this category
    const now = new Date();
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        category_id: cat.id,
        amount: 150000n,
        transacted_at: now,
      },
    });
    // Another expense in same category
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        category_id: cat.id,
        amount: 75000n,
        transacted_at: now,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json().data.budget;
    expect(b.spent).toBe('225000');
    expect(b.remaining).toBe('1775000');
    expect(b.progress).toBeCloseTo(0.1125);
  });

  it('GET /budgets does NOT count past-month transactions', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    const cat = await prisma.category.create({
      data: { user_id: user.id, kind: 'expense', name: 'Listrik', color: '#FFE66D', icon: 'zap' },
    });
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'Listrik',
        icon: 'zap',
        color: '#FFE66D',
        amount: 500000n,
        budget_categories: { create: { category_id: cat.id } },
      },
    });

    // Last month transaction
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        category_id: cat.id,
        amount: 400000n,
        transacted_at: lastMonth,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.budget.spent).toBe('0');
  });

  it('catch-all budget (no categories) sums all current-month expenses', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'Total',
        icon: 'wallet',
        color: '#95D47A',
        amount: 10000000n,
      },
    });

    const now = new Date();
    await prisma.transaction.createMany({
      data: [
        {
          user_id: user.id,
          wallet_id: wallet.id,
          kind: 'expense',
          amount: 200000n,
          transacted_at: now,
        },
        {
          user_id: user.id,
          wallet_id: wallet.id,
          kind: 'expense',
          amount: 300000n,
          transacted_at: now,
        },
        // income — should not count
        {
          user_id: user.id,
          wallet_id: wallet.id,
          kind: 'income',
          amount: 1000000n,
          transacted_at: now,
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.budget.spent).toBe('500000');
  });

  it('budget progress clamps to 1 when overspent', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    const budget = await prisma.budget.create({
      data: { user_id: user.id, name: 'Kecil', icon: 'x', color: '#FF6B6B', amount: 100000n },
    });

    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 150000n,
        transacted_at: new Date(),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.budget.progress).toBe(1);
    // remaining can be negative
    expect(res.json().data.budget.remaining).toBe('-50000');
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /budgets/:id updates name and amount', async () => {
    const { token, user } = await userWithToken();
    const budget = await prisma.budget.create({
      data: { user_id: user.id, name: 'Old', icon: 'x', color: '#FFFFFF', amount: 1000000n },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New', amount: '2000000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.budget.name).toBe('New');
    expect(res.json().data.budget.amount).toBe('2000000');
  });

  it('PATCH /budgets/:id replaces category_ids', async () => {
    const { token, user } = await userWithToken();
    const cat1 = await prisma.category.create({
      data: { user_id: user.id, kind: 'expense', name: 'A', color: '#AAAAAA', icon: 'a' },
    });
    const cat2 = await prisma.category.create({
      data: { user_id: user.id, kind: 'expense', name: 'B', color: '#BBBBBB', icon: 'b' },
    });
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'Test',
        icon: 'x',
        color: '#FFFFFF',
        amount: 1000000n,
        budget_categories: { create: { category_id: cat1.id } },
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { category_ids: [cat2.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.budget.category_ids).toEqual([cat2.id]);
  });

  it('PATCH /budgets/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const budget = await prisma.budget.create({
      data: { user_id: user.id, name: 'X', icon: 'x', color: '#FFFFFF', amount: 1000000n },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /budgets/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'ToDelete',
        icon: 'trash',
        color: '#FFFFFF',
        amount: 1000000n,
      },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.budget.findUnique({ where: { id: budget.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/budgets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.budgets).toEqual([]);
  });

  it('DELETE /budgets/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const budget = await prisma.budget.create({
      data: {
        user_id: user.id,
        name: 'Gone',
        icon: 'trash',
        color: '#FFFFFF',
        amount: 1000000n,
        deleted_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
