import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let cached: Queue | undefined;

/**
 * Producer-only handle to the AI worker queue. Worker-reminder enqueues
 * weekly-review-gen jobs here; the future ai-worker will consume.
 */
export function getAiQueue(): Queue {
  if (!cached) {
    cached = new Queue('ai', { connection: getRedis() });
  }
  return cached;
}

export async function closeAiQueue(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
