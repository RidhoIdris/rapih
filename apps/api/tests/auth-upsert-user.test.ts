import { beforeEach, describe, expect, it } from 'vitest';
import { upsertUserFromSocial } from '../src/auth/upsert-user.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

describe('upsertUserFromSocial', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates a brand-new user + social account + empty profile', async () => {
    const user = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-1',
      email: 'r@gmail.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });

    expect(user.email).toBe('r@gmail.com');
    expect(user.name).toBe('Ridho');
    expect(user.tier).toBe('free');
    expect(user.profile).toBeDefined();

    const socials = await prisma.socialAccount.findMany({ where: { user_id: user.id } });
    expect(socials).toHaveLength(1);
    expect(socials[0]?.provider).toBe('google');
    expect(socials[0]?.provider_user_id).toBe('g-1');
  });

  it('returns the same user on a repeat sign-in (same provider sub)', async () => {
    const a = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-2',
      email: 'r@gmail.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    const b = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-2',
      email: 'r@gmail.com',
      name: 'Different',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('Ridho'); // first-write-wins on name
  });

  it('links a new social account to an existing user when emails match', async () => {
    const google = await upsertUserFromSocial(prisma, {
      provider: 'google',
      providerUserId: 'g-3',
      email: 'r@example.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    const apple = await upsertUserFromSocial(prisma, {
      provider: 'apple',
      providerUserId: 'a-3',
      email: 'r@example.com',
      name: 'Ridho',
      isApplePrivateRelay: false,
      emailVerifiedAt: new Date(),
    });
    expect(apple.id).toBe(google.id);
    const socials = await prisma.socialAccount.findMany({ where: { user_id: google.id } });
    expect(socials).toHaveLength(2);
  });

  it('marks Apple private-relay correctly', async () => {
    const user = await upsertUserFromSocial(prisma, {
      provider: 'apple',
      providerUserId: 'a-relay',
      email: 'abc@privaterelay.appleid.com',
      name: 'Pengguna Rapih',
      isApplePrivateRelay: true,
      emailVerifiedAt: new Date(),
    });
    expect(user.apple_private_relay).toBe(true);
  });
});
