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

const HexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex color');

export const RecurringPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export type RecurringPeriod = z.infer<typeof RecurringPeriodSchema>;

export const RecurringKindSchema = z.enum(['expense', 'income']);
export type RecurringKind = z.infer<typeof RecurringKindSchema>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateRecurringBody = z.object({
  name: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(60),
  color: HexColor,
  kind: RecurringKindSchema,
  wallet_id: z.string().min(1),
  category_id: z.string().min(1).nullable().optional(),
  amount: MoneyString,
  note: z.string().trim().max(500).nullable().optional(),
  period: RecurringPeriodSchema,
  next_due_date: z.string().datetime({ offset: true }),
  /** Set = finite installment ("cicilan"); omit/null = open-ended recurring. */
  total_occurrences: z.number().int().positive().nullable().optional(),
  /** How many installments already paid before this bill was added. */
  occurrences_paid: z.number().int().min(0).optional(),
});
export type CreateRecurringBody = z.infer<typeof CreateRecurringBody>;

export const UpdateRecurringBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    icon: z.string().trim().min(1).max(60).optional(),
    color: HexColor.optional(),
    wallet_id: z.string().min(1).optional(),
    category_id: z.string().min(1).nullable().optional(),
    amount: MoneyString.optional(),
    note: z.string().trim().max(500).nullable().optional(),
    period: RecurringPeriodSchema.optional(),
    next_due_date: z.string().datetime({ offset: true }).optional(),
    total_occurrences: z.number().int().positive().nullable().optional(),
    occurrences_paid: z.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateRecurringBody = z.infer<typeof UpdateRecurringBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const RecurringDto = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  kind: RecurringKindSchema,
  wallet_id: z.string(),
  category_id: z.string().nullable(),
  amount: z.string(),
  note: z.string().nullable(),
  period: RecurringPeriodSchema,
  next_due_date: z.string(),
  last_paid_at: z.string().nullable(),
  /** Total installments for a finite "cicilan"; null for open-ended recurring. */
  total_occurrences: z.number().int().nullable(),
  occurrences_paid: z.number().int(),
  /** True once a finite installment has been fully paid off. */
  is_complete: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecurringDto = z.infer<typeof RecurringDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const RecurringResponse = z.object({
  ok: z.literal(true),
  data: z.object({ recurring: RecurringDto }),
});
export type RecurringResponse = z.infer<typeof RecurringResponse>;

export const RecurringListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ recurring: z.array(RecurringDto) }),
});
export type RecurringListResponse = z.infer<typeof RecurringListResponse>;
