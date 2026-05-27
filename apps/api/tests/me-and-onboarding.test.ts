import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = {}) {
  const user = await prisma.user.create({
    data: {
      email: 'r@e.com',
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
    include: { profile: true },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('GET /auth/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the full user payload with onboarding state', async () => {
    const { user, token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.id).toBe(user.id);
    expect(body.data.user.onboarding_completed_at).toBeNull();
    expect(body.data.user.profile).toEqual({
      nickname: null,
      income_range: null,
      primary_goal: null,
    });
  });
});

describe('PATCH /me/onboarding', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      payload: { nickname: 'R', income_range: 'r7to15', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('writes profile + stamps onboarding_completed_at', async () => {
    const { user, token } = await userWithToken();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho', income_range: 'r7to15', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.profile).toEqual({
      nickname: 'Ridho',
      income_range: 'r7to15',
      primary_goal: 'save',
    });
    expect(body.data.user.onboarding_completed_at).not.toBeNull();

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true },
    });
    expect(dbUser.onboarding_completed_at).not.toBeNull();
    expect(dbUser.profile?.nickname).toBe('Ridho');
  });

  it('rejects bogus enum values with validation.failed', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'R', income_range: 'bogus', primary_goal: 'save' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('does not bump onboarding_completed_at on a re-PATCH but does update profile', async () => {
    const { user, token } = await userWithToken();
    const first = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho', income_range: 'r7to15', primary_goal: 'save' },
    });
    const initialStamp = first.json().data.user.onboarding_completed_at;

    await new Promise((r) => setTimeout(r, 30));

    const second = await app.inject({
      method: 'PATCH',
      url: '/me/onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Ridho2', income_range: 'gt30', primary_goal: 'invest' },
    });
    expect(second.json().data.user.onboarding_completed_at).toBe(initialStamp);
    expect(second.json().data.user.profile.nickname).toBe('Ridho2');

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true },
    });
    expect(dbUser.profile?.nickname).toBe('Ridho2');
  });
});
