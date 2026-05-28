import { type Job, Worker } from 'bullmq';
import { logger } from './lib/logger.js';
import { getRedis } from './lib/redis.js';

export type JobHandler = (job: Job) => Promise<unknown>;

let cached: Worker | undefined;
const handlers: Record<string, JobHandler> = {};

export function registerHandler(name: string, handler: JobHandler): void {
  handlers[name] = handler;
}

async function dispatch(job: Job): Promise<unknown> {
  logger.info({ job: job.name, id: job.id }, 'dispatch');
  const handler = handlers[job.name];
  if (!handler) {
    logger.warn({ job: job.name }, 'no handler registered');
    return null;
  }
  return handler(job);
}

export function startWorker(): Worker {
  if (!cached) {
    cached = new Worker('ai', dispatch, { connection: getRedis(), concurrency: 1 });
    cached.on('failed', (job, err) => {
      logger.error({ err, job: job?.name, id: job?.id }, 'job failed');
    });
    cached.on('completed', (job) => {
      logger.debug({ job: job.name, id: job.id }, 'job completed');
    });
  }
  return cached;
}

export async function stopWorker(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = undefined;
  }
}
