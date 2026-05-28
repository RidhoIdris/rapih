import { z } from 'zod';
import { NotificationKindSchema } from './enums.js';

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const NotificationDto = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});
export type NotificationDto = z.infer<typeof NotificationDto>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const MarkReadBody = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkReadBody = z.infer<typeof MarkReadBody>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const NotificationListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ notifications: z.array(NotificationDto) }),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponse>;

export const MarkReadResponse = z.object({
  ok: z.literal(true),
  data: z.object({ updated: z.number().int().nonnegative() }),
});
export type MarkReadResponse = z.infer<typeof MarkReadResponse>;
