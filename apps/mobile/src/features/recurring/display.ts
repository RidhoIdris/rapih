import { advanceDueDate, type RecurringDto, type RecurringPeriod } from '@rapih/shared';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY_MS = 86_400_000;

export const periodLabel: Record<RecurringPeriod, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

export const periodSuffix: Record<RecurringPeriod, string> = {
  daily: '/hari',
  weekly: '/minggu',
  monthly: '/bulan',
  yearly: '/tahun',
};

/** Order sections render in. */
export const PERIOD_ORDER: RecurringPeriod[] = ['monthly', 'weekly', 'yearly', 'daily'];

export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Day-of-month of the next due date, e.g. for the "tgl 25" hint. */
export function dueDay(iso: string): number {
  return new Date(iso).getDate();
}

// ─── Installment ("cicilan") helpers ────────────────────────────────────────

export function isInstallment(r: RecurringDto): boolean {
  return r.total_occurrences != null;
}

/** 1-based number of the installment currently due (capped at total). */
export function currentInstallment(r: RecurringDto): number {
  if (r.total_occurrences == null) return 0;
  return Math.min(r.occurrences_paid + 1, r.total_occurrences);
}

export function remainingCount(r: RecurringDto): number {
  if (r.total_occurrences == null) return 0;
  return Math.max(0, r.total_occurrences - r.occurrences_paid);
}

export function installmentProgress(r: RecurringDto): number {
  if (!r.total_occurrences) return 0;
  return Math.min(1, r.occurrences_paid / r.total_occurrences);
}

/** Projected payoff date (the last installment's due date); null if open-ended. */
export function projectedPayoffISO(r: RecurringDto): string | null {
  if (r.total_occurrences == null) return null;
  const remaining = remainingCount(r);
  if (remaining <= 0) return r.next_due_date;
  let d = new Date(r.next_due_date);
  for (let i = 0; i < remaining - 1; i++) d = advanceDueDate(d, r.period);
  return d.toISOString();
}
