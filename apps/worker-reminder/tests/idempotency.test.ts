import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import { claim } from '../src/lib/idempotency.js';
import { closeTestRedis, flushTestRedis, getTestRedis } from './helpers/test-redis.js';

describe('idempotency.claim', () => {
  beforeEach(async () => {
    await flushTestRedis();
  });
  afterAll(async () => {
    await closeTestRedis();
  });

  it('returns true on first claim', async () => {
    expect(await claim('foo:1', 60)).toBe(true);
  });

  it('returns false on second claim of same key', async () => {
    await claim('foo:2', 60);
    expect(await claim('foo:2', 60)).toBe(false);
  });

  it('different keys do not collide', async () => {
    expect(await claim('foo:3', 60)).toBe(true);
    expect(await claim('foo:4', 60)).toBe(true);
  });

  it('sets TTL on the claimed key', async () => {
    await claim('foo:5', 120);
    const ttl = await getTestRedis().ttl('foo:5');
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);
  });
});
