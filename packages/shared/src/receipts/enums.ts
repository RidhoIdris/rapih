import { z } from 'zod';

export const ReceiptScanStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'consumed',
  'failed',
]);
export type ReceiptScanStatus = z.infer<typeof ReceiptScanStatusSchema>;

export const ReceiptScanSourceSchema = z.enum(['in_app', 'share_intent']);
export type ReceiptScanSource = z.infer<typeof ReceiptScanSourceSchema>;

export const ReceiptConsumeModeSchema = z.enum(['per_item', 'total']);
export type ReceiptConsumeMode = z.infer<typeof ReceiptConsumeModeSchema>;
