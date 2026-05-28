import { getRedis } from './redis.js';

/**
 * Claim a one-shot idempotency key. Returns true if claimed (caller may proceed),
 * false if already claimed (caller should skip).
 *
 * Uses Redis `SET key value EX ttl NX` — atomic check-and-set.
 */
export async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}
