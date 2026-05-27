import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildRawApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

/**
 * Build a test app with extra routes that exercise the auth decorators.
 * Uses buildRawApp() so we can add routes before ready().
 */
async function buildTestApp() {
  const app = await buildRawApp();
  // Register test-only routes BEFORE ready() so decorators are available.
  await app.register(async (instance) => {
    instance.get('/__test/protected', { onRequest: [instance.authenticate] }, async (req) => ({
      ok: true,
      data: { sub: req.user.id },
    }));
    instance.get(
      '/__test/onboarded',
      { onRequest: [instance.authenticate, instance.requireOnboarding] },
      async (req) => ({ ok: true, data: { sub: req.user.id } })
    );
  });
  await app.ready();
  return app;
}

describe('auth decorators (authenticate + requireOnboarding)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no bearer is sent', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.unauthorized');
  });

  it('returns 401 on a bad bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: 'Bearer bad.signed.token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('passes through a valid bearer', async () => {
    const user = await prisma.user.create({
      data: { email: 'u@example.com', name: 'U' },
    });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.sub).toBe(user.id);
  });

  it('requireOnboarding blocks users without onboarding_completed_at', async () => {
    const user = await prisma.user.create({ data: { email: 'a@e.com', name: 'A' } });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/onboarded',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  it('requireOnboarding lets onboarded users through', async () => {
    const user = await prisma.user.create({
      data: { email: 'b@e.com', name: 'B', onboarding_completed_at: new Date() },
    });
    const token = signAccessToken({
      userId: user.id,
      tier: 'free',
      secret: process.env.JWT_ACCESS_SECRET as string,
      ttlSeconds: 900,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/__test/onboarded',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
