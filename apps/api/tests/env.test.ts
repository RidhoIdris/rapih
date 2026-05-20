import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub dotenv so this test controls process.env exclusively.
// Without this, a local apps/api/.env would silently re-populate vars we delete.
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('loadEnv', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    for (const key of ['NODE_ENV', 'PORT', 'APP_PUBLIC_URL', 'API_PUBLIC_URL']) {
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

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/NODE_ENV/);
  });

  it('throws when APP_PUBLIC_URL is not a URL', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_URL = 'not-a-url';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';

    const { loadEnv } = await import('../src/config/env.js');
    expect(() => loadEnv()).toThrow(/APP_PUBLIC_URL/);
  });
});
