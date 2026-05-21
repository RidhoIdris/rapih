import type { PrismaClient, RefreshToken } from '@rapih/db';
import { generateRefreshToken, hashRefreshToken } from './tokens.js';

export interface CreateInitialOpts {
  userId: string;
  ttlSeconds: number;
  deviceLabel: string | null;
}

export interface CreateInitialResult {
  plain: string;
  row: RefreshToken;
}

export async function createInitialRefreshToken(
  prisma: PrismaClient,
  opts: CreateInitialOpts
): Promise<CreateInitialResult> {
  const plain = generateRefreshToken();
  const tokenHash = hashRefreshToken(plain);
  const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);
  const row = await prisma.refreshToken.create({
    data: {
      user_id: opts.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      device_label: opts.deviceLabel,
    },
  });
  return { plain, row };
}

export type RotateResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'reused' }
  | { kind: 'rotated'; plain: string; userId: string };

export interface RotateOpts {
  plainToken: string;
  ttlSeconds: number;
  deviceLabel: string | null;
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  opts: RotateOpts
): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(opts.plainToken);
  const existing = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });

  if (!existing) return { kind: 'not_found' };

  if (existing.revoked_at !== null) {
    // Reuse detected — revoke ALL active tokens for this user.
    await prisma.refreshToken.updateMany({
      where: { user_id: existing.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { kind: 'reused' };
  }

  if (existing.expires_at.getTime() <= Date.now()) {
    return { kind: 'expired' };
  }

  // Happy path: issue a new token and link the rotation chain.
  const newPlain = generateRefreshToken();
  const newHash = hashRefreshToken(newPlain);
  const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        user_id: existing.user_id,
        token_hash: newHash,
        expires_at: expiresAt,
        device_label: opts.deviceLabel,
      },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revoked_at: new Date(), replaced_by_id: created.id },
    });
  });

  return { kind: 'rotated', plain: newPlain, userId: existing.user_id };
}

export type RevokeResult = { kind: 'not_found' } | { kind: 'revoked' };

export async function revokeRefreshToken(
  prisma: PrismaClient,
  plainToken: string
): Promise<RevokeResult> {
  const tokenHash = hashRefreshToken(plainToken);
  const row = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
  if (!row) return { kind: 'not_found' };
  if (row.revoked_at) return { kind: 'revoked' }; // idempotent
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revoked_at: new Date() },
  });
  return { kind: 'revoked' };
}
