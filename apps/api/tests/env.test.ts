import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub dotenv so this test controls process.env exclusively.
// Without this, a local apps/api/.env would silently re-populate vars we delete.
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('loadEnv', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    for (const key of [
      'NODE_ENV',
      'PORT',
      'APP_PUBLIC_URL',
      'API_PUBLIC_URL',
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_ACCESS_TTL_SECONDS',
      'JWT_REFRESH_TTL_SECONDS',
      'GOOGLE_OAUTH_CLIENT_IDS',
      'APPLE_OAUTH_CLIENT_IDS',
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns a typed config when all required vars are present', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'local-dev-google-id';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'local-dev-apple-id';

    const { loadEnv } = await import('../src/config/env.js');
    const env = loadEnv();

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.APP_PUBLIC_URL).toBe('http://localhost:8081');
    expect(env.API_PUBLIC_URL).toBe('http://localhost:3001');
  });

  it('throws a descriptive error when NODE_ENV is missing', async () => {
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'a';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/NODE_ENV/);
  });

  it('throws when APP_PUBLIC_URL is not a URL', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'not-a-url';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'a';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/APP_PUBLIC_URL/);
  });

  it('parses DATABASE_URL, JWT secrets, and OAuth client id lists', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS =
      'a.apps.googleusercontent.com,b.apps.googleusercontent.com';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'app.rapih.ios';

    const { loadEnv } = await import('../src/config/env.js');
    const env = loadEnv();

    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.JWT_REFRESH_TTL_SECONDS).toBe(2592000);
    expect(env.GOOGLE_OAUTH_CLIENT_IDS).toEqual([
      'a.apps.googleusercontent.com',
      'b.apps.googleusercontent.com',
    ]);
    expect(env.APPLE_OAUTH_CLIENT_IDS).toEqual(['app.rapih.ios']);
  });

  it('rejects a JWT_ACCESS_SECRET shorter than 32 chars', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'short';
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'a';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects empty OAuth client id lists', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://rapih:rapih@localhost:5433/rapih';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_OAUTH_CLIENT_IDS = '';
    process.env.APPLE_OAUTH_CLIENT_IDS = 'a';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/GOOGLE_OAUTH_CLIENT_IDS/);
  });
});
