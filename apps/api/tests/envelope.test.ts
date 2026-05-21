import { describe, expect, it } from 'vitest';
import { err, ok } from '../src/lib/envelope.js';

describe('envelope helpers', () => {
  it('ok() wraps data with ok: true', () => {
    expect(ok({ service: 'api' })).toEqual({ ok: true, data: { service: 'api' } });
  });

  it('ok() preserves primitive data', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(ok(null)).toEqual({ ok: true, data: null });
  });

  it('err() shapes code + message without details', () => {
    expect(err('auth.invalid_credentials', 'Email atau password salah.')).toEqual({
      ok: false,
      error: { code: 'auth.invalid_credentials', message: 'Email atau password salah.' },
    });
  });

  it('err() includes details when provided', () => {
    expect(
      err('validation.failed', 'Validation gagal.', { fields: { email: 'required' } })
    ).toEqual({
      ok: false,
      error: {
        code: 'validation.failed',
        message: 'Validation gagal.',
        details: { fields: { email: 'required' } },
      },
    });
  });
});
