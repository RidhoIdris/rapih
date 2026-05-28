import type { RecurringPeriod } from './schemas.js';

/**
 * Advance a recurring due-date by one period.
 * Used by both the API (mark-as-paid endpoint) and worker-reminder (cron auto-create).
 */
export function advanceDueDate(current: Date, period: RecurringPeriod): Date {
  const d = new Date(current);
  if (period === 'daily') d.setDate(d.getDate() + 1);
  else if (period === 'weekly') d.setDate(d.getDate() + 7);
  else if (period === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (period === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}
