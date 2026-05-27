import { setupTestDb, teardownTestDb } from './test-db.js';
import { setTestEnv } from './test-env.js';

export default async function globalSetup() {
  setTestEnv();
  try {
    await setupTestDb();
  } catch (err) {
    console.warn(
      '[vitest globalSetup] failed to set up test DB; DB-backed tests will fail. Reason:',
      err instanceof Error ? err.message : err
    );
    // Do not throw — tests that don't touch the DB should still run.
  }
  return async () => {
    await teardownTestDb();
  };
}
