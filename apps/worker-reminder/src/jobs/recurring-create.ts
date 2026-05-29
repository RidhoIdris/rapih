import { advanceDueDate } from '@rapih/shared';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { getPrisma } from '../lib/prisma.js';
import { ymdUtc } from '../lib/time.js';

const TTL = 48 * 3600;

/**
 * Runs daily 00:05 WIB. For each recurring with next_due_date <= today,
 * creates the transaction and advances next_due_date by one period.
 * Idempotency: per recurring per day. Safe to re-run.
 */
export async function runRecurringCreate(now: Date = new Date()): Promise<{
  processed: number;
  skipped: number;
}> {
  const prisma = getPrisma();
  const due = await prisma.recurringTransaction.findMany({
    where: { next_due_date: { lte: now }, deleted_at: null },
  });

  let processed = 0;
  let skipped = 0;

  for (const r of due) {
    // Finite installment already fully paid → stop auto-creating.
    if (r.total_occurrences != null && r.occurrences_paid >= r.total_occurrences) {
      skipped++;
      continue;
    }

    const key = `recurring-create:${ymdUtc(now)}:${r.id}`;
    if (!(await claim(key, TTL))) {
      skipped++;
      continue;
    }

    const paidAfter = r.occurrences_paid + 1;
    const willComplete = r.total_occurrences != null && paidAfter >= r.total_occurrences;

    try {
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            user_id: r.user_id,
            kind: r.kind,
            wallet_id: r.wallet_id,
            category_id: r.category_id,
            amount: r.amount,
            note: r.note,
            transacted_at: r.next_due_date,
          },
        }),
        prisma.recurringTransaction.update({
          where: { id: r.id },
          data: {
            last_paid_at: now,
            // Don't roll past the final installment; the guard above skips it next run.
            next_due_date: willComplete
              ? r.next_due_date
              : advanceDueDate(r.next_due_date, r.period),
            occurrences_paid: paidAfter,
          },
        }),
      ]);
      processed++;
    } catch (err) {
      logger.error({ err, recurring_id: r.id }, 'recurring-create failed');
    }
  }

  logger.info({ processed, skipped, total: due.length }, 'recurring-create complete');
  return { processed, skipped };
}
