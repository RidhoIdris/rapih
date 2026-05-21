import { z } from 'zod';

export const SocialProviderSchema = z.enum(['google', 'apple']);
export type SocialProvider = z.infer<typeof SocialProviderSchema>;

export const UserTierSchema = z.enum(['free', 'plus', 'pro']);
export type UserTier = z.infer<typeof UserTierSchema>;

/**
 * IncomeRange uses `r3to7` etc. instead of `3to7` because Prisma enum
 * values cannot start with a digit. Mobile sends the `r`-prefixed form.
 */
export const IncomeRangeSchema = z.enum([
  'lt3',
  'r3to7',
  'r7to15',
  'r15to30',
  'gt30',
  'variable',
]);
export type IncomeRange = z.infer<typeof IncomeRangeSchema>;

export const PrimaryGoalSchema = z.enum([
  'save',
  'track',
  'goal',
  'invest',
  'debt',
  'bills',
]);
export type PrimaryGoal = z.infer<typeof PrimaryGoalSchema>;

export const incomeRangeLabel: Record<IncomeRange, string> = {
  lt3: '< Rp 3jt',
  r3to7: 'Rp 3 – 7jt',
  r7to15: 'Rp 7 – 15jt',
  r15to30: 'Rp 15 – 30jt',
  gt30: '> Rp 30jt',
  variable: 'Belum tetap',
};

export const primaryGoalLabel: Record<PrimaryGoal, string> = {
  save: 'Mulai nabung',
  track: 'Catat pengeluaran',
  goal: 'Wujudkan goal',
  invest: 'Mulai investasi',
  debt: 'Lunasi utang',
  bills: 'Atur tagihan rutin',
};
