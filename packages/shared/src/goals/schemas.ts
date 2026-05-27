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

const MoneyStringNonNegative = z
  .string()
  .regex(/^\d+$/, 'must be a non-negative integer string (cents)')
  .refine((s) => {
    try {
      BigInt(s);
      return true;
    } catch {
      return false;
    }
  }, 'must be parseable as BigInt');

const HexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex color');

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateGoalBody = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(60),
  color: HexColor,
  target_amount: MoneyString,
  saved_amount: MoneyStringNonNegative.optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  wallet_id: z.string().min(1).nullable().optional(),
});
export type CreateGoalBody = z.infer<typeof CreateGoalBody>;

export const UpdateGoalBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    icon: z.string().trim().min(1).max(60).optional(),
    color: HexColor.optional(),
    target_amount: MoneyString.optional(),
    saved_amount: MoneyStringNonNegative.optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    wallet_id: z.string().min(1).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateGoalBody = z.infer<typeof UpdateGoalBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const GoalDto = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  target_amount: z.string(),
  saved_amount: z.string(),
  /** Fraction 0–1 of saved_amount / target_amount. Capped at 1. */
  progress: z.number(),
  deadline: z.string().nullable(),
  wallet_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type GoalDto = z.infer<typeof GoalDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const GoalResponse = z.object({
  ok: z.literal(true),
  data: z.object({ goal: GoalDto }),
});
export type GoalResponse = z.infer<typeof GoalResponse>;

export const GoalListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ goals: z.array(GoalDto) }),
});
export type GoalListResponse = z.infer<typeof GoalListResponse>;
