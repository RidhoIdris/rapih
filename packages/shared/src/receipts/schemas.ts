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

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const ReceiptDto = z.object({
  id: z.string(),
  image_url: z.string().nullable(),
  merchant_name: z.string().nullable(),
  total_amount: z.string().nullable(),
  scanned_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ReceiptDto = z.infer<typeof ReceiptDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

/** Used for PATCH (JSON). Create uses multipart/form-data handled server-side. */
export const UpdateReceiptBody = z
  .object({
    merchant_name: z.string().trim().min(1).max(200).nullable().optional(),
    total_amount: MoneyString.optional(),
    scanned_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateReceiptBody = z.infer<typeof UpdateReceiptBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const ReceiptResponse = z.object({
  ok: z.literal(true),
  data: z.object({ receipt: ReceiptDto }),
});
export type ReceiptResponse = z.infer<typeof ReceiptResponse>;

export const ReceiptListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ receipts: z.array(ReceiptDto) }),
});
export type ReceiptListResponse = z.infer<typeof ReceiptListResponse>;
