import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `rutin-${Math.random().toString(36).slice(2)}@e.com`,
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

async function makeWallet(userId: string) {
  return prisma.wallet.create({
    data: { user_id: userId, kind: 'bank', provider_name: 'BCA', initial_balance: 0n },
  });
}

describe('recurring CRUD', () => {
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

  it('GET /recurring returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/recurring' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /recurring returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /recurring returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.recurring).toEqual([]);
  });

  // ─── Create ──────────────────────────────────────────────────────────

  it('POST /recurring creates a recurring transaction', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const res = await app.inject({
      method: 'POST',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'KPR BCA',
        icon: 'home',
        color: '#4ECDC4',
        kind: 'expense',
        wallet_id: wallet.id,
        amount: '3500000',
        period: 'monthly',
        next_due_date: '2026-06-01T00:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(200);
    const { recurring } = res.json().data;
    expect(recurring.name).toBe('KPR BCA');
    expect(recurring.amount).toBe('3500000');
    expect(recurring.period).toBe('monthly');
    expect(recurring.last_paid_at).toBeNull();
    expect(recurring.category_id).toBeNull();
  });

  it('POST /recurring validates body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: '',
        icon: '',
        color: 'bad',
        kind: 'transfer',
        amount: '0',
        period: 'monthly',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it("POST /recurring returns 404 for another user's wallet", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-rutin@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherWallet = await makeWallet(other.id);
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad',
        icon: 'x',
        color: '#000000',
        kind: 'expense',
        wallet_id: otherWallet.id,
        amount: '1000000',
        period: 'monthly',
        next_due_date: '2026-06-01T00:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /recurring/:id returns the item', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 150000n,
        name: 'Spotify',
        icon: 'music',
        color: '#1DB954',
        period: 'monthly',
        next_due_date: new Date('2026-06-15'),
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.recurring.id).toBe(row.id);
    expect(res.json().data.recurring.amount).toBe('150000');
  });

  it("GET /recurring/:id returns 404 for another user's item", async () => {
    const other = await prisma.user.create({
      data: { email: 'other2-rutin@e.com', name: 'Other2', onboarding_completed_at: new Date() },
    });
    const otherWallet = await makeWallet(other.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: other.id,
        wallet_id: otherWallet.id,
        kind: 'expense',
        amount: 100000n,
        name: 'Secret',
        icon: 'lock',
        color: '#000000',
        period: 'monthly',
        next_due_date: new Date('2026-06-01'),
      },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('recurring.not_found');
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /recurring/:id updates fields', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 200000n,
        name: 'Netflix',
        icon: 'tv',
        color: '#E50914',
        period: 'monthly',
        next_due_date: new Date('2026-06-10'),
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: '220000', name: 'Netflix Family' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.recurring.amount).toBe('220000');
    expect(res.json().data.recurring.name).toBe('Netflix Family');
  });

  it('PATCH /recurring/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100000n,
        name: 'X',
        icon: 'x',
        color: '#FFFFFF',
        period: 'monthly',
        next_due_date: new Date('2026-06-01'),
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /recurring/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100000n,
        name: 'ToDelete',
        icon: 'trash',
        color: '#FFFFFF',
        period: 'monthly',
        next_due_date: new Date('2026-06-01'),
      },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.recurringTransaction.findUnique({ where: { id: row.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/recurring',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.recurring).toEqual([]);
  });

  it('DELETE /recurring/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100000n,
        name: 'Gone',
        icon: 'trash',
        color: '#FFFFFF',
        period: 'monthly',
        next_due_date: new Date('2026-06-01'),
        deleted_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/recurring/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Pay ─────────────────────────────────────────────────────────────

  it('POST /recurring/:id/pay creates transaction and advances next_due_date', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 300000n,
        name: 'Indihome',
        icon: 'wifi',
        color: '#FF6B00',
        period: 'monthly',
        next_due_date: new Date('2026-06-05'),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/recurring/${row.id}/pay`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const updated = res.json().data.recurring;
    expect(updated.last_paid_at).not.toBeNull();
    // monthly: 2026-06-05 → 2026-07-05
    expect(updated.next_due_date).toContain('2026-07-05');

    const txns = await prisma.transaction.findMany({ where: { user_id: user.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(300000n);
    expect(txns[0].kind).toBe('expense');
    expect(txns[0].wallet_id).toBe(wallet.id);
  });

  it('POST /recurring/:id/pay advances weekly next_due_date by 7 days', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'income',
        amount: 500000n,
        name: 'Side job',
        icon: 'briefcase',
        color: '#95D47A',
        period: 'weekly',
        next_due_date: new Date('2026-06-02'),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/recurring/${row.id}/pay`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // weekly: 2026-06-02 → 2026-06-09
    expect(res.json().data.recurring.next_due_date).toContain('2026-06-09');
  });

  it("POST /recurring/:id/pay returns 404 for another user's item", async () => {
    const other = await prisma.user.create({
      data: { email: 'other3-rutin@e.com', name: 'Other3', onboarding_completed_at: new Date() },
    });
    const otherWallet = await makeWallet(other.id);
    const row = await prisma.recurringTransaction.create({
      data: {
        user_id: other.id,
        wallet_id: otherWallet.id,
        kind: 'expense',
        amount: 100000n,
        name: 'Secret',
        icon: 'lock',
        color: '#000000',
        period: 'monthly',
        next_due_date: new Date('2026-06-01'),
      },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: `/recurring/${row.id}/pay`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
