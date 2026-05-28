import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `wallet-${Math.random().toString(36).slice(2)}@e.com`,
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

describe('wallets CRUD', () => {
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

  it('GET /wallets returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/wallets' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /wallets returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  it('GET /wallets returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.wallets).toEqual([]);
  });

  it('POST /wallets creates a wallet', async () => {
    const { token, user } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'bank',
        provider_name: 'BCA',
        label: 'Tahapan ····432',
        initial_balance: '8420000',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.wallet.kind).toBe('bank');
    expect(body.data.wallet.provider_name).toBe('BCA');
    expect(body.data.wallet.initial_balance).toBe('8420000');
    expect(body.data.wallet.balance).toBe('8420000');

    const dbWallets = await prisma.wallet.findMany({ where: { user_id: user.id } });
    expect(dbWallets).toHaveLength(1);
    expect(dbWallets[0]?.initial_balance).toBe(8420000n);
  });

  it('POST /wallets accepts negative initial_balance (e.g. credit card debt)', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'other',
        provider_name: 'CC Mandiri',
        initial_balance: '-1500000',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.wallet.initial_balance).toBe('-1500000');
  });

  it('POST /wallets rejects invalid body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'bogus', provider_name: '', initial_balance: 'abc' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('GET /wallets/:id returns the wallet', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: {
        user_id: user.id,
        kind: 'cash',
        provider_name: 'Tunai',
        initial_balance: 320000n,
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/wallets/${wallet.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.wallet.id).toBe(wallet.id);
  });

  it("GET /wallets/:id returns 404 for another user's wallet", async () => {
    const other = await prisma.user.create({
      data: { email: 'other@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherWallet = await prisma.wallet.create({
      data: { user_id: other.id, kind: 'cash', provider_name: 'X', initial_balance: 0n },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/wallets/${otherWallet.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('wallet.not_found');
  });

  it('PATCH /wallets/:id updates fields', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: {
        user_id: user.id,
        kind: 'bank',
        provider_name: 'BCA',
        initial_balance: 8420000n,
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/wallets/${wallet.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { provider_name: 'BCA Tahapan Xpresi', initial_balance: '9000000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.wallet.provider_name).toBe('BCA Tahapan Xpresi');
    expect(res.json().data.wallet.initial_balance).toBe('9000000');
  });

  it('PATCH /wallets/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'X', initial_balance: 0n },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/wallets/${wallet.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('DELETE /wallets/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'X', initial_balance: 0n },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/wallets/${wallet.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.wallet.findUnique({ where: { id: wallet.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/wallets',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.wallets).toEqual([]);
  });

  it('DELETE /wallets/:id returns 404 if already deleted (idempotent surface)', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: {
        user_id: user.id,
        kind: 'cash',
        provider_name: 'X',
        initial_balance: 0n,
        deleted_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/wallets/${wallet.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
