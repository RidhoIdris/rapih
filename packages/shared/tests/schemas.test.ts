import { describe, expect, it } from 'vitest';
import {
    AppleSignInBody,
    AuthSessionResponse,
    GoogleSignInBody,
    LogoutBody,
    MeResponse,
    OnboardingBody,
    RefreshBody,
    UserDto,
} from '../src/auth/schemas.js';

describe('auth schemas', () => {
  it('GoogleSignInBody requires id_token', () => {
    expect(GoogleSignInBody.safeParse({ id_token: 'abc' }).success).toBe(true);
    expect(GoogleSignInBody.safeParse({}).success).toBe(false);
    expect(GoogleSignInBody.safeParse({ id_token: '' }).success).toBe(false);
  });

  it('AppleSignInBody requires id_token, optional name', () => {
    expect(AppleSignInBody.safeParse({ id_token: 'abc' }).success).toBe(true);
    expect(
      AppleSignInBody.safeParse({
        id_token: 'abc',
        name: { firstName: 'Ridho', lastName: 'Idris' },
      }).success,
    ).toBe(true);
    expect(
      AppleSignInBody.safeParse({ id_token: 'abc', name: { firstName: 'R' } }).success,
    ).toBe(true);
  });

  it('RefreshBody and LogoutBody require refresh_token', () => {
    expect(RefreshBody.safeParse({ refresh_token: 'abc' }).success).toBe(true);
    expect(RefreshBody.safeParse({}).success).toBe(false);
    expect(LogoutBody.safeParse({ refresh_token: 'abc' }).success).toBe(true);
  });

  it('OnboardingBody requires nickname (1-30) + income + goal', () => {
    expect(
      OnboardingBody.safeParse({
        nickname: 'Ridho',
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(true);
    expect(
      OnboardingBody.safeParse({
        nickname: '',
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
    expect(
      OnboardingBody.safeParse({
        nickname: 'x'.repeat(31),
        income_range: 'r7to15',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
    expect(
      OnboardingBody.safeParse({
        nickname: 'Ridho',
        income_range: 'bogus',
        primary_goal: 'save',
      }).success,
    ).toBe(false);
  });

  it('UserDto + MeResponse + AuthSessionResponse parse a full payload', () => {
    const userDto = {
      id: 'clx_user',
      email: 'r@example.com',
      name: 'Ridho',
      tier: 'free' as const,
      email_verified_at: new Date().toISOString(),
      onboarding_completed_at: null,
      profile: null,
      created_at: new Date().toISOString(),
    };
    expect(UserDto.safeParse(userDto).success).toBe(true);
    expect(MeResponse.safeParse({ ok: true, data: { user: userDto } }).success).toBe(true);
    expect(
      AuthSessionResponse.safeParse({
        ok: true,
        data: {
          access_token: 'jwt',
          refresh_token: 'r'.repeat(64),
          user: userDto,
        },
      }).success,
    ).toBe(true);
  });
});
