import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { clearTestJwksOverrides, setTestJwksOverrides } from '../src/auth/test-overrides.js';
import { createMockJwks, type MockJwksServer } from './helpers/jwks-mock.js';
import { resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

describe('rate limiting', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let mockJwks: MockJwksServer;

  beforeAll(async () => {
    mockJwks = await createMockJwks({ kid: 'rl-test' });
    setTestJwksOverrides({ google: mockJwks.url, apple: mockJwks.url });
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
    await mockJwks.close();
    clearTestJwksOverrides();
  });

  it('throttles /auth/google after 10 requests in a minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { id_token: 'will-fail-verify' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses[10]).toBe(429);
  });

  it('does not throttle /health below 100/min', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });
});
