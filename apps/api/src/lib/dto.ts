import type { User, UserProfile } from '@rapih/db';
import type { UserDto, UserProfileDto } from '@rapih/shared';

export function userProfileToDto(p: UserProfile | null | undefined): UserProfileDto | null {
  if (!p) return null;
  return {
    nickname: p.nickname ?? null,
    income_range: p.income_range ?? null,
    primary_goal: p.primary_goal ?? null,
  };
}

export function userToDto(user: User & { profile?: UserProfile | null }): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    email_verified_at: user.email_verified_at?.toISOString() ?? null,
    onboarding_completed_at: user.onboarding_completed_at?.toISOString() ?? null,
    profile: userProfileToDto(user.profile),
    created_at: user.created_at.toISOString(),
  };
}
