import { type FetchFn, type PushMessage, sendPushes } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';
import { startOfJakartaDay, ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

/**
 * Runs daily 20:00 WIB. Pushes a "log a transaction" nudge to onboarded users
 * who have no transaction today. Skips users with zero device tokens.
 */
export async function runStreakNudge(
  now: Date = new Date(),
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const today = startOfJakartaDay(now);

  const candidates = await prisma.user.findMany({
    where: {
      onboarding_completed_at: { not: null },
      transactions: {
        none: { transacted_at: { gte: today }, deleted_at: null },
      },
    },
    include: { device_tokens: true },
  });

  const queue: PushMessage[] = [];
  let skipped = 0;
  for (const u of candidates) {
    if (u.device_tokens.length === 0) {
      skipped++;
      continue;
    }
    const key = `push:streak:${ymdUtc(today)}:${u.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    const notifId = await writeNotification(prisma, {
      user_id: u.id,
      kind: 'streak_nudge',
      title: 'Belum catat pengeluaran hari ini',
      body: 'Yuk catat satu hal — biar streak gak putus.',
      data: { kind: 'streak_nudge' },
    });
    for (const t of u.device_tokens) {
      queue.push({
        to: t.token,
        title: 'Belum catat pengeluaran hari ini',
        body: 'Yuk catat satu hal — biar streak gak putus.',
        data: { kind: 'streak_nudge', notification_id: notifId },
      });
    }
  }

  const result = await sendPushes(queue, fetchImpl);
  if (result.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: result.removeTokens } } });
  }

  logger.info(
    { pushed: result.ok.length, skipped, removed: result.removeTokens.length },
    'streak-nudge complete'
  );
  return { pushed: result.ok.length, skipped, removed: result.removeTokens.length };
}
