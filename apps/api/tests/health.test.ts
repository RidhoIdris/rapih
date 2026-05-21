import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the success envelope with service + version', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      data: { service: 'api', version: '0.1.0' },
    });
  });
});
