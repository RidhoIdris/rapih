import { type Job, Worker } from 'bullmq';
import { runDuePush } from './jobs/due-push.js';
import { handleReceiptsFailedPush } from './jobs/receipts-failed-push.js';
import { handleReceiptsReadyPush } from './jobs/receipts-ready-push.js';
import { runRecurringCreate } from './jobs/recurring-create.js';
import { runStreakNudge } from './jobs/streak-nudge.js';
import { runWeeklyReview } from './jobs/weekly-review.js';
import { logger } from './lib/logger.js';
import { getRedis } from './lib/redis.js';

async function dispatch(job: Job): Promise<unknown> {
  logger.info({ job: job.name, id: job.id }, 'dispatch');
  switch (job.name) {
    case 'recurring-create':
      return runRecurringCreate();
    case 'due-push':
      return runDuePush();
    case 'streak-nudge':
      return runStreakNudge();
    case 'weekly-review':
      return runWeeklyReview();
    case 'receipts.ready-push':
      return handleReceiptsReadyPush(job);
    case 'receipts.failed-push':
      return handleReceiptsFailedPush(job);
    default:
      logger.warn({ job: job.name }, 'unknown job name');
      return null;
  }
}

let cached: Worker | undefined;

export function startWorker(): Worker {
  if (!cached) {
    cached = new Worker('reminder', dispatch, { connection: getRedis(), concurrency: 1 });
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
