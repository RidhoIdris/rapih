import type { PrismaClient, User, UserProfile } from '@rapih/db';
import { normalizeEmail } from './email.js';

export interface UpsertSocialUserOpts {
  provider: 'google' | 'apple';
  providerUserId: string;
  email: string;
  name: string;
  isApplePrivateRelay: boolean;
  emailVerifiedAt: Date;
}

export interface UpsertedUser extends User {
  profile: UserProfile | null;
}

export async function upsertUserFromSocial(
  prisma: PrismaClient,
  opts: UpsertSocialUserOpts
): Promise<UpsertedUser> {
  const email = normalizeEmail(opts.email);

  return prisma.$transaction(async (tx) => {
    // 1. Existing social account → return its user.
    const existingSocial = await tx.socialAccount.findUnique({
      where: {
        provider_provider_user_id: {
          provider: opts.provider,
          provider_user_id: opts.providerUserId,
        },
      },
      include: { user: { include: { profile: true } } },
    });
    if (existingSocial) {
      return existingSocial.user;
    }

    // 2. Existing user by email → link new social account.
    const existingUser = await tx.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (existingUser) {
      await tx.socialAccount.create({
        data: {
          user_id: existingUser.id,
          provider: opts.provider,
          provider_user_id: opts.providerUserId,
        },
      });
      return existingUser;
    }

    // 3. Brand-new: create user + profile + social account.
    const created = await tx.user.create({
      data: {
        email,
        name: opts.name,
        email_verified_at: opts.emailVerifiedAt,
        apple_private_relay: opts.isApplePrivateRelay,
        social_accounts: {
          create: {
            provider: opts.provider,
            provider_user_id: opts.providerUserId,
          },
        },
        profile: { create: {} },
      },
      include: { profile: true },
    });
    return created;
  });
}
