import { z } from 'zod';
import { IncomeRangeSchema, PrimaryGoalSchema, UserTierSchema } from './enums.js';

// ─── Request bodies ───────────────────────────────────────────────────────

export const GoogleSignInBody = z.object({
  id_token: z.string().min(1),
});
export type GoogleSignInBody = z.infer<typeof GoogleSignInBody>;

export const AppleSignInBody = z.object({
  id_token: z.string().min(1),
  name: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBody>;

export const RefreshBody = z.object({ refresh_token: z.string().min(1) });
export type RefreshBody = z.infer<typeof RefreshBody>;

export const LogoutBody = z.object({ refresh_token: z.string().min(1) });
export type LogoutBody = z.infer<typeof LogoutBody>;

export const OnboardingBody = z.object({
  nickname: z.string().trim().min(1).max(30),
  income_range: IncomeRangeSchema,
  primary_goal: PrimaryGoalSchema,
});
export type OnboardingBody = z.infer<typeof OnboardingBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const UserProfileDto = z.object({
  nickname: z.string().nullable(),
  income_range: IncomeRangeSchema.nullable(),
  primary_goal: PrimaryGoalSchema.nullable(),
});
export type UserProfileDto = z.infer<typeof UserProfileDto>;

export const UserDto = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  tier: UserTierSchema,
  email_verified_at: z.string().nullable(),
  onboarding_completed_at: z.string().nullable(),
  profile: UserProfileDto.nullable(),
  created_at: z.string(),
});
export type UserDto = z.infer<typeof UserDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const AuthSessionResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    user: UserDto,
  }),
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponse>;

export const RefreshResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const MeResponse = z.object({
  ok: z.literal(true),
  data: z.object({ user: UserDto }),
});
export type MeResponse = z.infer<typeof MeResponse>;
