import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

const NOW = '2026-05-27T10:00:00.000Z';

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `tx-${Math.random().toString(36).slice(2)}@e.com`,
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

async function makeWallet(userId: string, initialBalance = 0n) {
  return prisma.wallet.create({
    data: {
      user_id: userId,
      kind: 'cash',
      provider_name: 'Tunai',
      initial_balance: initialBalance,
    },
  });
}

describe('transactions CRUD', () => {
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

  it('GET /transactions returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /transactions returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /transactions returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transactions).toEqual([]);
  });

  // ─── Create — expense ────────────────────────────────────────────────

  it('POST /transactions creates an expense', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id, 500000n);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'expense',
        wallet_id: wallet.id,
        amount: '50000',
        transacted_at: NOW,
      },
    });
    expect(res.statusCode).toBe(200);
    const { transaction } = res.json().data;
    expect(transaction.kind).toBe('expense');
    expect(transaction.amount).toBe('50000');
    expect(transaction.to_wallet_id).toBeNull();
    expect(transaction.category_id).toBeNull();
  });

  // ─── Create — income ─────────────────────────────────────────────────

  it('POST /transactions creates an income', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'income',
        wallet_id: wallet.id,
        amount: '5000000',
        note: 'Gaji bulan ini',
        transacted_at: NOW,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transaction.kind).toBe('income');
    expect(res.json().data.transaction.note).toBe('Gaji bulan ini');
  });

  // ─── Create — transfer ───────────────────────────────────────────────

  it('POST /transactions creates a transfer between own wallets', async () => {
    const { token, user } = await userWithToken();
    const src = await makeWallet(user.id, 1000000n);
    const dst = await makeWallet(user.id, 0n);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'transfer',
        wallet_id: src.id,
        to_wallet_id: dst.id,
        amount: '300000',
        transacted_at: NOW,
      },
    });
    expect(res.statusCode).toBe(200);
    const { transaction } = res.json().data;
    expect(transaction.kind).toBe('transfer');
    expect(transaction.to_wallet_id).toBe(dst.id);
  });

  it('POST /transactions transfer without to_wallet_id returns 400', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'transfer', wallet_id: wallet.id, amount: '100', transacted_at: NOW },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('POST /transactions non-transfer with to_wallet_id returns 400', async () => {
    const { token, user } = await userWithToken();
    const w1 = await makeWallet(user.id);
    const w2 = await makeWallet(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'expense',
        wallet_id: w1.id,
        to_wallet_id: w2.id,
        amount: '100',
        transacted_at: NOW,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('POST /transactions rejects invalid body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'bogus', wallet_id: '', amount: '-500', transacted_at: 'not-a-date' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it("POST /transactions returns 404 for another user's wallet", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-tx@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherWallet = await makeWallet(other.id);
    const { token } = await userWithToken();

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'expense',
        wallet_id: otherWallet.id,
        amount: '1000',
        transacted_at: NOW,
      },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /transactions/:id returns the transaction', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const tx = await prisma.transaction.create({
      data: {
        user_id: user.id,
        kind: 'income',
        wallet_id: wallet.id,
        amount: 1000000n,
        transacted_at: new Date(NOW),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${tx.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transaction.id).toBe(tx.id);
    expect(res.json().data.transaction.amount).toBe('1000000');
  });

  it("GET /transactions/:id returns 404 for another user's transaction", async () => {
    const other = await prisma.user.create({
      data: { email: 'other2-tx@e.com', name: 'Other2', onboarding_completed_at: new Date() },
    });
    const otherWallet = await makeWallet(other.id);
    const otherTx = await prisma.transaction.create({
      data: {
        user_id: other.id,
        kind: 'expense',
        wallet_id: otherWallet.id,
        amount: 500n,
        transacted_at: new Date(NOW),
      },
    });

    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${otherTx.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('transaction.not_found');
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /transactions/:id updates fields', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const tx = await prisma.transaction.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        wallet_id: wallet.id,
        amount: 80000n,
        transacted_at: new Date(NOW),
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${tx.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: '90000', note: 'Makan siang' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transaction.amount).toBe('90000');
    expect(res.json().data.transaction.note).toBe('Makan siang');
  });

  it('PATCH /transactions/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const tx = await prisma.transaction.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        wallet_id: wallet.id,
        amount: 1000n,
        transacted_at: new Date(NOW),
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${tx.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /transactions/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const tx = await prisma.transaction.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        wallet_id: wallet.id,
        amount: 5000n,
        transacted_at: new Date(NOW),
      },
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/transactions/${tx.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.transactions).toEqual([]);
  });

  it('DELETE /transactions/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const wallet = await makeWallet(user.id);
    const tx = await prisma.transaction.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        wallet_id: wallet.id,
        amount: 1000n,
        transacted_at: new Date(NOW),
        deleted_at: new Date(),
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/transactions/${tx.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Filters ─────────────────────────────────────────────────────────

  it('GET /transactions?wallet_id= filters by wallet', async () => {
    const { token, user } = await userWithToken();
    const w1 = await makeWallet(user.id);
    const w2 = await makeWallet(user.id);
    await prisma.transaction.createMany({
      data: [
        {
          user_id: user.id,
          kind: 'expense',
          wallet_id: w1.id,
          amount: 1000n,
          transacted_at: new Date(NOW),
        },
        {
          user_id: user.id,
          kind: 'income',
          wallet_id: w2.id,
          amount: 2000n,
          transacted_at: new Date(NOW),
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/transactions?wallet_id=${w1.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transactions).toHaveLength(1);
    expect(res.json().data.transactions[0].wallet_id).toBe(w1.id);
  });

  // ─── Wallet balance reflects transactions ─────────────────────────────

  it('wallet balance reflects income, expense, and transfers', async () => {
    const { token, user } = await userWithToken();
    const w1 = await makeWallet(user.id, 1000000n);
    const w2 = await makeWallet(user.id, 0n);

    await prisma.transaction.createMany({
      data: [
        {
          user_id: user.id,
          kind: 'income',
          wallet_id: w1.id,
          amount: 500000n,
          transacted_at: new Date(NOW),
        },
        {
          user_id: user.id,
          kind: 'expense',
          wallet_id: w1.id,
          amount: 200000n,
          transacted_at: new Date(NOW),
        },
        {
          user_id: user.id,
          kind: 'transfer',
          wallet_id: w1.id,
          to_wallet_id: w2.id,
          amount: 100000n,
          transacted_at: new Date(NOW),
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/wallets/${w1.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // 1000000 initial + 500000 income - 200000 expense - 100000 transfer_out = 1200000
    expect(res.json().data.wallet.balance).toBe('1200000');

    const res2 = await app.inject({
      method: 'GET',
      url: `/wallets/${w2.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    // 0 initial + 100000 transfer_in = 100000
    expect(res2.json().data.wallet.balance).toBe('100000');
  });
});
