import { z } from 'zod';
import { TransactionKindSchema } from './enums.js';

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

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateTransactionBody = z
  .object({
    kind: TransactionKindSchema,
    wallet_id: z.string().min(1),
    to_wallet_id: z.string().min(1).optional(),
    category_id: z.string().min(1).nullable().optional(),
    receipt_id: z.string().min(1).nullable().optional(),
    amount: MoneyString,
    note: z.string().trim().max(500).nullable().optional(),
    transacted_at: z.string().datetime({ offset: true }),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'transfer' && !data.to_wallet_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'required when kind is transfer',
      });
    }
    if (data.kind !== 'transfer' && data.to_wallet_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'only valid when kind is transfer',
      });
    }
  });
export type CreateTransactionBody = z.infer<typeof CreateTransactionBody>;

export const UpdateTransactionBody = z
  .object({
    kind: TransactionKindSchema.optional(),
    wallet_id: z.string().min(1).optional(),
    to_wallet_id: z.string().min(1).nullable().optional(),
    category_id: z.string().min(1).nullable().optional(),
    receipt_id: z.string().min(1).nullable().optional(),
    amount: MoneyString.optional(),
    note: z.string().trim().max(500).nullable().optional(),
    transacted_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' })
  .superRefine((data, ctx) => {
    // Only validate transfer consistency when kind is explicitly being changed
    if (data.kind === 'transfer' && data.to_wallet_id === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'required when kind is transfer',
      });
    }
    if (data.kind !== undefined && data.kind !== 'transfer' && data.to_wallet_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'only valid when kind is transfer',
      });
    }
  });
export type UpdateTransactionBody = z.infer<typeof UpdateTransactionBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const TransactionDto = z.object({
  id: z.string(),
  kind: TransactionKindSchema,
  wallet_id: z.string(),
  to_wallet_id: z.string().nullable(),
  category_id: z.string().nullable(),
  receipt_id: z.string().nullable(),
  amount: z.string(),
  note: z.string().nullable(),
  transacted_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TransactionDto = z.infer<typeof TransactionDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const TransactionResponse = z.object({
  ok: z.literal(true),
  data: z.object({ transaction: TransactionDto }),
});
export type TransactionResponse = z.infer<typeof TransactionResponse>;

export const TransactionListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ transactions: z.array(TransactionDto) }),
});
export type TransactionListResponse = z.infer<typeof TransactionListResponse>;
