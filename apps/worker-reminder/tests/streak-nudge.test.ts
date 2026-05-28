import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runStreakNudge } from '../src/jobs/streak-nudge.js';
import { closePrisma } from '../src/lib/prisma.js';
import { makeExpoMock } from './helpers/expo-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUser(opts: { onboarded?: boolean; devices?: number } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `sn-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded === false ? null : new Date(),
      profile: { create: {} },
    },
  });
  for (let i = 0; i < (opts.devices ?? 1); i++) {
    await prisma.deviceToken.create({
      data: {
        user_id: user.id,
        token: `ExponentPushToken[${user.id}-${i}]`,
        platform: 'ios',
      },
    });
  }
  return user;
}

const NOW = new Date('2026-06-15T13:00:00Z'); // 20:00 Jakarta

describe('streak-nudge', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('pushes user without any tx today', async () => {
    await seedUser();
    const { fetchImpl, calls } = makeExpoMock();
    const res = await runStreakNudge(NOW, fetchImpl);
    expect(res.pushed).toBe(1);
    expect(calls).toHaveLength(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('does not push user who logged tx today', async () => {
    const user = await seedUser();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.transaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        transacted_at: new Date('2026-06-15T08:00:00Z'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('does not push user without completed onboarding', async () => {
    await seedUser({ onboarded: false });
    const { fetchImpl, calls } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('skips entirely when user has zero device tokens — no notif row', async () => {
    await seedUser({ devices: 0 });
    const { fetchImpl } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('idempotent: second run is no-op', async () => {
    await seedUser();
    const { fetchImpl } = makeExpoMock();
    await runStreakNudge(NOW, fetchImpl);
    const { fetchImpl: second, calls: secondCalls } = makeExpoMock();
    await runStreakNudge(NOW, second);
    expect(secondCalls).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(1);
  });
});
