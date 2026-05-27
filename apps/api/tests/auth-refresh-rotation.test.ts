import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../src/auth/refresh-token-store.js';
import { hashRefreshToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function makeUser() {
  return prisma.user.create({ data: { email: 'r@e.com', name: 'R' } });
}

describe('refresh token rotation', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('createInitialRefreshToken issues a token + stores hashed row', async () => {
    const user = await makeUser();
    const result = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: 'iPhone',
    });
    expect(result.plain).toMatch(/^[0-9a-f]{64}$/);
    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.device_label).toBe('iPhone');
    expect(rows[0]?.token_hash).not.toBe(result.plain);
  });

  it('rotateRefreshToken issues a new token and revokes the old', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: 'Pixel',
    });

    const rotated = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: 'Pixel',
    });

    expect(rotated.kind).toBe('rotated');
    if (rotated.kind !== 'rotated') return;
    expect(rotated.userId).toBe(user.id);
    expect(rotated.plain).not.toBe(initial.plain);

    const rows = await prisma.refreshToken.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.revoked_at).not.toBeNull();
    expect(rows[0]?.replaced_by_id).toBe(rows[1]?.id);
    expect(rows[1]?.revoked_at).toBeNull();
  });

  it('rotateRefreshToken returns "not_found" for an unknown token', async () => {
    const result = await rotateRefreshToken(prisma, {
      plainToken: 'a'.repeat(64),
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(result.kind).toBe('not_found');
  });

  it('rotateRefreshToken returns "expired" for a past expires_at', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    await prisma.refreshToken.update({
      where: { token_hash: hashRefreshToken(initial.plain) },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const result = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(result.kind).toBe('expired');
  });

  it('reuse of an already-revoked token returns "reused" and revokes the entire chain', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    const r1 = await rotateRefreshToken(prisma, {
      plainToken: initial.plain,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    if (r1.kind !== 'rotated') throw new Error('precondition failed');

    const r2 = await rotateRefreshToken(prisma, {
      plainToken: initial.plain, // already revoked!
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    expect(r2.kind).toBe('reused');

    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
  });

  it('revokeRefreshToken is idempotent on unknown tokens (logout)', async () => {
    const result = await revokeRefreshToken(prisma, 'a'.repeat(64));
    expect(result.kind).toBe('not_found');
  });

  it('revokeRefreshToken marks a known token revoked but does not walk the chain', async () => {
    const user = await makeUser();
    const initial = await createInitialRefreshToken(prisma, {
      userId: user.id,
      ttlSeconds: 3600,
      deviceLabel: null,
    });
    const result = await revokeRefreshToken(prisma, initial.plain);
    expect(result.kind).toBe('revoked');

    const rows = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revoked_at).not.toBeNull();
  });
});
