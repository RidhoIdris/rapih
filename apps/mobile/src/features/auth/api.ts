import { apiRequest } from '@/lib/api';
import type {
    AuthSessionResponse,
    MeResponse,
    OnboardingBody,
    RefreshResponse,
    UserDto,
} from '@rapih/shared';

type SessionData = AuthSessionResponse['data'];
type MeData = MeResponse['data'];
type RefreshData = RefreshResponse['data'];

export async function signInWithGoogle(idToken: string): Promise<SessionData> {
  return apiRequest<SessionData>('/auth/google', {
    method: 'POST',
    body: { id_token: idToken },
    skipAuth: true,
  });
}

export async function refreshSession(refreshToken: string): Promise<RefreshData> {
  return apiRequest<RefreshData>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuth: true,
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuth: true,
  });
}

export async function getMe(): Promise<UserDto> {
  const data = await apiRequest<MeData>('/auth/me');
  return data.user;
}

export async function patchOnboarding(body: OnboardingBody): Promise<UserDto> {
  const data = await apiRequest<MeData>('/me/onboarding', {
    method: 'PATCH',
    body,
  });
  return data.user;
}
