import { z } from 'zod';
import { ReceiptScanSourceSchema, ReceiptScanStatusSchema } from './enums.js';
import { ReceiptOcrResult } from './ocr.js';

export const MoneyString = z
  .string()
  .regex(/^\d+$/, 'must be a positive integer string')
  .refine((s) => {
    try {
      return BigInt(s) > 0n;
    } catch {
      return false;
    }
  }, 'must be greater than 0');

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const ReceiptScanDto = z.object({
  id: z.string(),
  status: ReceiptScanStatusSchema,
  source: ReceiptScanSourceSchema,
  content_type: z.string(),
  size_bytes: z.number().int(),
  ocr_result: ReceiptOcrResult.nullable(),
  failed_reason: z.string().nullable(),
  consumed_at: z.string().nullable(),
  created_at: z.string(),
});
export type ReceiptScanDto = z.infer<typeof ReceiptScanDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateScanBody = z.object({
  source: ReceiptScanSourceSchema,
  content_type: z.string(),
  size_bytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});
export type CreateScanBody = z.infer<typeof CreateScanBody>;

export const ConsumeBodyPerItem = z.object({
  mode: z.literal('per_item'),
  wallet_id: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: MoneyString,
        category_id: z.string().min(1),
        transacted_at: z.string().datetime({ offset: true }),
        note: z.string().max(500).optional(),
      })
    )
    .min(1),
});
export type ConsumeBodyPerItem = z.infer<typeof ConsumeBodyPerItem>;

export const ConsumeBodyTotal = z.object({
  mode: z.literal('total'),
  wallet_id: z.string().min(1),
  category_id: z.string().min(1),
  amount: MoneyString,
  transacted_at: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
  merchant: z.string().max(200).optional(),
});
export type ConsumeBodyTotal = z.infer<typeof ConsumeBodyTotal>;

export const ConsumeBody = z.discriminatedUnion('mode', [ConsumeBodyPerItem, ConsumeBodyTotal]);
export type ConsumeBody = z.infer<typeof ConsumeBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const CreateScanResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    scan: ReceiptScanDto,
    upload: z.object({
      url: z.string().url(),
      headers: z.record(z.string(), z.string()),
    }),
  }),
});
export type CreateScanResponse = z.infer<typeof CreateScanResponse>;

export const FinalizeScanResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scan: ReceiptScanDto }),
});
export type FinalizeScanResponse = z.infer<typeof FinalizeScanResponse>;

export const ListScansResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scans: z.array(ReceiptScanDto) }),
});
export type ListScansResponse = z.infer<typeof ListScansResponse>;

export const ScanDetailResponse = z.object({
  ok: z.literal(true),
  data: z.object({ scan: ReceiptScanDto, image_url: z.string().url() }),
});
export type ScanDetailResponse = z.infer<typeof ScanDetailResponse>;

export const ConsumeResponse = z.object({
  ok: z.literal(true),
  data: z.object({ transaction_ids: z.array(z.string()) }),
});
export type ConsumeResponse = z.infer<typeof ConsumeResponse>;

export const DeleteScanResponse = z.object({
  ok: z.literal(true),
});
export type DeleteScanResponse = z.infer<typeof DeleteScanResponse>;
