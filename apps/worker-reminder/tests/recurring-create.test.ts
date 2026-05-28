import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runRecurringCreate } from '../src/jobs/recurring-create.js';
import { closePrisma } from '../src/lib/prisma.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUserWithWallet() {
  const user = await prisma.user.create({
    data: {
      email: `rc-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  const wallet = await prisma.wallet.create({
    data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
  });
  return { user, wallet };
}

describe('recurring-create', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('creates a transaction for due recurring and advances next_due_date', async () => {
    const { user, wallet } = await seedUserWithWallet();
    const yesterday = new Date(Date.now() - 86400000);
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
        next_due_date: yesterday,
      },
    });

    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(1);

    const txns = await prisma.transaction.findMany({ where: { user_id: user.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0]?.amount).toBe(500000n);

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { user_id: user.id },
    });
    expect(recurring?.last_paid_at).not.toBeNull();
    expect(recurring?.next_due_date.getTime()).toBeGreaterThan(yesterday.getTime());
  });

  it('skips soft-deleted recurring', async () => {
    const { user, wallet } = await seedUserWithWallet();
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
        next_due_date: new Date(Date.now() - 86400000),
        deleted_at: new Date(),
      },
    });
    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('skips recurring with future next_due_date', async () => {
    const { user, wallet } = await seedUserWithWallet();
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
        next_due_date: new Date(Date.now() + 86400000),
      },
    });
    const res = await runRecurringCreate(new Date());
    expect(res.processed).toBe(0);
  });

  it('idempotent: claim blocks duplicate transaction creation on same day', async () => {
    const { user, wallet } = await seedUserWithWallet();
    const original = new Date('2026-06-14T00:00:00Z');
    const r = await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'monthly',
        next_due_date: original,
      },
    });
    const t = new Date('2026-06-15T00:05:00Z');
    await runRecurringCreate(t);

    // Simulate the row landing in the query again same day (e.g. operator manually
    // rolls it back). Claim should still block the second create.
    await prisma.recurringTransaction.update({
      where: { id: r.id },
      data: { next_due_date: original },
    });
    const second = await runRecurringCreate(t);
    expect(second.skipped).toBe(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('advances monthly period by one month', async () => {
    const { user, wallet } = await seedUserWithWallet();
    await prisma.recurringTransaction.create({
      data: {
        user_id: user.id,
        wallet_id: wallet.id,
        kind: 'expense',
        amount: 100n,
        name: 'X',
        icon: '◷',
        color: '#000000',
        period: 'monthly',
        next_due_date: new Date('2026-05-15T00:00:00Z'),
      },
    });
    await runRecurringCreate(new Date('2026-05-15T01:00:00Z'));
    const r = await prisma.recurringTransaction.findFirst();
    expect(r?.next_due_date.toISOString().slice(0, 10)).toBe('2026-06-15');
  });
});
