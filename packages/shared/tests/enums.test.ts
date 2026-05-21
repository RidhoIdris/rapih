import { describe, expect, it } from 'vitest';
import {
  IncomeRangeSchema,
  incomeRangeLabel,
  PrimaryGoalSchema,
  primaryGoalLabel,
  SocialProviderSchema,
  UserTierSchema,
} from '../src/auth/enums.js';

describe('auth enums', () => {
  it('IncomeRangeSchema accepts every Prisma-compatible value', () => {
    for (const v of ['lt3', 'r3to7', 'r7to15', 'r15to30', 'gt30', 'variable']) {
      expect(IncomeRangeSchema.safeParse(v).success).toBe(true);
    }
  });

  it('IncomeRangeSchema rejects the legacy 3to7 value', () => {
    expect(IncomeRangeSchema.safeParse('3to7').success).toBe(false);
  });

  it('PrimaryGoalSchema accepts the six goal ids', () => {
    for (const v of ['save', 'track', 'goal', 'invest', 'debt', 'bills']) {
      expect(PrimaryGoalSchema.safeParse(v).success).toBe(true);
    }
  });

  it('SocialProviderSchema only accepts google / apple', () => {
    expect(SocialProviderSchema.safeParse('google').success).toBe(true);
    expect(SocialProviderSchema.safeParse('apple').success).toBe(true);
    expect(SocialProviderSchema.safeParse('facebook').success).toBe(false);
  });

  it('UserTierSchema accepts free / plus / pro', () => {
    for (const v of ['free', 'plus', 'pro']) {
      expect(UserTierSchema.safeParse(v).success).toBe(true);
    }
  });

  it('income/goal label maps cover every enum value', () => {
    for (const v of ['lt3', 'r3to7', 'r7to15', 'r15to30', 'gt30', 'variable'] as const) {
      expect(incomeRangeLabel[v]).toBeDefined();
    }
    for (const v of ['save', 'track', 'goal', 'invest', 'debt', 'bills'] as const) {
      expect(primaryGoalLabel[v]).toBeDefined();
    }
  });
});
