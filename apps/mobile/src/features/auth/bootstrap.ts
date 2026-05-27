import { setAccessToken } from '@/lib/api';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/lib/secure-store';
import { getMe, refreshSession } from './api';
import { useAuthStore } from './auth-store';

/**
 * On app start, check for a stored refresh token. If present, exchange it for a
 * fresh access token and load the user. Otherwise leave the app in 'unauthenticated'.
 *
 * After this returns, useAuthStore.status will be either 'authenticated' or
 * 'unauthenticated' (never 'unknown').
 */
export async function bootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  try {
    const refresh = await getRefreshToken();
    if (!refresh) {
      store.setUnauthenticated();
      return;
    }

    const session = await refreshSession(refresh);
    setAccessToken(session.access_token);
    await setRefreshToken(session.refresh_token);

    const user = await getMe();
    await store.setSession({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user,
    });
  } catch {
    // Refresh or /me failed — clear and treat as unauthenticated.
    await clearRefreshToken();
    store.setUnauthenticated();
  }
}
