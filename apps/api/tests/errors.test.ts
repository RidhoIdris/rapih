import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { AppError, registerErrorHandler } from '../src/lib/errors.js';

describe('AppError + error handler', () => {
  async function buildApp(opts: { nodeEnv?: 'development' | 'production' } = {}) {
    const app = Fastify({ logger: false });
    registerErrorHandler(app, { nodeEnv: opts.nodeEnv ?? 'development' });
    return app;
  }

  it('shapes AppError into the err envelope with the given status', async () => {
    const app = await buildApp();
    app.get('/boom', () => {
      throw new AppError('auth.invalid_credentials', 'Email atau password salah.', 401);
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: 'Email atau password salah.' },
    });
  });

  it('shapes Fastify schema validation errors as validation.failed', async () => {
    const app = await buildApp();
    app.post(
      '/echo',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string', minLength: 1 } },
          },
        },
      },
      () => ({ ok: true })
    );

    const res = await app.inject({ method: 'POST', url: '/echo', payload: {} });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('validation.failed');
  });

  it('returns internal.unknown 500 for unexpected errors and hides message in production', async () => {
    const app = await buildApp({ nodeEnv: 'production' });
    app.get('/oops', () => {
      throw new Error('secret stack info');
    });

    const res = await app.inject({ method: 'GET', url: '/oops' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('internal.unknown');
    expect(body.error.message).not.toContain('secret stack info');
  });
});
