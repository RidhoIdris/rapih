import { z } from 'zod';

export const NotificationKindSchema = z.enum([
  'recurring_due',
  'goal_deadline',
  'streak_nudge',
  'weekly_review',
  'receipt_ready',
  'receipt_failed',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
