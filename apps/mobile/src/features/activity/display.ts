import type { TransactionDto } from '@rapih/shared';

/** Indonesian short month names, indexed by Date.getMonth(). */
const MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

const DAY_MS = 86_400_000;

/** Signed display amount: income is positive, everything else drains a wallet. */
export function signedAmount(tx: TransactionDto): number {
  const n = Number(tx.amount);
  return tx.kind === 'income' ? n : -n;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Hari ini · 17 Mei" / "Kemarin · 16 Mei" / "12 Mei". */
export function dayHeader(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const that = startOfDay(d);
  const today = startOfDay(now);
  const label = `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
  if (that === today) return `Hari ini · ${label}`;
  if (that === today - DAY_MS) return `Kemarin · ${label}`;
  return label;
}

/** "09:14" — local 24h clock. */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "17 Mei 2026 · 09:14 WIB" — used in the detail hero. */
export function fullDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()} · ${timeLabel(iso)} WIB`;
}

export type TxGroup = { key: number; header: string; sum: number; items: TransactionDto[] };

/** Group transactions into day buckets, newest day first. */
export function groupByDay(items: TransactionDto[], now: Date = new Date()): TxGroup[] {
  const buckets = new Map<number, TransactionDto[]>();
  for (const tx of items) {
    const key = startOfDay(new Date(tx.transacted_at));
    const arr = buckets.get(key);
    if (arr) arr.push(tx);
    else buckets.set(key, [tx]);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([key, txs]) => ({
      key,
      header: dayHeader(new Date(key).toISOString(), now),
      sum: txs.reduce((acc, t) => acc + signedAmount(t), 0),
      items: txs,
    }));
}

/** Current-month totals for the summary card. */
export function monthSummary(
  items: TransactionDto[],
  now: Date = new Date(),
): { expense: number; income: number; count: number } {
  const month = now.getMonth();
  const year = now.getFullYear();
  let expense = 0;
  let income = 0;
  let count = 0;
  for (const tx of items) {
    const d = new Date(tx.transacted_at);
    if (d.getMonth() !== month || d.getFullYear() !== year) continue;
    count += 1;
    const n = Number(tx.amount);
    if (tx.kind === 'income') income += n;
    else if (tx.kind === 'expense') expense += n;
  }
  return { expense, income, count };
}
