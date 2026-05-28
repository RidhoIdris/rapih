import { Queue } from 'bullmq';
import { getRedis } from '../lib/redis.js';

let cached: Queue | undefined;

export function getReminderQueue(): Queue {
  if (!cached) {
    cached = new Queue('reminder', { connection: getRedis() });
  }
  return cached;
}

export async function closeReminderQueue(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
