import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

let cached: Redis | undefined;

export function getRedis(): Redis {
  if (!cached) {
    const env = loadEnv();
    cached = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return cached;
}

export async function closeRedis(): Promise<void> {
  if (cached) {
    await cached.quit();
    cached = undefined;
  }
}
