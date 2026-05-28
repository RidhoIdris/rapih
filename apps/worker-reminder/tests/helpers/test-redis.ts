import { Redis } from 'ioredis';

let cached: Redis | undefined;

export function getTestRedis(): Redis {
  if (!cached) {
    cached = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
  }
  return cached;
}

export async function flushTestRedis(): Promise<void> {
  await getTestRedis().flushdb();
}

export async function closeTestRedis(): Promise<void> {
  if (cached) {
    await cached.quit();
    cached = undefined;
  }
}
