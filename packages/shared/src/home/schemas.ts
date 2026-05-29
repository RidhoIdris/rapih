import { z } from 'zod';
import { TransactionKindSchema } from '../transactions/enums.js';

// ─── Pieces ─────────────────────────────────────────────────────────────────

export const HomeTopCategory = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  /** Σ expense for this category this month (rupiah string). */
  amount: z.string(),
  /** Fraction 0–1 of this category over total month expense. */
  pct: z.number(),
});
export type HomeTopCategory = z.infer<typeof HomeTopCategory>;

export const HomeRecentTx = z.object({
  id: z.string(),
  title: z.string(),
  kind: TransactionKindSchema,
  category_name: z.string().nullable(),
  wallet_name: z.string().nullable(),
  amount: z.string(),
  transacted_at: z.string(),
});
export type HomeRecentTx = z.infer<typeof HomeRecentTx>;

export const HomeMonth = z.object({
  expense: z.string(),
  income: z.string(),
  /** income − expense (may be negative). */
  net: z.string(),
  /** (income − expense) / income, clamped 0–1. 0 when no income. */
  savings_rate: z.number(),
  days_elapsed: z.number(),
  days_in_month: z.number(),
  avg_per_day: z.string(),
  /** avg_per_day × days_in_month. */
  projection: z.string(),
  /** Per-day expense for the current month, length = days_in_month. */
  daily_expense: z.array(z.string()),
  last_month_expense: z.string(),
  /** (expense − last_month_expense) / last_month_expense. null when no last-month data. */
  delta_pct: z.number().nullable(),
});
export type HomeMonth = z.infer<typeof HomeMonth>;

// ─── Summary ──────────────────────────────────────────────────────────────

export const HomeSummary = z.object({
  /** New-user empty state is driven by wallet_count === 0. */
  wallet_count: z.number(),
  transaction_count: z.number(),
  total_balance: z.string(),
  month: HomeMonth,
  /** Σ active budget plafonds; 0 when none. */
  budget_cap: z.string(),
  top_categories: z.array(HomeTopCategory),
  bills: z.object({
    count: z.number(),
    total: z.string(),
    /** Days until the soonest upcoming bill; null when none. */
    next_due_days: z.number().nullable(),
    icons: z.array(z.string()),
  }),
  goals: z.object({
    active_count: z.number(),
    total_saved: z.string(),
    progresses: z.array(z.number()),
  }),
  recent_transactions: z.array(HomeRecentTx),
});
export type HomeSummary = z.infer<typeof HomeSummary>;

export const HomeResponse = z.object({
  ok: z.literal(true),
  data: z.object({ home: HomeSummary }),
});
export type HomeResponse = z.infer<typeof HomeResponse>;
