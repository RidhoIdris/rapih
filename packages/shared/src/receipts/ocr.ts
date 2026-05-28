import { z } from 'zod';

export const ReceiptOcrItem = z.object({
  name: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
});
export type ReceiptOcrItem = z.infer<typeof ReceiptOcrItem>;

export const ReceiptOcrResult = z.object({
  merchant: z.string().nullable(),
  transacted_at: z.string().nullable(),
  subtotal: z.number().int().nullable(),
  tax: z.number().int().nullable(),
  service_charge: z.number().int().nullable(),
  discount: z.number().int().nullable(),
  total: z.number().int().nonnegative(),
  currency: z.literal('IDR'),
  items: z.array(ReceiptOcrItem),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type ReceiptOcrResult = z.infer<typeof ReceiptOcrResult>;
