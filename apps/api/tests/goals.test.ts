import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `goal-${Math.random().toString(36).slice(2)}@e.com`,
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

describe('goals CRUD', () => {
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

  it('GET /goals returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/goals' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /goals returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /goals returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.goals).toEqual([]);
  });

  // ─── Create ──────────────────────────────────────────────────────────

  it('POST /goals creates a goal', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Liburan Bali',
        icon: 'plane',
        color: '#4ECDC4',
        target_amount: '10000000',
        deadline: '2026-12-31T00:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(200);
    const { goal } = res.json().data;
    expect(goal.name).toBe('Liburan Bali');
    expect(goal.target_amount).toBe('10000000');
    expect(goal.saved_amount).toBe('0');
    expect(goal.progress).toBe(0);
    expect(goal.deadline).not.toBeNull();
    expect(goal.wallet_id).toBeNull();
  });

  it('POST /goals with saved_amount sets initial progress', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Motor Baru',
        icon: 'bike',
        color: '#FF6B6B',
        target_amount: '20000000',
        saved_amount: '5000000',
      },
    });
    expect(res.statusCode).toBe(200);
    const { goal } = res.json().data;
    expect(goal.saved_amount).toBe('5000000');
    expect(goal.progress).toBe(0.25);
  });

  it('POST /goals with wallet_id links to wallet', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: {
        user_id: user.id,
        kind: 'bank',
        provider_name: 'BCA Tabungan',
        initial_balance: 0n,
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Dana Darurat',
        icon: 'shield',
        color: '#95D47A',
        target_amount: '30000000',
        wallet_id: wallet.id,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.goal.wallet_id).toBe(wallet.id);
  });

  it("POST /goals returns 404 for another user's wallet", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-goal@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherWallet = await prisma.wallet.create({
      data: { user_id: other.id, kind: 'cash', provider_name: 'X', initial_balance: 0n },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad',
        icon: 'x',
        color: '#000000',
        target_amount: '1000000',
        wallet_id: otherWallet.id,
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /goals rejects invalid body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '', icon: '', color: 'bad', target_amount: '0' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /goals/:id returns the goal', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Rumah',
        icon: 'home',
        color: '#B5C9E0',
        target_amount: 500000000n,
        saved_amount: 50000000n,
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.goal.id).toBe(goal.id);
    expect(res.json().data.goal.progress).toBeCloseTo(0.1);
  });

  it("GET /goals/:id returns 404 for another user's goal", async () => {
    const other = await prisma.user.create({
      data: { email: 'other2-goal@e.com', name: 'Other2', onboarding_completed_at: new Date() },
    });
    const otherGoal = await prisma.goal.create({
      data: {
        user_id: other.id,
        name: 'Secret',
        icon: 'lock',
        color: '#000000',
        target_amount: 1000000n,
      },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/goals/${otherGoal.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('goal.not_found');
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /goals/:id updates saved_amount and recomputes progress', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Laptop',
        icon: 'laptop',
        color: '#7EC8E3',
        target_amount: 15000000n,
        saved_amount: 0n,
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { saved_amount: '7500000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.goal.saved_amount).toBe('7500000');
    expect(res.json().data.goal.progress).toBe(0.5);
  });

  it('PATCH /goals/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'X',
        icon: 'x',
        color: '#FFFFFF',
        target_amount: 1000000n,
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('PATCH /goals/:id clamps progress to 1 when saved exceeds target', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Overfunded',
        icon: 'star',
        color: '#FFE66D',
        target_amount: 1000000n,
      },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { saved_amount: '1500000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.goal.progress).toBe(1);
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /goals/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'ToDelete',
        icon: 'trash',
        color: '#FFFFFF',
        target_amount: 1000000n,
      },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/goals',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.goals).toEqual([]);
  });

  it('DELETE /goals/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Gone',
        icon: 'trash',
        color: '#FFFFFF',
        target_amount: 1000000n,
        deleted_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/goals/${goal.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
