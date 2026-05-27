import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { clearTestJwksOverrides, setTestJwksOverrides } from '../src/auth/test-overrides.js';
import { createMockJwks, type MockJwksServer, signMockIdToken } from './helpers/jwks-mock.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

describe('auth sign-in routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let googleJwks: MockJwksServer;
  let appleJwks: MockJwksServer;
  let gKey: MockJwksServer['keys'][number];
  let aKey: MockJwksServer['keys'][number];

  beforeAll(async () => {
    googleJwks = await createMockJwks({ kid: 'g' });
    appleJwks = await createMockJwks({ kid: 'a' });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees key exists
    gKey = googleJwks.keys[0]!;
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees key exists
    aKey = appleJwks.keys[0]!;
    setTestJwksOverrides({ google: googleJwks.url, apple: appleJwks.url });
    app = await buildApp();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await app.close();
    await googleJwks.close();
    await appleJwks.close();
    clearTestJwksOverrides();
  });

  // ── Google ─────────────────────────────────────────────────────────────

  it('POST /auth/google creates a brand-new user and issues tokens', async () => {
    const idToken = await signMockIdToken(
      gKey,
      { sub: 'g-1', email: 'r@gmail.com', email_verified: true, name: 'Ridho' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.access_token).toMatch(/^ey/);
    expect(body.data.refresh_token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.user.email).toBe('r@gmail.com');
    expect(body.data.user.onboarding_completed_at).toBeNull();

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
  });

  it('POST /auth/google returns the same user on a returning sign-in', async () => {
    const make = async (sub: string, name: string) =>
      signMockIdToken(
        gKey,
        { sub, email: 'r@gmail.com', email_verified: true, name },
        { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' }
      );
    const a = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: await make('g-1', 'Ridho') },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: await make('g-1', 'Ridho V2') },
    });
    expect(a.json().data.user.id).toBe(b.json().data.user.id);
  });

  it('POST /auth/google returns 401 when audience mismatches', async () => {
    const idToken = await signMockIdToken(
      gKey,
      { sub: 'g-bad', email: 'r@gmail.com', email_verified: true },
      { iss: 'https://accounts.google.com', aud: 'wrong-aud' }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.invalid_token');
  });

  // ── Apple ──────────────────────────────────────────────────────────────

  it('POST /auth/apple creates a user with name from body', async () => {
    const idToken = await signMockIdToken(
      aKey,
      { sub: 'a-1', email: 'r@example.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken, name: { firstName: 'Ridho', lastName: 'Idris' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.name).toBe('Ridho Idris');
  });

  it('POST /auth/apple uses email local-part when no name body and not relay', async () => {
    const idToken = await signMockIdToken(
      aKey,
      { sub: 'a-2', email: 'someone@example.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user.name).toBe('someone');
  });

  it('POST /auth/apple uses fallback "Pengguna Rapih" for private relay without name', async () => {
    const idToken = await signMockIdToken(
      aKey,
      { sub: 'a-3', email: 'abc@privaterelay.appleid.com' },
      { iss: 'https://appleid.apple.com', aud: 'app.rapih.ios' }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { id_token: idToken },
    });
    expect(res.statusCode).toBe(200);
    const user = res.json().data.user;
    expect(user.name).toBe('Pengguna Rapih');
    const dbUser = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    expect(dbUser.apple_private_relay).toBe(true);
    expect(dbUser.email_verified_at).not.toBeNull();
  });

  // ── Refresh ───────────────────────────────────────────────────────────

  it('POST /auth/refresh rotates the token', async () => {
    const idToken = await signMockIdToken(
      gKey,
      { sub: 'g-r', email: 'rf@gmail.com', email_verified: true, name: 'Rf' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' }
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const oldRefresh = signin.json().data.refresh_token;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: oldRefresh },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.refresh_token).not.toBe(oldRefresh);
    expect(body.data.access_token).toMatch(/^ey/);
  });

  it('POST /auth/refresh detects reuse and returns 401 token_reused', async () => {
    const idToken = await signMockIdToken(
      gKey,
      { sub: 'g-reuse', email: 'reuse@gmail.com', email_verified: true, name: 'Reuse' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' }
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const oldRefresh = signin.json().data.refresh_token;
    await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: oldRefresh },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: oldRefresh },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.token_reused');
  });

  it('POST /auth/refresh returns 401 invalid_token for an unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('auth.invalid_token');
  });

  // ── Logout ────────────────────────────────────────────────────────────

  it('POST /auth/logout returns 204 and revokes the refresh token', async () => {
    const idToken = await signMockIdToken(
      gKey,
      { sub: 'g-out', email: 'out@gmail.com', email_verified: true, name: 'Out' },
      { iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com' }
    );
    const signin = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { id_token: idToken },
    });
    const refresh = signin.json().data.refresh_token;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: refresh },
    });
    expect(res.statusCode).toBe(204);
    const reused = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: refresh },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('POST /auth/logout is idempotent (unknown token still 204)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(204);
  });
});
