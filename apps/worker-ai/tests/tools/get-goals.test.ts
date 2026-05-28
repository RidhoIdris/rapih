import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getGoalsTool } from '../../src/tools/get-goals.js';
import { closeTestDb, getTestPrisma, resetTestDb } from '../helpers/test-db.js';
import '../helpers/test-env.js';

const prisma = getTestPrisma();

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `goal-${Math.random()}@e.com`,
      name: 'u',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
}

describe('get_goals tool', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it("scopes by user — excludes other users' goals", async () => {
    const a = await seedUser();
    const b = await seedUser();
    await prisma.goal.create({
      data: { user_id: a.id, name: 'A', icon: 'i', color: '#a', target_amount: 100n },
    });
    await prisma.goal.create({
      data: { user_id: b.id, name: 'B', icon: 'i', color: '#b', target_amount: 200n },
    });
    const result = await getGoalsTool.run({}, { userId: a.id, prisma });
    const { goals } = result as { goals: { name: string }[] };
    expect(goals).toHaveLength(1);
    expect(goals[0]?.name).toBe('A');
  });

  it('excludes soft-deleted goals', async () => {
    const u = await seedUser();
    await prisma.goal.create({
      data: {
        user_id: u.id,
        name: 'Gone',
        icon: 'i',
        color: '#a',
        target_amount: 100n,
        deleted_at: new Date(),
      },
    });
    const result = await getGoalsTool.run({}, { userId: u.id, prisma });
    expect((result as { goals: unknown[] }).goals).toHaveLength(0);
  });

  it('progress_pct math: saved=500, target=2000 → 25', async () => {
    const u = await seedUser();
    await prisma.goal.create({
      data: {
        user_id: u.id,
        name: 'P',
        icon: 'i',
        color: '#a',
        target_amount: 2000n,
        saved_amount: 500n,
      },
    });
    const result = await getGoalsTool.run({}, { userId: u.id, prisma });
    const { goals } = result as { goals: { progress_pct: number }[] };
    expect(goals[0]?.progress_pct).toBe(25);
  });

  it('progress_pct caps at 100 when over target', async () => {
    const u = await seedUser();
    await prisma.goal.create({
      data: {
        user_id: u.id,
        name: 'P',
        icon: 'i',
        color: '#a',
        target_amount: 100n,
        saved_amount: 9999n,
      },
    });
    const result = await getGoalsTool.run({}, { userId: u.id, prisma });
    const { goals } = result as { goals: { progress_pct: number }[] };
    expect(goals[0]?.progress_pct).toBe(100);
  });

  it('returns amounts as strings', async () => {
    const u = await seedUser();
    await prisma.goal.create({
      data: {
        user_id: u.id,
        name: 'P',
        icon: 'i',
        color: '#a',
        target_amount: 1234567n,
        saved_amount: 123n,
      },
    });
    const result = await getGoalsTool.run({}, { userId: u.id, prisma });
    const { goals } = result as { goals: { target: string; saved: string }[] };
    expect(goals[0]?.target).toBe('1234567');
    expect(goals[0]?.saved).toBe('123');
  });
});
