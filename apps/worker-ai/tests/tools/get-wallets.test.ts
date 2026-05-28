import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getWalletsTool } from '../../src/tools/get-wallets.js';
import { closeTestDb, getTestPrisma, resetTestDb } from '../helpers/test-db.js';
import '../helpers/test-env.js';

const prisma = getTestPrisma();

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `wal-${Math.random()}@e.com`,
      name: 'u',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
}

describe('get_wallets tool', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await closeTestDb();
  });

  it("scopes by user — excludes other users' wallets", async () => {
    const a = await seedUser();
    const b = await seedUser();
    await prisma.wallet.create({
      data: {
        user_id: a.id,
        kind: 'bank',
        provider_name: 'BCA',
        initial_balance: 100n,
      },
    });
    await prisma.wallet.create({
      data: {
        user_id: b.id,
        kind: 'bank',
        provider_name: 'BNI',
        initial_balance: 200n,
      },
    });
    const result = await getWalletsTool.run({}, { userId: a.id, prisma });
    const { wallets } = result as { wallets: { name: string }[] };
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.name).toBe('BCA');
  });

  it('excludes soft-deleted wallets', async () => {
    const u = await seedUser();
    await prisma.wallet.create({
      data: {
        user_id: u.id,
        kind: 'bank',
        provider_name: 'X',
        deleted_at: new Date(),
      },
    });
    const result = await getWalletsTool.run({}, { userId: u.id, prisma });
    expect((result as { wallets: unknown[] }).wallets).toHaveLength(0);
  });

  it('balance = initial + income − expense', async () => {
    const u = await seedUser();
    const w = await prisma.wallet.create({
      data: {
        user_id: u.id,
        kind: 'bank',
        provider_name: 'BCA',
        initial_balance: 1000n,
      },
    });
    await prisma.transaction.create({
      data: {
        user_id: u.id,
        wallet_id: w.id,
        kind: 'income',
        amount: 500n,
        transacted_at: new Date(),
      },
    });
    await prisma.transaction.create({
      data: {
        user_id: u.id,
        wallet_id: w.id,
        kind: 'expense',
        amount: 200n,
        transacted_at: new Date(),
      },
    });
    const result = await getWalletsTool.run({}, { userId: u.id, prisma });
    const { wallets } = result as { wallets: { balance: string }[] };
    expect(wallets[0]?.balance).toBe('1300');
  });

  it('balance as string', async () => {
    const u = await seedUser();
    await prisma.wallet.create({
      data: {
        user_id: u.id,
        kind: 'cash',
        provider_name: 'Cash',
        initial_balance: 42n,
      },
    });
    const result = await getWalletsTool.run({}, { userId: u.id, prisma });
    const { wallets } = result as { wallets: { balance: string }[] };
    expect(typeof wallets[0]?.balance).toBe('string');
    expect(wallets[0]?.balance).toBe('42');
  });
});
