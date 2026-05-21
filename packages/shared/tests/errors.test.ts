import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, type ErrorCode } from '../src/errors.js';

describe('error codes', () => {
  it('every introduced auth/onboarding error code has a message', () => {
    const codes: ErrorCode[] = [
      'auth.invalid_token',
      'auth.token_expired',
      'auth.token_reused',
      'auth.unauthorized',
      'auth.unsupported_provider',
      'onboarding.required',
      'validation.failed',
      'internal.unknown',
    ];
    for (const c of codes) {
      expect(ERROR_MESSAGES[c]).toMatch(/.+/);
    }
  });
});
