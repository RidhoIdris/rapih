import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/auth/tokens.js';

const SECRET = 'a'.repeat(32);

describe('auth/tokens', () => {
  it('generates 64-char hex refresh tokens that are unique', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hashRefreshToken is deterministic and 64 hex chars', () => {
    const t = generateRefreshToken();
    const h1 = hashRefreshToken(t);
    const h2 = hashRefreshToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
  });

  it('signAccessToken + verifyAccessToken round-trip with claims', () => {
    const jwt = signAccessToken({
      userId: 'clx_user',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: 900,
    });
    const claims = verifyAccessToken(jwt, SECRET);
    expect(claims.sub).toBe('clx_user');
    expect(claims.tier).toBe('free');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
  });

  it('verifyAccessToken throws on bad signature', () => {
    const jwt = signAccessToken({
      userId: 'clx_user',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: 900,
    });
    expect(() => verifyAccessToken(jwt, 'b'.repeat(32))).toThrow();
  });

  it('verifyAccessToken throws on expired token', () => {
    const jwt = signAccessToken({
      userId: 'u',
      tier: 'free',
      secret: SECRET,
      ttlSeconds: -10, // already expired
    });
    expect(() => verifyAccessToken(jwt, SECRET)).toThrow();
  });
});
