import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { runWeeklyReview } from '../src/jobs/weekly-review.js';
import { closePrisma } from '../src/lib/prisma.js';
import { closeAiQueue, getAiQueue } from '../src/queues/ai.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUserWithTx(opts: { tier: 'free' | 'plus' | 'pro'; daysAgo: number }) {
  const user = await prisma.user.create({
    data: {
      email: `wr-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      tier: opts.tier,
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  const wallet = await prisma.wallet.create({
    data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
  });
  await prisma.transaction.create({
    data: {
      user_id: user.id,
      wallet_id: wallet.id,
      kind: 'expense',
      amount: 100n,
      transacted_at: new Date(Date.now() - opts.daysAgo * 86400000),
    },
  });
  return user;
}

describe('weekly-review', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
    await getAiQueue().drain();
  });
  afterAll(async () => {
    await closeAiQueue();
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('enqueues for Pro user with recent activity', async () => {
    const u = await seedUserWithTx({ tier: 'pro', daysAgo: 5 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(1);
    const jobs = await getAiQueue().getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data.user_id).toBe(u.id);
    expect(jobs[0]?.name).toBe('weekly-review-gen');
  });

  it('skips Free tier', async () => {
    await seedUserWithTx({ tier: 'free', daysAgo: 5 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(0);
  });

  it('skips Pro user with no recent activity', async () => {
    await seedUserWithTx({ tier: 'pro', daysAgo: 45 });
    const res = await runWeeklyReview(new Date());
    expect(res.enqueued).toBe(0);
  });

  it('idempotent within same ISO week', async () => {
    await seedUserWithTx({ tier: 'pro', daysAgo: 1 });
    const t = new Date('2026-06-21T15:00:00Z');
    await runWeeklyReview(t);
    const second = await runWeeklyReview(t);
    expect(second.enqueued).toBe(0);
    expect(second.skipped).toBe(1);
  });
});
