import { setAccessToken } from '@/lib/api';
import { clearRefreshToken, setRefreshToken } from '@/lib/secure-store';
import type { UserDto } from '@rapih/shared';
import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: UserDto | null;

  /** Called after a successful sign-in or refresh — wires tokens + user. */
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    user: UserDto;
  }) => Promise<void>;

  /** Update the user payload without touching tokens (e.g. after onboarding PATCH). */
  setUser: (user: UserDto) => void;

  /** Mark unauthenticated (no tokens cleared). */
  setUnauthenticated: () => void;

  /** Full logout: clear tokens + state. */
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,

  setSession: async ({ accessToken, refreshToken, user }) => {
    setAccessToken(accessToken);
    await setRefreshToken(refreshToken);
    set({ status: 'authenticated', user });
  },

  setUser: (user) => set({ user }),

  setUnauthenticated: () => {
    setAccessToken(null);
    set({ status: 'unauthenticated', user: null });
  },

  logout: async () => {
    setAccessToken(null);
    await clearRefreshToken();
    set({ status: 'unauthenticated', user: null });
  },
}));
