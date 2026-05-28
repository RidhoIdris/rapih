import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runDuePush } from '../src/jobs/due-push.js';
import { closePrisma } from '../src/lib/prisma.js';
import { makeExpoMock } from './helpers/expo-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUser(opts: { devices?: number } = { devices: 1 }) {
  const user = await prisma.user.create({
    data: {
      email: `dp-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  for (let i = 0; i < (opts.devices ?? 0); i++) {
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

const NOW = new Date('2026-06-15T02:00:00Z'); // 09:00 Jakarta
const TOMORROW_JKT = new Date('2026-06-16T00:00:00+07:00');

describe('due-push', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('pushes for recurring with next_due_date tomorrow (Jakarta)', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 500000n,
        name: 'Netflix',
        icon: '◷',
        color: '#000000',
        period: 'monthly',
        next_due_date: TOMORROW_JKT,
      },
    });

    const { fetchImpl, calls } = makeExpoMock();
    const res = await runDuePush(NOW, fetchImpl);
    expect(res.pushed).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]?.to).toMatch(/^ExponentPushToken\[/);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('does not push for recurring 2 days away', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'daily',
        next_due_date: new Date('2026-06-17T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
  });

  it('pushes for goal H-7 with correct copy', async () => {
    const user = await seedUser({ devices: 1 });
    await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Liburan',
        icon: '◇',
        color: '#000000',
        target_amount: 10000000n,
        saved_amount: 6000000n,
        deadline: new Date('2026-06-22T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(1);
    const body = calls[0]?.[0] as { to: string; title: string };
    expect(body.title).toBe('Goal Liburan tinggal 7 hari');
  });

  it('pushes for goal H-1 with "besok" copy', async () => {
    const user = await seedUser({ devices: 1 });
    await prisma.goal.create({
      data: {
        user_id: user.id,
        name: 'Liburan',
        icon: '◇',
        color: '#000000',
        target_amount: 10000000n,
        saved_amount: 6000000n,
        deadline: new Date('2026-06-16T00:00:00+07:00'),
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    const body = calls[0]?.[0] as { to: string; title: string };
    expect(body.title).toBe('Goal Liburan besok!');
  });

  it('sends one message per device token', async () => {
    const user = await seedUser({ devices: 3 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls[0]).toHaveLength(3);
  });

  it('skips entirely when user has zero devices — no notif row', async () => {
    const user = await seedUser({ devices: 0 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl, calls } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    expect(calls).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('deletes device token on DeviceNotRegistered', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl } = makeExpoMock(() => ({
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    }));
    const res = await runDuePush(NOW, fetchImpl);
    expect(res.removed).toBe(1);
    expect(await prisma.deviceToken.count()).toBe(0);
  });

  it('idempotent: second run same day is a no-op', async () => {
    const user = await seedUser({ devices: 1 });
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'daily',
        next_due_date: TOMORROW_JKT,
      },
    });
    const { fetchImpl } = makeExpoMock();
    await runDuePush(NOW, fetchImpl);
    const { fetchImpl: second, calls: secondCalls } = makeExpoMock();
    const res = await runDuePush(NOW, second);
    expect(secondCalls).toHaveLength(0);
    expect(res.skipped).toBeGreaterThan(0);
  });
});
