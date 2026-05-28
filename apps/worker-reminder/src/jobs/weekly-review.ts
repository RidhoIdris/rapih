import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { getPrisma } from '../lib/prisma.js';
import { isoWeek } from '../lib/time.js';
import { getAiQueue } from '../queues/ai.js';

const TTL = 7 * 24 * 3600;
const LOOKBACK_DAYS = 30;

/**
 * Runs Sunday 22:00 WIB. For each Pro user with >=1 transaction in the last
 * 30 days, enqueue an ai.weekly-review-gen job. The future ai-worker will
 * consume, generate review content, and push.
 */
export async function runWeeklyReview(now: Date = new Date()): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const prisma = getPrisma();
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
  const week = isoWeek(now);

  const eligible = await prisma.user.findMany({
    where: {
      tier: 'pro',
      onboarding_completed_at: { not: null },
      transactions: { some: { transacted_at: { gte: cutoff }, deleted_at: null } },
    },
  });

  const queue = getAiQueue();
  let enqueued = 0;
  let skipped = 0;
  for (const u of eligible) {
    const key = `weekly-review-enqueue:${week}:${u.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    await queue.add('weekly-review-gen', { user_id: u.id, week });
    enqueued++;
  }

  logger.info({ enqueued, skipped, total: eligible.length }, 'weekly-review complete');
  return { enqueued, skipped };
}
