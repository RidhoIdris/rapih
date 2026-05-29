import { type FetchFn, type PushMessage, sendPushes } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';
import { addDays, startOfJakartaDay, ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

function formatRupiah(cents: bigint): string {
  return new Intl.NumberFormat('id-ID').format(Number(cents));
}

/**
 * Runs daily 09:00 WIB.
 *   - Recurring H-1: push reminder for tomorrow's bills.
 *   - Goal H-7 + H-1: nudge based on deadline.
 */
export async function runDuePush(
  now: Date = new Date(),
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const today = startOfJakartaDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const inSeven = addDays(today, 7);

  const queue: PushMessage[] = [];
  let skipped = 0;

  // ── Recurring H-1 ───────────────────────────────────────────────────
  const recurringDue = await prisma.recurringTransaction.findMany({
    where: {
      next_due_date: { gte: tomorrow, lt: dayAfterTomorrow },
      deleted_at: null,
    },
    include: { user: { include: { device_tokens: true } } },
  });
  for (const r of recurringDue) {
    // Finite installment already fully paid → no reminder.
    if (r.total_occurrences != null && r.occurrences_paid >= r.total_occurrences) {
      skipped++;
      continue;
    }
    if (r.user.device_tokens.length === 0) {
      skipped++;
      continue;
    }
    const key = `push:recurring-due:${ymdUtc(today)}:${r.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }
    const title = `${r.name} jatuh tempo besok`;
    const body = `Bayar Rp ${formatRupiah(r.amount)} besok`;
    const notifId = await writeNotification(prisma, {
      user_id: r.user_id,
      kind: 'recurring_due',
      title,
      body,
      data: { kind: 'recurring_due', recurring_id: r.id },
    });
    for (const t of r.user.device_tokens) {
      queue.push({
        to: t.token,
        title,
        body,
        data: { kind: 'recurring_due', recurring_id: r.id, notification_id: notifId },
      });
    }
  }

  // ── Goals: deadline = today+7 or today+1 ────────────────────────────
  const goalRanges: Array<['H7' | 'H1', Date, Date]> = [
    ['H7', inSeven, addDays(inSeven, 1)],
    ['H1', tomorrow, dayAfterTomorrow],
  ];

  for (const [marker, start, end] of goalRanges) {
    const goals = await prisma.goal.findMany({
      where: { deadline: { gte: start, lt: end }, deleted_at: null },
      include: { user: { include: { device_tokens: true } } },
    });
    for (const g of goals) {
      if (g.user.device_tokens.length === 0) {
        skipped++;
        continue;
      }
      const key = `push:goal-due:${ymdUtc(today)}:${g.id}:${marker}`;
      if (!(await claim(key, TTL))) {
        skipped++;
        continue;
      }
      const gap = g.target_amount - g.saved_amount;
      const title = marker === 'H7' ? `Goal ${g.name} tinggal 7 hari` : `Goal ${g.name} besok!`;
      const body = `Tersisa Rp ${formatRupiah(gap > 0n ? gap : 0n)} dari target`;
      const notifId = await writeNotification(prisma, {
        user_id: g.user_id,
        kind: 'goal_deadline',
        title,
        body,
        data: { kind: 'goal_deadline', goal_id: g.id, marker },
      });
      for (const t of g.user.device_tokens) {
        queue.push({
          to: t.token,
          title,
          body,
          data: { kind: 'goal_deadline', goal_id: g.id, marker, notification_id: notifId },
        });
      }
    }
  }

  // ── Send + handle DeviceNotRegistered ────────────────────────────────
  const result = await sendPushes(queue, fetchImpl);
  if (result.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: result.removeTokens } } });
  }

  logger.info(
    { pushed: result.ok.length, skipped, removed: result.removeTokens.length },
    'due-push complete'
  );
  return { pushed: result.ok.length, skipped, removed: result.removeTokens.length };
}
