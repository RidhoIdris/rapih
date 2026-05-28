import { z } from 'zod';

const MoneyString = z
  .string()
  .regex(/^\d+$/, 'must be a positive integer string (cents)')
  .refine((s) => {
    try {
      return BigInt(s) > 0n;
    } catch {
      return false;
    }
  }, 'must be greater than 0');

const HexColor = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex color');

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateBudgetBody = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(60),
  color: HexColor,
  amount: MoneyString,
  /** IDs of categories to track. Empty array = catch-all (all expenses). */
  category_ids: z.array(z.string().min(1)),
});
export type CreateBudgetBody = z.infer<typeof CreateBudgetBody>;

export const UpdateBudgetBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    icon: z.string().trim().min(1).max(60).optional(),
    color: HexColor.optional(),
    amount: MoneyString.optional(),
    category_ids: z.array(z.string().min(1)).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateBudgetBody = z.infer<typeof UpdateBudgetBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const BudgetDto = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  amount: z.string(),
  category_ids: z.array(z.string()),
  /** Σ expense transactions for the current calendar month in this budget's categories. */
  spent: z.string(),
  /** amount − spent (negative if overspent). */
  remaining: z.string(),
  /** Fraction 0–1 of spent / amount. Capped at 1. */
  progress: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BudgetDto = z.infer<typeof BudgetDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const BudgetResponse = z.object({
  ok: z.literal(true),
  data: z.object({ budget: BudgetDto }),
});
export type BudgetResponse = z.infer<typeof BudgetResponse>;

export const BudgetListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ budgets: z.array(BudgetDto) }),
});
export type BudgetListResponse = z.infer<typeof BudgetListResponse>;
