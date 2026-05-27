import { z } from 'zod';
import { WalletKindSchema } from './enums.js';

// Money is sent as numeric string to preserve BigInt precision across JSON.
const MoneyString = z
  .string()
  .regex(/^-?\d+$/, 'must be an integer string (cents)')
  .refine((s) => {
    try {
      BigInt(s);
      return true;
    } catch {
      return false;
    }
  }, 'must be parseable as BigInt');

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateWalletBody = z.object({
  kind: WalletKindSchema,
  provider_name: z.string().trim().min(1).max(60),
  label: z.string().trim().max(60).nullable().optional(),
  initial_balance: MoneyString,
});
export type CreateWalletBody = z.infer<typeof CreateWalletBody>;

export const UpdateWalletBody = z
  .object({
    kind: WalletKindSchema.optional(),
    provider_name: z.string().trim().min(1).max(60).optional(),
    label: z.string().trim().max(60).nullable().optional(),
    initial_balance: MoneyString.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateWalletBody = z.infer<typeof UpdateWalletBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const WalletDto = z.object({
  id: z.string(),
  kind: WalletKindSchema,
  provider_name: z.string(),
  label: z.string().nullable(),
  initial_balance: z.string(),
  balance: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WalletDto = z.infer<typeof WalletDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const WalletResponse = z.object({
  ok: z.literal(true),
  data: z.object({ wallet: WalletDto }),
});
export type WalletResponse = z.infer<typeof WalletResponse>;

export const WalletListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ wallets: z.array(WalletDto) }),
});
export type WalletListResponse = z.infer<typeof WalletListResponse>;
