import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

let cachedRedis: Redis | undefined;

export function getTestRedis(): Redis {
  if (!cachedRedis) {
    cachedRedis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/15', {
      maxRetriesPerRequest: null,
    });
  }
  return cachedRedis;
}

export async function flushTestRedis(): Promise<void> {
  await getTestRedis().flushdb();
}

export function getTestAiQueue(): Queue {
  return new Queue('ai', { connection: getTestRedis() });
}

export async function teardownTestRedis(): Promise<void> {
  if (cachedRedis) {
    await cachedRedis.quit();
    cachedRedis = undefined;
  }
}
