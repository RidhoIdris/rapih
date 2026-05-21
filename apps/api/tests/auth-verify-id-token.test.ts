import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyAppleIdToken, verifyGoogleIdToken } from '../src/auth/verify-id-token.js';
import { createMockJwks, type MockJwksServer, signMockIdToken } from './helpers/jwks-mock.js';

describe('verifyGoogleIdToken (mocked JWKS)', () => {
  let jwks: MockJwksServer;
  let key: Awaited<ReturnType<typeof createMockJwks>>['keys'][number];
  const audience = 'test.apps.googleusercontent.com';
  const issuer = 'https://accounts.google.com';

  beforeAll(async () => {
    jwks = await createMockJwks({ kid: 'g-test' });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees key exists
    key = jwks.keys[0]!;
  });

  afterAll(async () => {
    await jwks.close();
  });

  it('verifies a valid Google id_token', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'g-user-1', email: 'r@gmail.com', email_verified: true, name: 'Ridho' },
      { iss: issuer, aud: audience }
    );
    const claims = await verifyGoogleIdToken(token, {
      audiences: [audience],
      jwksUrl: jwks.url,
    });
    expect(claims.sub).toBe('g-user-1');
    expect(claims.email).toBe('r@gmail.com');
    expect(claims.email_verified).toBe(true);
    expect(claims.name).toBe('Ridho');
  });

  it('rejects when audience mismatches', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'g-user-2', email: 'a@gmail.com', email_verified: true },
      { iss: issuer, aud: 'other.apps.googleusercontent.com' }
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url })
    ).rejects.toThrow();
  });

  it('rejects when issuer mismatches', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'g-user-3', email: 'a@gmail.com', email_verified: true },
      { iss: 'https://evil.example.com', aud: audience }
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url })
    ).rejects.toThrow();
  });

  it('rejects when email_verified is false', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'g-user-4', email: 'a@gmail.com', email_verified: false },
      { iss: issuer, aud: audience }
    );
    await expect(
      verifyGoogleIdToken(token, { audiences: [audience], jwksUrl: jwks.url })
    ).rejects.toThrow();
  });
});

describe('verifyAppleIdToken (mocked JWKS)', () => {
  let jwks: MockJwksServer;
  let key: Awaited<ReturnType<typeof createMockJwks>>['keys'][number];
  const audience = 'app.rapih.ios';
  const issuer = 'https://appleid.apple.com';

  beforeAll(async () => {
    jwks = await createMockJwks({ kid: 'a-test' });
    // biome-ignore lint/style/noNonNullAssertion: test setup guarantees key exists
    key = jwks.keys[0]!;
  });

  afterAll(async () => {
    await jwks.close();
  });

  it('verifies a valid Apple id_token without email_verified claim', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'a-user-1', email: 'a@privaterelay.appleid.com' },
      { iss: issuer, aud: audience }
    );
    const claims = await verifyAppleIdToken(token, {
      audiences: [audience],
      jwksUrl: jwks.url,
    });
    expect(claims.sub).toBe('a-user-1');
    expect(claims.email).toBe('a@privaterelay.appleid.com');
  });

  it('rejects expired tokens', async () => {
    const token = await signMockIdToken(
      key,
      { sub: 'a-user-2', email: 'a@example.com' },
      { iss: issuer, aud: audience, expSeconds: -10 }
    );
    await expect(
      verifyAppleIdToken(token, { audiences: [audience], jwksUrl: jwks.url })
    ).rejects.toThrow();
  });
});
