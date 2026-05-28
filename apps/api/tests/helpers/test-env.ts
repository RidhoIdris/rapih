/**
 * Sets the required env vars for an integration test before importing the
 * app or database modules. Idempotent — call at the top of each test file
 * BEFORE any `import { ... } from '../src/...'`.
 */
export function setTestEnv(): void {
  process.env.NODE_ENV ??= 'test';
  process.env.APP_PUBLIC_URL ??= 'http://localhost:8081';
  process.env.API_PUBLIC_URL ??= 'http://localhost:3001';
  process.env.DATABASE_URL ??= 'postgresql://rapih:rapih@localhost:5433/rapih_test';
  process.env.REDIS_URL ??= 'redis://localhost:6379/15';
  process.env.JWT_ACCESS_SECRET ??= `test-secret-${'a'.repeat(32)}`;
  process.env.JWT_ACCESS_TTL_SECONDS ??= '900';
  process.env.JWT_REFRESH_TTL_SECONDS ??= '2592000';
  process.env.GOOGLE_OAUTH_CLIENT_IDS ??= 'test.apps.googleusercontent.com';
  process.env.APPLE_OAUTH_CLIENT_IDS ??= 'app.rapih.ios';
  process.env.R2_ACCOUNT_ID ??= 'test-account';
  process.env.R2_ACCESS_KEY_ID ??= 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY ??= 'test-secret-key';
  process.env.R2_BUCKET ??= 'rapih-receipts-test';
  process.env.R2_ENDPOINT ??= 'https://mock-r2.local';
}
