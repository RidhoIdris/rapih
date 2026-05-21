import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('OpenAPI + Swagger UI', () => {
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

  it('GET /docs/json returns valid OpenAPI 3.0 with /health path', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.title).toBe('Rapih API');
    expect(spec.paths?.['/health']).toBeDefined();
    expect(spec.paths['/health'].get?.tags).toContain('meta');
  });

  it('GET /docs renders Swagger UI in dev', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(res.statusCode);
  });
});

describe('OpenAPI in production', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_PUBLIC_URL = 'http://localhost:8081';
    process.env.API_PUBLIC_URL = 'http://localhost:3001';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs returns 404 in production', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /docs/json still returns the spec in production', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
  });
});
